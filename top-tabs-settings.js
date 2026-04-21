(function () {
  const STORAGE_KEY = 'top_tabs_style_v1';

  const defaults = {
    selected: { color: '#1f2328', font: "'Space Grotesk', system-ui, sans-serif", size: 18, bold: true, italic: false, opacity: 100 },
    idle:     { color: '#6a7280', font: "'Space Grotesk', system-ui, sans-serif", size: 18, bold: true, italic: false, opacity: 100 },
    underline:{ color: '#1f2328', width: 2 },
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      const parsed = JSON.parse(raw);
      // Merge with defaults so missing fields fall back
      return {
        selected: { ...defaults.selected, ...(parsed.selected || {}) },
        idle:     { ...defaults.idle,     ...(parsed.idle     || {}) },
        underline:{ ...defaults.underline,...(parsed.underline|| {}) },
      };
    } catch { return JSON.parse(JSON.stringify(defaults)); }
  }

  function save(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function applyStyle(cfg) {
    const styleEl = document.getElementById('top-tabs-custom-style');
    if (!styleEl) return;
    const rule = (sel, o) => `
      ${sel} {
        color: ${o.color};
        font-family: ${o.font};
        font-size: ${o.size}px;
        font-weight: ${o.bold ? '700' : '500'};
        font-style: ${o.italic ? 'italic' : 'normal'};
        opacity: ${(o.opacity ?? 100) / 100};
      }
    `;
    styleEl.textContent = `
      ${rule('.ws-tab', cfg.idle)}
      ${rule('.ws-tab.is-active', cfg.selected)}
      .ws-tab.is-active {
        border-bottom-color: ${cfg.underline.color};
        border-bottom-width: ${cfg.underline.width}px;
        border-bottom-style: solid;
      }
      .ws-tab {
        border-bottom-width: ${cfg.underline.width}px;
        border-bottom-style: solid;
        border-bottom-color: transparent;
      }
    `;
  }

  let current = load();
  applyStyle(current);

  function bindInputs() {
    const panel = document.getElementById('settings-panel-toptabs');
    if (!panel) return;
    if (panel.dataset.ttBound === '1') return;
    panel.dataset.ttBound = '1';

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val;
    };

    // Populate
    const s = current.selected, i = current.idle, u = current.underline;
    set('tt-sel-color', s.color); set('tt-sel-font', s.font); set('tt-sel-size', s.size);
    set('tt-sel-bold', s.bold); set('tt-sel-italic', s.italic); set('tt-sel-opacity', s.opacity);
    set('tt-idle-color', i.color); set('tt-idle-font', i.font); set('tt-idle-size', i.size);
    set('tt-idle-bold', i.bold); set('tt-idle-italic', i.italic); set('tt-idle-opacity', i.opacity);
    set('tt-underline-color', u.color); set('tt-underline-width', u.width);

    // Wire up
    const bind = (id, path, cast) => {
      const el = document.getElementById(id);
      if (!el) return;
      const handler = () => {
        const raw = el.type === 'checkbox' ? el.checked : el.value;
        const v = cast ? cast(raw) : raw;
        const [group, key] = path;
        current[group][key] = v;
        applyStyle(current);
        save(current);
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    };

    bind('tt-sel-color', ['selected', 'color']);
    bind('tt-sel-font', ['selected', 'font']);
    bind('tt-sel-size', ['selected', 'size'], Number);
    bind('tt-sel-bold', ['selected', 'bold']);
    bind('tt-sel-italic', ['selected', 'italic']);
    bind('tt-sel-opacity', ['selected', 'opacity'], Number);

    bind('tt-idle-color', ['idle', 'color']);
    bind('tt-idle-font', ['idle', 'font']);
    bind('tt-idle-size', ['idle', 'size'], Number);
    bind('tt-idle-bold', ['idle', 'bold']);
    bind('tt-idle-italic', ['idle', 'italic']);
    bind('tt-idle-opacity', ['idle', 'opacity'], Number);

    bind('tt-underline-color', ['underline', 'color']);
    bind('tt-underline-width', ['underline', 'width'], Number);
  }

  // Tab switching is handled by firebase-workspace.js — no custom delegation needed.
  // When settings opens, bind our Top-tabs inputs.
  const settingsTrigger = document.getElementById('bottom-bar-settings-button');
  if (settingsTrigger) {
    settingsTrigger.addEventListener('click', () => {
      setTimeout(() => {
        bindInputs();
      }, 0);
    });
  }

  // Re-apply on storage change from another tab
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) {
      current = load();
      applyStyle(current);
    }
  });

  function init() {
    bindInputs();
  }

  // --- Library outline thickness (syncs to state.uiSettings.librarySelection.outlineWeight) ---
  function bindOutlineThickness() {
    const input = document.getElementById('library-outline-thickness-input');
    const readout = document.getElementById('library-outline-thickness-value');
    if (!input || !readout) return;
    if (input.dataset.ttBound === '1') return;
    input.dataset.ttBound = '1';

    // Initial value: read from CSS var if available
    try {
      const cssVal = getComputedStyle(document.documentElement).getPropertyValue('--library-page-active-outline-width').trim();
      const n = parseInt(cssVal, 10);
      if (!isNaN(n)) { input.value = n; readout.textContent = `${n}px`; }
    } catch {}

    input.addEventListener('input', () => {
      const v = Math.max(0, Math.min(8, parseInt(input.value, 10) || 0));
      readout.textContent = `${v}px`;
      document.documentElement.style.setProperty('--library-page-active-outline-width', `${v}px`);
      // Persist into workspace state if available
      try {
        const w = window;
        if (w.__workspaceApi && typeof w.__workspaceApi.setLibraryOutlineWeight === 'function') {
          w.__workspaceApi.setLibraryOutlineWeight(v);
        } else {
          // Fallback: update localStorage mirror so it persists across reloads
          const raw = localStorage.getItem('engineering-workspace-ui-settings');
          if (raw) {
            const s = JSON.parse(raw);
            if (!s.librarySelection) s.librarySelection = {};
            s.librarySelection.outlineWeight = v;
            localStorage.setItem('engineering-workspace-ui-settings', JSON.stringify(s));
          }
        }
      } catch {}
    });
  }

  // Hook it up whenever settings opens
  const settingsBtn = document.getElementById('bottom-bar-settings-button');
  if (settingsBtn) settingsBtn.addEventListener('click', () => setTimeout(bindOutlineThickness, 0));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
