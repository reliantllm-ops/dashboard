(function () {
  // Shared Settings module.
  // Owns the settings modal's tab state; pages register tabs.
  //
  // API (exposed as window.Settings):
  //   registerTab({ id, label, panelId, onOpen? })
  //   open(tabId?)   close()   toggle(tabId?)
  //   get(key, fallback)   set(key, value)
  //   onChange(key, handler)
  //   apply()    // re-fire all stored values to listeners
  //
  // Storage:
  //   Each setting key is a direct localStorage key, JSON-encoded.
  //
  // DOM:
  //   The modal shell is in the page HTML (see settings-modal partial).
  //   Tab buttons and panels are registered with IDs; Settings toggles them.

  const STORAGE_PREFIX = '';
  const listeners = new Map(); // key -> Set<fn>
  const tabs = [];
  let activeTabId = null;

  function readValue(key) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw == null) return undefined;
      return JSON.parse(raw);
    } catch { return undefined; }
  }

  function writeValue(key, value) {
    if (value === undefined) localStorage.removeItem(STORAGE_PREFIX + key);
    else localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    fire(key, value);
  }

  function fire(key, value) {
    const set = listeners.get(key);
    if (!set) return;
    set.forEach(fn => { try { fn(value); } catch (e) { console.error(e); } });
  }

  // Cross-tab updates
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    if (!listeners.has(e.key)) return;
    let v; try { v = e.newValue ? JSON.parse(e.newValue) : undefined; } catch { v = undefined; }
    fire(e.key, v);
  });

  function registerTab(def) {
    if (!def || !def.id || !def.label) return;
    if (tabs.find(t => t.id === def.id)) return;
    tabs.push({ order: 100, ...def });
    tabs.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    renderTabsChrome();
  }

  function ensureTabsBar() {
    return document.getElementById('settings-modal-tabs');
  }

  function renderTabsChrome() {
    const bar = ensureTabsBar();
    if (!bar) return;
    bar.innerHTML = '';
    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settings-modal-tab';
      btn.id = `settings-tab-${t.id}`;
      btn.setAttribute('role', 'tab');
      btn.textContent = t.label;
      btn.addEventListener('click', () => selectTab(t.id));
      bar.appendChild(btn);
    });
    if (!activeTabId && tabs.length) activeTabId = tabs[0].id;
    updateTabsUI();
  }

  function updateTabsUI() {
    tabs.forEach(t => {
      const btn = document.getElementById(`settings-tab-${t.id}`);
      const panel = document.getElementById(t.panelId);
      const isActive = t.id === activeTabId;
      if (btn) {
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
      if (panel) panel.hidden = !isActive;
    });
  }

  function selectTab(id) {
    if (!tabs.find(t => t.id === id)) return;
    activeTabId = id;
    updateTabsUI();
    const t = tabs.find(t => t.id === id);
    if (t && typeof t.onOpen === 'function') { try { t.onOpen(); } catch (e) { console.error(e); } }
  }

  function open(tabId) {
    const modal = document.getElementById('settings-modal');
    const backdrop = document.getElementById('settings-modal-backdrop');
    if (!modal || !backdrop) return;
    backdrop.hidden = false;
    modal.hidden = false;
    if (tabId) selectTab(tabId);
    else if (activeTabId) selectTab(activeTabId);
  }

  function close() {
    const modal = document.getElementById('settings-modal');
    const backdrop = document.getElementById('settings-modal-backdrop');
    if (modal) modal.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }

  function toggle(tabId) {
    const modal = document.getElementById('settings-modal');
    if (!modal || modal.hidden) open(tabId);
    else close();
  }

  function get(key, fallback) {
    const v = readValue(key);
    return v === undefined ? fallback : v;
  }

  function set(key, value) {
    writeValue(key, value);
  }

  function onChange(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key)?.delete(fn);
  }

  function apply() {
    // Re-fire all registered keys with their current values
    listeners.forEach((_set, key) => fire(key, readValue(key)));
  }

  // Wire close button and backdrop dismiss when shell is present
  function wireShell() {
    const okBtn = document.getElementById('settings-modal-ok-button');
    if (okBtn && !okBtn.dataset.settingsBound) {
      okBtn.dataset.settingsBound = '1';
      okBtn.addEventListener('click', close);
    }
    const closeBtn = document.getElementById('settings-modal-close-button');
    if (closeBtn && !closeBtn.dataset.settingsBound) {
      closeBtn.dataset.settingsBound = '1';
      closeBtn.addEventListener('click', close);
    }
    const backdrop = document.getElementById('settings-modal-backdrop');
    if (backdrop && !backdrop.dataset.settingsBound) {
      backdrop.dataset.settingsBound = '1';
      backdrop.addEventListener('click', close);
    }
    wireDrag();
  }

  function wireDrag() {
    const modal = document.getElementById('settings-modal');
    const header = document.getElementById('settings-modal-header');
    if (!modal || !header) return;
    if (header.dataset.settingsDragBound === '1') return;
    header.dataset.settingsDragBound = '1';
    header.style.cursor = 'move';
    header.style.userSelect = 'none';

    header.addEventListener('pointerdown', (e) => {
      if (!(e.target instanceof Element) || e.target.closest('button, input, select, textarea, label, a')) return;
      e.preventDefault();
      // Switch modal to absolute positioning so we can place it freely.
      const rect = modal.getBoundingClientRect();
      modal.style.position = 'fixed';
      modal.style.left = `${rect.left}px`;
      modal.style.top = `${rect.top}px`;
      modal.style.right = 'auto';
      modal.style.bottom = 'auto';
      modal.style.margin = '0';
      modal.style.transform = 'none';

      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      header.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const maxX = window.innerWidth - modal.offsetWidth;
        const maxY = window.innerHeight - modal.offsetHeight;
        const x = Math.max(0, Math.min(maxX, ev.clientX - offsetX));
        const y = Math.max(0, Math.min(maxY, ev.clientY - offsetY));
        modal.style.left = `${x}px`;
        modal.style.top = `${y}px`;
      };
      const onUp = () => {
        header.releasePointerCapture(e.pointerId);
        header.removeEventListener('pointermove', onMove);
        header.removeEventListener('pointerup', onUp);
      };
      header.addEventListener('pointermove', onMove);
      header.addEventListener('pointerup', onUp);
    });
  }

  // Wire the bottom-bar settings button
  function wireBottomBarButton() {
    const btn = document.getElementById('bottom-bar-settings-button');
    if (!btn || btn.dataset.settingsBound) return;
    btn.dataset.settingsBound = '1';
    btn.addEventListener('click', () => open());
  }

  function init() {
    wireShell();
    wireBottomBarButton();
    renderTabsChrome();
    // If the shell wasn't injected yet, re-run setup once it appears.
    if (!document.getElementById('settings-modal')) {
      const obs = new MutationObserver(() => {
        if (document.getElementById('settings-modal')) {
          wireShell();
          renderTabsChrome();
          obs.disconnect();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.Settings = { registerTab, open, close, toggle, get, set, onChange, apply, selectTab };
})();
