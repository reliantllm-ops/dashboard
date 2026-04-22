(function () {
  // Top-tabs typography settings. Uses the shared Settings module.

  const KEY = 'top_tabs_style_v1';
  const lightDefaults = {
    selected: { color: '#1f2328', font: "'Space Grotesk', system-ui, sans-serif", size: 18, bold: true, italic: false, opacity: 100 },
    idle:     { color: '#6a7280', font: "'Space Grotesk', system-ui, sans-serif", size: 18, bold: true, italic: false, opacity: 100 },
    underline:{ color: '#1f2328', width: 2 },
    bar:      { background: '#ffffff' },
  };
  const darkDefaults = {
    selected: { color: '#ffffff', font: "'Space Grotesk', system-ui, sans-serif", size: 18, bold: true, italic: false, opacity: 100 },
    idle:     { color: '#9aa0a6', font: "'Space Grotesk', system-ui, sans-serif", size: 18, bold: true, italic: false, opacity: 100 },
    underline:{ color: '#ffffff', width: 2 },
    bar:      { background: '#1a1d21' },
  };

  function mergeOne(raw, defs) {
    return {
      selected: { ...defs.selected, ...(raw?.selected || {}) },
      idle:     { ...defs.idle,     ...(raw?.idle     || {}) },
      underline:{ ...defs.underline,...(raw?.underline|| {}) },
      bar:      { ...defs.bar,      ...(raw?.bar      || {}) },
    };
  }

  function load() {
    const raw = window.Settings?.get(KEY) || {};
    // Back-compat: older versions stored a single flat object.
    if (raw.light || raw.dark) {
      return {
        light: mergeOne(raw.light, lightDefaults),
        dark:  mergeOne(raw.dark,  darkDefaults),
      };
    }
    // Migrate legacy flat to light mode.
    return {
      light: mergeOne(raw, lightDefaults),
      dark:  JSON.parse(JSON.stringify(darkDefaults)),
    };
  }

  function isDarkActive() {
    return document.body && document.body.classList.contains('dark-mode');
  }

  function applyActive(fullCfg) {
    const cfg = isDarkActive() ? fullCfg.dark : fullCfg.light;
    apply(cfg);
  }

  function apply(cfg) {
    const styleEl = document.getElementById('top-tabs-custom-style');
    if (!styleEl) return;
    // Use !important to override per-page scoped rules like `.cb-topbar .ws-tab`.
    const rule = (sel, o) => `
      ${sel} {
        color: ${o.color} !important;
        font-family: ${o.font} !important;
        font-size: ${o.size}px !important;
        font-weight: ${o.bold ? '700' : '500'} !important;
        font-style: ${o.italic ? 'italic' : 'normal'} !important;
        opacity: ${(o.opacity ?? 100) / 100} !important;
      }`;
    styleEl.textContent = `
      ${rule('.ws-tab', cfg.idle)}
      ${rule('.ws-tab.is-active', cfg.selected)}
      .ws-tab {
        border-bottom-width: ${cfg.underline.width}px !important;
        border-bottom-style: solid !important;
        border-bottom-color: transparent !important;
      }
      .ws-tab.is-active {
        border-bottom-color: ${cfg.underline.color} !important;
      }
      .ws-topbar,
      .cb-topbar {
        background: ${cfg.bar.background} !important;
      }
    `;
  }

  let currentSubTab = 'light';

  function bindInputs() {
    const panel = document.getElementById('settings-panel-toptabs');
    if (!panel) return;

    const current = load();
    const ids = {
      'tt-sel-color': ['selected', 'color'],
      'tt-sel-font':  ['selected', 'font'],
      'tt-sel-size':  ['selected', 'size', Number],
      'tt-sel-bold':  ['selected', 'bold'],
      'tt-sel-italic':['selected', 'italic'],
      'tt-sel-opacity':['selected', 'opacity', Number],
      'tt-idle-color':['idle', 'color'],
      'tt-idle-font': ['idle', 'font'],
      'tt-idle-size': ['idle', 'size', Number],
      'tt-idle-bold': ['idle', 'bold'],
      'tt-idle-italic':['idle', 'italic'],
      'tt-idle-opacity':['idle', 'opacity', Number],
      'tt-underline-color':['underline', 'color'],
      'tt-underline-width':['underline', 'width', Number],
      'tt-bar-background':['bar', 'background'],
    };

    function loadInputs() {
      const variant = current[currentSubTab];
      Object.entries(ids).forEach(([id, [group, key]]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!variant[group][key];
        else el.value = variant[group][key];
      });
    }

    // Bind the sub-tab switcher
    const lightBtn = document.getElementById('tt-subtab-light');
    const darkBtn = document.getElementById('tt-subtab-dark');
    if (lightBtn && !lightBtn.dataset.ttBound) {
      lightBtn.dataset.ttBound = '1';
      lightBtn.addEventListener('click', () => { currentSubTab = 'light'; updateSubTabUI(); loadInputs(); });
    }
    if (darkBtn && !darkBtn.dataset.ttBound) {
      darkBtn.dataset.ttBound = '1';
      darkBtn.addEventListener('click', () => { currentSubTab = 'dark'; updateSubTabUI(); loadInputs(); });
    }
    // Default to whichever mode is currently active
    currentSubTab = isDarkActive() ? 'dark' : 'light';
    updateSubTabUI();

    // Only bind value handlers once
    if (panel.dataset.ttBound !== '1') {
      panel.dataset.ttBound = '1';
      Object.entries(ids).forEach(([id, path]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const [group, key, cast] = path;
        const handler = () => {
          const raw = el.type === 'checkbox' ? el.checked : el.value;
          current[currentSubTab][group][key] = cast ? cast(raw) : raw;
          window.Settings.set(KEY, current);
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      });
    }

    loadInputs();
  }

  function updateSubTabUI() {
    const lightBtn = document.getElementById('tt-subtab-light');
    const darkBtn = document.getElementById('tt-subtab-dark');
    if (lightBtn) lightBtn.classList.toggle('is-active', currentSubTab === 'light');
    if (darkBtn)  darkBtn.classList.toggle('is-active',  currentSubTab === 'dark');
  }

  // Register tab, react to changes
  function register() {
    if (!window.Settings) { setTimeout(register, 50); return; }
    window.Settings.registerTab({
      id: 'toptabs',
      label: 'Top bar',
      panelId: 'settings-panel-toptabs',
      onOpen: bindInputs,
      order: 20,
    });
    window.Settings.onChange(KEY, () => applyActive(load()));
    applyActive(load());

    // Re-apply when dark-mode toggles
    const bodyObs = new MutationObserver(() => applyActive(load()));
    if (document.body) {
      bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }

  register();
})();
