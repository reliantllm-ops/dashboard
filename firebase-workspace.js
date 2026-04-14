import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { firebaseProject } from "./firebase-config.js";

const STORAGE_KEY = "engineering-workspace-pages";

const defaultPages = [
  {
    id: "home-dashboard",
    title: "Engineering Command Center",
    category: "Dashboard",
    tags: ["dashboard", "metrics", "leadership"],
    summary: "High-level summary of engineering performance, operational load, and near-term priorities.",
    body: `# Weekly Pulse

## Delivery
- Lead time: 2.8 days
- Deployments this week: 22
- Sprint completion forecast: 91%

## Reliability
- MTTR: 46 minutes
- Open sev-2 incidents: 2
- Highest pressure area: API gateway latency

## Focus this week
- Stabilize self-hosted CI runner capacity
- Finish trace instrumentation for event pipeline
- Remove single-threaded release approvals
`
  },
  {
    id: "platform-oncall",
    title: "Platform On-Call Runbook",
    category: "Runbook",
    tags: ["platform", "incident", "on-call"],
    summary: "Escalation path and first-response checklist for platform incidents.",
    body: `# Incident Intake

Use this page during the first 15 minutes of an incident.

## Triage
- Confirm blast radius
- Assign incident commander
- Start Slack bridge and timeline

## Checks
- Review deploys from the last 60 minutes
- Inspect API gateway health
- Validate database saturation metrics

## Escalation
- Platform manager
- SRE primary
- Security on-call if customer data is impacted
`
  },
  {
    id: "system-architecture",
    title: "Core System Architecture",
    category: "Architecture",
    tags: ["architecture", "services", "reference"],
    summary: "Living notes on service boundaries and operational ownership.",
    body: `# Service Map

## Entry Layer
- Web app
- API gateway
- Authentication service

## Domain Services
- Orders
- Catalog
- Billing
- Search

## Shared Infrastructure
- PostgreSQL
- Kafka
- Redis
- Observability stack

## Ownership
- Platform owns runtime and delivery systems
- Product squads own domain services
`
  }
];

const state = {
  pages: loadLocalPages(),
  activePageId: null,
  searchTerm: "",
  lastSavedAt: null,
  syncMode: firebaseProject.enabled ? "firebase" : "local",
  authReady: false,
  user: null,
  routeMode: "workspace"
};

const elements = {
  pageList: document.querySelector("#page-list"),
  pageCount: document.querySelector("#page-count"),
  heroPageCount: document.querySelector("#hero-page-count"),
  lastSavedLabel: document.querySelector("#last-saved-label"),
  saveStatus: document.querySelector("#save-status"),
  editorHeading: document.querySelector("#editor-heading"),
  pageSearch: document.querySelector("#page-search"),
  editorForm: document.querySelector("#editor-form"),
  title: document.querySelector("#page-title"),
  category: document.querySelector("#page-category"),
  tags: document.querySelector("#page-tags"),
  summary: document.querySelector("#page-summary"),
  body: document.querySelector("#page-body"),
  previewTitle: document.querySelector("#preview-title"),
  previewSummary: document.querySelector("#preview-summary"),
  previewTags: document.querySelector("#preview-tags"),
  previewBody: document.querySelector("#preview-body"),
  categoryPill: document.querySelector("#active-category-pill"),
  newPageButton: document.querySelector("#new-page-button"),
  duplicatePageButton: document.querySelector("#duplicate-page-button"),
  deletePageButton: document.querySelector("#delete-page-button"),
  syncMode: document.querySelector("#sync-mode"),
  authStatus: document.querySelector("#auth-status"),
  signInButton: document.querySelector("#sign-in-button"),
  signOutButton: document.querySelector("#sign-out-button"),
  workspaceLink: document.querySelector("#workspace-link"),
  pageRouteLink: document.querySelector("#page-route-link"),
  editRouteLink: document.querySelector("#edit-route-link"),
  openPageInlineLink: document.querySelector("#open-page-inline-link"),
  routeCopy: document.querySelector("#route-copy")
};

let auth = null;
let db = null;
let unsubscribePages = null;

function loadLocalPages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...defaultPages];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...defaultPages];
    }

    return parsed;
  } catch {
    return [...defaultPages];
  }
}

function saveLocalPages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pages));
}

function renderSaveState(label) {
  elements.saveStatus.textContent = label;
}

function renderHeroSummary() {
  elements.heroPageCount.textContent = String(state.pages.length);
  elements.pageCount.textContent = `${state.pages.length} pages`;
  elements.lastSavedLabel.textContent = state.lastSavedAt
    ? state.lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : state.syncMode === "firebase"
      ? "Cloud sync idle"
      : "Local seed data";
}

function renderSyncState() {
  if (state.syncMode === "firebase") {
    elements.syncMode.textContent = "Firebase";
    if (state.user) {
      const label = state.user.displayName || state.user.email || "Signed-in user";
      elements.authStatus.textContent = `Cloud sync enabled for ${label}.`;
    } else if (state.authReady) {
      elements.authStatus.textContent = "Sign in with Google to load and edit shared workspace pages.";
    } else {
      elements.authStatus.textContent = "Connecting to Firebase authentication.";
    }
  } else {
    elements.syncMode.textContent = "Local mode";
    elements.authStatus.textContent = "Connect Firebase config to enable shared pages and Google sign-in.";
  }

  elements.signInButton.disabled = state.syncMode !== "firebase" || !state.authReady || !!state.user;
  elements.signOutButton.disabled = state.syncMode !== "firebase" || !state.user;
}

function parseRoute() {
  const hash = window.location.hash || "#/";

  if (hash.startsWith("#/page/")) {
    return { mode: "page", pageId: decodeURIComponent(hash.slice(7)) };
  }

  if (hash.startsWith("#/edit/")) {
    return { mode: "workspace", pageId: decodeURIComponent(hash.slice(7)) };
  }

  return { mode: "workspace", pageId: null };
}

function setRoute(mode, pageId) {
  const nextHash = mode === "page"
    ? `#/page/${encodeURIComponent(pageId)}`
    : pageId
      ? `#/edit/${encodeURIComponent(pageId)}`
      : "#/";

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
    return;
  }

  applyRoute();
}

function applyRoute() {
  const route = parseRoute();
  state.routeMode = route.mode;

  if (route.pageId && state.pages.some((page) => page.id === route.pageId)) {
    state.activePageId = route.pageId;
  } else {
    ensureActivePage();
  }

  document.body.classList.toggle("page-mode", state.routeMode === "page");
}

function ensureActivePage() {
  if (!state.pages.length) {
    state.pages = [...defaultPages];
  }

  const activeExists = state.pages.some((page) => page.id === state.activePageId);
  if (!activeExists) {
    state.activePageId = state.pages[0]?.id ?? null;
  }
}

function getActivePage() {
  ensureActivePage();
  return state.pages.find((page) => page.id === state.activePageId);
}

function filteredPages() {
  const term = state.searchTerm.trim().toLowerCase();
  if (!term) {
    return state.pages;
  }

  return state.pages.filter((page) => {
    const haystack = [
      page.title,
      page.category,
      page.summary,
      page.tags.join(" "),
      page.body
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineMarkdown(line) {
  return line
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(source) {
  const safe = escapeHtml(source || "");
  const lines = safe.split("\n");
  const html = [];
  let inList = false;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      html.push(inCodeBlock ? "</code></pre>" : "<pre><code>");
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      html.push(`${line}\n`);
      continue;
    }

    if (!line.trim()) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (line.trim() === "---") {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push("<hr>");
      continue;
    }

    if (inList) {
      html.push("</ul>");
      inList = false;
    }

    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inList) {
    html.push("</ul>");
  }

  if (inCodeBlock) {
    html.push("</code></pre>");
  }

  return html.join("");
}

function normalizePage(page) {
  return {
    id: page.id,
    title: page.title || "Untitled page",
    category: page.category || "Reference",
    tags: Array.isArray(page.tags) ? page.tags : [],
    summary: page.summary || "",
    body: page.body || "",
    createdAt: page.createdAt || null,
    updatedAt: page.updatedAt || null,
    updatedBy: page.updatedBy || ""
  };
}

function renderPageList() {
  const pages = filteredPages();

  if (!pages.length) {
    elements.pageList.innerHTML = '<p class="empty-state">No pages match this search.</p>';
    return;
  }

  elements.pageList.innerHTML = pages
    .map((page) => {
      const activeClass = page.id === state.activePageId ? "active" : "";
      const tags = page.tags.slice(0, 3).join(" | ");

      return `
        <button class="page-item ${activeClass}" data-page-id="${page.id}" type="button">
          <div class="page-item-header">
            <div>
              <h3>${escapeHtml(page.title)}</h3>
              <p class="page-item-summary">${escapeHtml(page.summary)}</p>
            </div>
            <span class="pill">${escapeHtml(page.category)}</span>
          </div>
          <p class="page-item-meta">${escapeHtml(tags || "untagged")}</p>
        </button>
      `;
    })
    .join("");
}

function renderEditor() {
  const page = getActivePage();
  if (!page) {
    return;
  }

  elements.editorHeading.textContent = page.title || "Untitled page";
  elements.title.value = page.title;
  elements.category.value = page.category;
  elements.tags.value = page.tags.join(", ");
  elements.summary.value = page.summary;
  elements.body.value = page.body;
  elements.deletePageButton.disabled = state.pages.length === 1 || (state.syncMode === "firebase" && !state.user);
}

function renderPreview() {
  const page = getActivePage();
  if (!page) {
    return;
  }

  elements.previewTitle.textContent = page.title || "Untitled page";
  elements.previewSummary.textContent = page.summary || "Add a summary to explain what this page is for.";
  elements.categoryPill.textContent = page.category;
  elements.previewBody.innerHTML = renderMarkdown(page.body);
  elements.previewTags.innerHTML = page.tags.length
    ? page.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")
    : '<span class="pill">untagged</span>';

  const pageHash = `#/page/${encodeURIComponent(page.id)}`;
  const editHash = `#/edit/${encodeURIComponent(page.id)}`;

  elements.pageRouteLink.href = pageHash;
  elements.editRouteLink.href = editHash;
  elements.openPageInlineLink.href = pageHash;
  elements.routeCopy.textContent = state.routeMode === "page"
    ? `Direct page URL: ${window.location.origin}${window.location.pathname}${pageHash}`
    : "Each page can now be opened directly with its own URL.";
}

function renderAll() {
  applyRoute();
  ensureActivePage();
  renderPageList();
  renderEditor();
  renderPreview();
  renderHeroSummary();
  renderSyncState();
}

function uniqueIdFromTitle(title) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const base = slug || "page";
  let candidate = base;
  let counter = 2;

  while (state.pages.some((page) => page.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function buildPageFromForm(existingId = null) {
  const title = elements.title.value.trim() || "Untitled page";
  return {
    id: existingId || uniqueIdFromTitle(title),
    title,
    category: elements.category.value,
    tags: elements.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    summary: elements.summary.value.trim(),
    body: elements.body.value
  };
}

async function createBlankPage() {
  const page = {
    id: uniqueIdFromTitle("Untitled page"),
    title: "Untitled page",
    category: "Reference",
    tags: ["new"],
    summary: "Describe what this page covers.",
    body: "# Untitled page\n\nStart writing here."
  };

  if (state.syncMode === "firebase") {
    if (!state.user) {
      renderSaveState("Sign in");
      return;
    }

    await upsertFirebasePage(page, true);
    return;
  }

  state.pages.unshift(page);
  state.activePageId = page.id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute("workspace", page.id);
  renderAll();
}

async function duplicateActivePage() {
  const active = getActivePage();
  const page = {
    ...active,
    id: uniqueIdFromTitle(`${active.title} copy`),
    title: `${active.title} copy`
  };

  if (state.syncMode === "firebase") {
    if (!state.user) {
      renderSaveState("Sign in");
      return;
    }

    await upsertFirebasePage(page, true);
    return;
  }

  state.pages.unshift(page);
  state.activePageId = page.id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute("workspace", page.id);
  renderAll();
}

async function deleteActivePage() {
  if (state.pages.length === 1) {
    return;
  }

  if (state.syncMode === "firebase") {
    if (!state.user) {
      renderSaveState("Sign in");
      return;
    }

    await deleteDoc(doc(db, "pages", state.activePageId));
    renderSaveState("Deleted");
    return;
  }

  state.pages = state.pages.filter((page) => page.id !== state.activePageId);
  state.activePageId = state.pages[0].id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Deleted");
  setRoute("workspace", state.activePageId);
  renderAll();
}

async function upsertFirebasePage(page, isNewPage) {
  const pageRef = doc(db, "pages", page.id);
  const payload = {
    ...page,
    updatedAt: serverTimestamp(),
    updatedBy: state.user?.displayName || state.user?.email || "Unknown"
  };

  if (isNewPage) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(pageRef, payload, { merge: true });
  state.activePageId = page.id;
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute(state.routeMode === "page" ? "page" : "workspace", page.id);
}

async function updateActivePageFromForm() {
  const active = getActivePage();
  const page = buildPageFromForm(active?.id);

  if (state.syncMode === "firebase") {
    if (!state.user) {
      renderSaveState("Sign in");
      return;
    }

    await upsertFirebasePage(page, false);
    return;
  }

  const index = state.pages.findIndex((entry) => entry.id === active.id);
  state.pages[index] = { ...active, ...page };
  state.activePageId = page.id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute(state.routeMode === "page" ? "page" : "workspace", page.id);
  renderAll();
}

function handleLiveEdit() {
  const active = getActivePage();
  if (!active) {
    return;
  }

  const draftTitle = elements.title.value.trim() || "Untitled page";
  const draftSummary = elements.summary.value.trim();
  const draftTags = elements.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  elements.editorHeading.textContent = draftTitle;
  elements.previewTitle.textContent = draftTitle;
  elements.previewSummary.textContent = draftSummary || "Add a summary to explain what this page is for.";
  elements.categoryPill.textContent = elements.category.value;
  elements.previewTags.innerHTML = draftTags.length
    ? draftTags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")
    : '<span class="pill">untagged</span>';
  elements.previewBody.innerHTML = renderMarkdown(elements.body.value);

  if (
    active.title !== draftTitle ||
    active.summary !== draftSummary ||
    active.category !== elements.category.value ||
    active.body !== elements.body.value ||
    active.tags.join(",") !== draftTags.join(",")
  ) {
    renderSaveState("Unsaved");
  }
}

async function seedFirebasePages() {
  const existing = await getDocs(collection(db, "pages"));
  if (!existing.empty) {
    return;
  }

  await Promise.all(
    defaultPages.map((page) =>
      setDoc(doc(db, "pages", page.id), {
        ...page,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: state.user?.displayName || state.user?.email || "Seed data"
      })
    )
  );
}

function connectFirebase() {
  const { enabled, config } = firebaseProject;
  if (!enabled || !config.apiKey || !config.projectId || !config.appId) {
    renderAll();
    return;
  }

  const app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  state.syncMode = "firebase";

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    state.authReady = true;
    renderSyncState();

    if (unsubscribePages) {
      unsubscribePages();
      unsubscribePages = null;
    }

    if (!user) {
      state.pages = loadLocalPages();
      state.activePageId = state.pages[0]?.id ?? null;
      renderAll();
      return;
    }

    const pagesQuery = query(collection(db, "pages"), orderBy("title"));
    unsubscribePages = onSnapshot(pagesQuery, async (snapshot) => {
      if (snapshot.empty) {
        await seedFirebasePages();
        return;
      }

      state.pages = snapshot.docs.map((entry) => normalizePage(entry.data()));
      ensureActivePage();
      renderAll();
    });
  });
}

async function handleSignIn() {
  if (!auth) {
    return;
  }

  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

async function handleSignOut() {
  if (!auth) {
    return;
  }

  await signOut(auth);
}

elements.pageList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page-id]");
  if (!button) {
    return;
  }

  state.activePageId = button.getAttribute("data-page-id");
  setRoute("workspace", state.activePageId);
  renderAll();
  renderSaveState("Ready");
});

elements.pageSearch.addEventListener("input", (event) => {
  state.searchTerm = event.target.value;
  renderPageList();
});

elements.editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await updateActivePageFromForm();
});

elements.newPageButton.addEventListener("click", async () => {
  await createBlankPage();
});

elements.duplicatePageButton.addEventListener("click", async () => {
  await duplicateActivePage();
});

elements.deletePageButton.addEventListener("click", async () => {
  await deleteActivePage();
});

elements.signInButton.addEventListener("click", async () => {
  await handleSignIn();
});

elements.signOutButton.addEventListener("click", async () => {
  await handleSignOut();
});

[elements.title, elements.category, elements.tags, elements.summary, elements.body].forEach((field) => {
  field.addEventListener("input", handleLiveEdit);
});

window.addEventListener("hashchange", () => {
  applyRoute();
  renderAll();
});

applyRoute();
renderAll();
connectFirebase();
