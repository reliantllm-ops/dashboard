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
  pages: loadPages(),
  activePageId: null,
  searchTerm: "",
  lastSavedAt: null
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
  deletePageButton: document.querySelector("#delete-page-button")
};

function loadPages() {
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

function savePages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pages));
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  renderHeroSummary();
}

function renderSaveState(label) {
  elements.saveStatus.textContent = label;
}

function renderHeroSummary() {
  elements.heroPageCount.textContent = String(state.pages.length);
  elements.pageCount.textContent = `${state.pages.length} pages`;
  elements.lastSavedLabel.textContent = state.lastSavedAt
    ? state.lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Seed data";
}

function ensureActivePage() {
  if (!state.pages.length) {
    state.pages = [...defaultPages];
  }

  const activeExists = state.pages.some((page) => page.id === state.activePageId);
  if (!activeExists) {
    state.activePageId = state.pages[0].id;
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

function renderPageList() {
  const pages = filteredPages();

  if (!pages.length) {
    elements.pageList.innerHTML = '<p class="empty-state">No pages match this search.</p>';
    return;
  }

  elements.pageList.innerHTML = pages
    .map((page) => {
      const activeClass = page.id === state.activePageId ? "active" : "";
      const tags = page.tags.slice(0, 3).join(" • ");

      return `
        <button class="page-item ${activeClass}" data-page-id="${page.id}" type="button">
          <div class="page-item-header">
            <div class="page-item-link">
              <svg class="page-item-icon" aria-hidden="true" viewBox="0 0 16 16" focusable="false">
                <path d="M3 1.5h6.8L13 4.7v9.8H3V1.5Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                <path d="M9.8 1.5v3.2H13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
              <div>
              <h3>${escapeHtml(page.title)}</h3>
              <p class="page-item-summary">${escapeHtml(page.summary)}</p>
              </div>
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

  elements.editorHeading.textContent = page.title || "Untitled page";
  elements.title.value = page.title;
  elements.category.value = page.category;
  elements.tags.value = page.tags.join(", ");
  elements.summary.value = page.summary;
  elements.body.value = page.body;
  elements.deletePageButton.disabled = state.pages.length === 1;
}

function renderPreview() {
  const page = getActivePage();

  elements.previewTitle.textContent = page.title || "Untitled page";
  elements.previewSummary.textContent = page.summary || "Add a summary to explain what this page is for.";
  elements.categoryPill.textContent = page.category;
  elements.previewBody.innerHTML = renderMarkdown(page.body);
  elements.previewTags.innerHTML = page.tags.length
    ? page.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")
    : '<span class="pill">untagged</span>';
}

function renderAll() {
  ensureActivePage();
  renderPageList();
  renderEditor();
  renderPreview();
  renderHeroSummary();
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

function createBlankPage() {
  const page = {
    id: uniqueIdFromTitle("Untitled page"),
    title: "Untitled page",
    category: "Reference",
    tags: ["new"],
    summary: "Describe what this page covers.",
    body: "# Untitled page\n\nStart writing here."
  };

  state.pages.unshift(page);
  state.activePageId = page.id;
  savePages();
  renderAll();
}

function duplicateActivePage() {
  const active = getActivePage();
  const page = {
    ...active,
    id: uniqueIdFromTitle(`${active.title} copy`),
    title: `${active.title} copy`
  };

  state.pages.unshift(page);
  state.activePageId = page.id;
  savePages();
  renderAll();
}

function deleteActivePage() {
  if (state.pages.length === 1) {
    return;
  }

  state.pages = state.pages.filter((page) => page.id !== state.activePageId);
  state.activePageId = state.pages[0].id;
  savePages();
  renderAll();
}

function updateActivePageFromForm() {
  const active = getActivePage();
  const title = elements.title.value.trim() || "Untitled page";
  const tags = elements.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  active.title = title;
  active.category = elements.category.value;
  active.tags = tags;
  active.summary = elements.summary.value.trim();
  active.body = elements.body.value;

  savePages();
  renderAll();
}

function handleLiveEdit() {
  const active = getActivePage();
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

elements.pageList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page-id]");
  if (!button) {
    return;
  }

  state.activePageId = button.getAttribute("data-page-id");
  renderAll();
  renderSaveState("Ready");
});

elements.pageSearch.addEventListener("input", (event) => {
  state.searchTerm = event.target.value;
  renderPageList();
});

elements.editorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateActivePageFromForm();
});

elements.newPageButton.addEventListener("click", createBlankPage);
elements.duplicatePageButton.addEventListener("click", duplicateActivePage);
elements.deletePageButton.addEventListener("click", deleteActivePage);

[elements.title, elements.category, elements.tags, elements.summary, elements.body].forEach((field) => {
  field.addEventListener("input", handleLiveEdit);
});

renderAll();
