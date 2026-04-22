(function () {
  const KEY = 'dashboard_editor_style_v3';
  const LEGACY_V2 = 'dashboard_editor_style_v2';
  const LEGACY_V1 = 'dashboard_editor_style_v1';
  const FACTORY_KEY = 'dashboard_editor_defaults_v1';
  const ARCHIVE_KEY = 'dashboard_editor_archive_v1';

  function loadFactory() {
    try { return JSON.parse(localStorage.getItem(FACTORY_KEY) || 'null'); }
    catch { return null; }
  }
  function saveFactory(v) {
    if (v) localStorage.setItem(FACTORY_KEY, JSON.stringify(v));
    else localStorage.removeItem(FACTORY_KEY);
  }
  function loadArchive() {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]') || []; }
    catch { return []; }
  }
  function saveArchive(list) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list)); }
  const FONTS = "'Space Grotesk', system-ui, sans-serif";

  const lightDefaults = {
    left:   {
      surface: { background: '#f7f8f9', border: '#d9dde3' },
      libraryPanel: { background: '#ffffff', border: '#dfe1e6' },
    },
    center: {
      surface: { background: '#ffffff', border: '#d9dde3' },
      title:   { color: '#1f2328', font: FONTS, size: 32, bold: true, italic: false },
      body:    { color: '#1f2328', font: FONTS, size: 16, lineHeight: 1.45, bold: false, italic: false },
    },
    right:  {
      surface: { background: '#ffffff', border: '#d9dde3' },
      tabArea: {
        headerBackground: '#f6f8fb',
        headerBorder: '#dfe4ea',
        tabIdleColor: '#6a7280',
        tabActiveBackground: '#ffffff',
        tabActiveColor: '#1f2328',
        buttonBackground: 'rgba(23, 33, 33, 0.08)',
        buttonColor: '#1f2328',
      },
    },
  };
  const darkDefaults = {
    left:   {
      surface: { background: '#1a1d21', border: '#2d3136' },
      libraryPanel: { background: '#232629', border: '#2d3136' },
    },
    center: {
      surface: { background: '#1a1d21', border: '#2d3136' },
      title:   { color: '#ffffff', font: FONTS, size: 32, bold: true, italic: false },
      body:    { color: '#e6e6e6', font: FONTS, size: 16, lineHeight: 1.45, bold: false, italic: false },
    },
    right:  {
      surface: { background: '#232629', border: '#2d3136' },
      tabArea: {
        headerBackground: '#1f2328',
        headerBorder: '#3a3f45',
        tabIdleColor: '#9aa0a6',
        tabActiveBackground: '#2d3136',
        tabActiveColor: '#ffffff',
        buttonBackground: '#2d3136',
        buttonColor: '#ffffff',
      },
    },
  };

  function mergePanel(raw, defs) {
    const out = { surface: { ...defs.surface, ...(raw?.surface || {}) } };
    if (defs.title) out.title = { ...defs.title, ...(raw?.title || {}) };
    if (defs.body)  out.body  = { ...defs.body,  ...(raw?.body  || {}) };
    if (defs.libraryPanel) out.libraryPanel = { ...defs.libraryPanel, ...(raw?.libraryPanel || {}) };
    if (defs.tabArea) out.tabArea = { ...defs.tabArea, ...(raw?.tabArea || {}) };
    return out;
  }
  function mergeMode(raw, defs) {
    return {
      left:   mergePanel(raw?.left,   defs.left),
      center: mergePanel(raw?.center, defs.center),
      right:  mergePanel(raw?.right,  defs.right),
    };
  }

  function load() {
    const v3 = window.Settings?.get(KEY);
    if (v3 && (v3.light || v3.dark)) {
      return {
        light: mergeMode(v3.light, lightDefaults),
        dark:  mergeMode(v3.dark,  darkDefaults),
      };
    }
    const v2 = window.Settings?.get(LEGACY_V2);
    if (v2 && (v2.left || v2.center || v2.right)) {
      return {
        light: mergeMode(v2, lightDefaults),
        dark:  mergeMode({}, darkDefaults),
      };
    }
    const v1 = window.Settings?.get(LEGACY_V1);
    if (v1) {
      const source = v1.light || v1.dark || v1;
      return {
        light: mergeMode({
          left:   { surface: { background: source.surface?.libraryBackground || lightDefaults.left.surface.background, border: source.surface?.border || lightDefaults.left.surface.border } },
          center: { surface: { background: source.surface?.background || lightDefaults.center.surface.background, border: source.surface?.border || lightDefaults.center.surface.border }, title: source.title, body: source.body },
          right:  { surface: { background: source.surface?.background || lightDefaults.right.surface.background, border: source.surface?.border || lightDefaults.right.surface.border } },
        }, lightDefaults),
        dark: mergeMode({}, darkDefaults),
      };
    }
    return {
      light: mergeMode({}, lightDefaults),
      dark:  mergeMode({}, darkDefaults),
    };
  }

  function isDarkActive() { return document.body && document.body.classList.contains('dark-mode'); }

  function cssTextStyle(cfg) {
    return `
      color: ${cfg.color} !important;
      font-family: ${cfg.font} !important;
      font-size: ${cfg.size}px !important;
      font-weight: ${cfg.bold ? '700' : '400'} !important;
      font-style: ${cfg.italic ? 'italic' : 'normal'} !important;
    `;
  }

  function apply(full) {
    const styleEl = document.getElementById('dashboard-editor-custom-style');
    if (!styleEl) return;
    // Move our stylesheet to the end of <head> so it wins over later-injected styles.
    if (styleEl.parentNode && styleEl.parentNode.lastElementChild !== styleEl) {
      styleEl.parentNode.appendChild(styleEl);
    }
    const cfg = isDarkActive() ? full.dark : full.light;
    styleEl.textContent = `
      html body .sidebar,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .sidebar {
        background: ${cfg.left.surface.background} !important;
        border-color: ${cfg.left.surface.border} !important;
      }
      html body .sidebar-panel,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .sidebar-panel {
        background: ${cfg.left.libraryPanel.background} !important;
        border-color: ${cfg.left.libraryPanel.border} !important;
      }
      html body .page-item,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .page-item {
        background: ${cfg.left.libraryPanel.background} !important;
        border-color: ${cfg.left.libraryPanel.border} !important;
      }
      html body .editor-card,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .editor-card {
        background: ${cfg.center.surface.background} !important;
        border-color: ${cfg.center.surface.border} !important;
      }
      html body .published-card,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .published-card {
        background: ${cfg.right.surface.background} !important;
        border-color: ${cfg.right.surface.border} !important;
      }
      html body .tabbed-container-header,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .tabbed-container-header {
        background: ${cfg.right.tabArea.headerBackground} !important;
        border-bottom-color: ${cfg.right.tabArea.headerBorder} !important;
      }
      html body .tabbed-container-tab,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .tabbed-container-tab {
        color: ${cfg.right.tabArea.tabIdleColor} !important;
      }
      html body .tabbed-container-tab.is-active,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .tabbed-container-tab.is-active {
        background: ${cfg.right.tabArea.tabActiveBackground} !important;
        color: ${cfg.right.tabArea.tabActiveColor} !important;
      }
      html body .tabbed-container-tab.is-editing,
      html body .tabbed-container-tab-input,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .tabbed-container-tab.is-editing,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .tabbed-container-tab-input {
        background: ${cfg.right.tabArea.tabActiveBackground} !important;
        color: ${cfg.right.tabArea.tabActiveColor} !important;
      }
      html body .tabbed-container-control,
      html body.dark-mode.dark-mode.dark-mode.dark-mode .tabbed-container-control {
        background: ${cfg.right.tabArea.buttonBackground} !important;
        color: ${cfg.right.tabArea.buttonColor} !important;
      }
      .page-title-editor { ${cssTextStyle(cfg.center.title)} }
      #published-title {
        color: ${cfg.center.title.color} !important;
        font-family: ${cfg.center.title.font} !important;
      }
      .page-title-editor:empty::before { color: ${cfg.center.body.color}99 !important; }
      .body-editor, .body-editor p, .body-editor li, .body-editor ul,
      .editor-text-block,
      .published-body, .published-body p, .published-body li, .published-body ul {
        ${cssTextStyle(cfg.center.body)}
        line-height: ${cfg.center.body.lineHeight} !important;
      }
      .body-editor h1, .body-editor h2, .body-editor h3,
      .published-body h1, .published-body h2, .published-body h3 {
        color: ${cfg.center.body.color} !important;
        font-family: ${cfg.center.body.font} !important;
      }
      .published-body hr, .body-editor hr {
        border-color: ${cfg.center.surface.border} !important;
      }
      .chart-editor-flyout, .tab-area-editor-flyout, .shape-editor-flyout {
        background: ${cfg.right.surface.background} !important;
        border-color: ${cfg.right.surface.border} !important;
      }
    `;
    document.querySelectorAll('.sidebar, .sidebar-panel, .page-item').forEach(el => {
      el.style.removeProperty('background');
      el.style.removeProperty('border-color');
    });
  }

  let currentMode = 'light';
  let currentPanel = 'left';

  function bindInputs() {
    const panel = document.getElementById('settings-panel-dashboard-editor');
    if (!panel) return;

    const current = load();
    const ids = {
      'de-left-background':   ['left', 'surface', 'background'],
      'de-left-border':       ['left', 'surface', 'border'],
      'de-libpanel-background': ['left', 'libraryPanel', 'background'],
      'de-libpanel-border':     ['left', 'libraryPanel', 'border'],
      'de-center-background': ['center', 'surface', 'background'],
      'de-center-border':     ['center', 'surface', 'border'],
      'de-right-background':  ['right', 'surface', 'background'],
      'de-right-border':      ['right', 'surface', 'border'],
      'de-tabarea-header-background': ['right', 'tabArea', 'headerBackground'],
      'de-tabarea-header-border': ['right', 'tabArea', 'headerBorder'],
      'de-tabarea-tab-idle-color': ['right', 'tabArea', 'tabIdleColor'],
      'de-tabarea-tab-active-background': ['right', 'tabArea', 'tabActiveBackground'],
      'de-tabarea-tab-active-color': ['right', 'tabArea', 'tabActiveColor'],
      'de-tabarea-button-background': ['right', 'tabArea', 'buttonBackground'],
      'de-tabarea-button-color': ['right', 'tabArea', 'buttonColor'],
      'de-title-color':       ['center', 'title', 'color'],
      'de-title-font':        ['center', 'title', 'font'],
      'de-title-size':        ['center', 'title', 'size', Number],
      'de-title-bold':        ['center', 'title', 'bold'],
      'de-title-italic':      ['center', 'title', 'italic'],
      'de-body-color':        ['center', 'body', 'color'],
      'de-body-font':         ['center', 'body', 'font'],
      'de-body-size':         ['center', 'body', 'size', Number],
      'de-body-line-height':  ['center', 'body', 'lineHeight', Number],
      'de-body-bold':         ['center', 'body', 'bold'],
      'de-body-italic':       ['center', 'body', 'italic'],
    };

    function loadInputs() {
      Object.entries(ids).forEach(([id, [panelKey, group, key]]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!current[currentMode][panelKey][group][key];
        else el.value = current[currentMode][panelKey][group][key];
      });
    }

    function updateModeUI() {
      ['light', 'dark'].forEach(m => {
        const btn = document.getElementById(`de-mode-${m}`);
        if (btn) btn.classList.toggle('is-active', m === currentMode);
      });
    }
    function updatePanelUI() {
      ['left', 'center', 'right'].forEach(p => {
        const btn = document.getElementById(`de-subtab-${p}`);
        const sub = document.getElementById(`de-subpanel-${p}`);
        if (btn) btn.classList.toggle('is-active', p === currentPanel);
        if (sub) sub.hidden = p !== currentPanel;
      });
    }

    // Bind mode sub-tabs (light/dark) + Defaults tab
    function showDefaultsTab(defaultsActive) {
      const defPanel = document.getElementById('de-defaults-panel');
      ['left', 'center', 'right'].forEach(p => {
        const sub = document.getElementById(`de-subpanel-${p}`);
        if (sub) sub.hidden = defaultsActive || p !== currentPanel;
      });
      // Hide the Left/Center/Right sub-tab row while Defaults is active
      const panelTabsRow = document.querySelector('#settings-panel-dashboard-editor > .tt-subtabs:nth-of-type(2)');
      if (panelTabsRow) panelTabsRow.style.display = defaultsActive ? 'none' : '';
      if (defPanel) defPanel.hidden = !defaultsActive;
      document.getElementById('de-mode-defaults')?.classList.toggle('is-active', defaultsActive);
      if (!defaultsActive) {
        document.getElementById('de-mode-light')?.classList.toggle('is-active', currentMode === 'light');
        document.getElementById('de-mode-dark')?.classList.toggle('is-active', currentMode === 'dark');
      } else {
        document.getElementById('de-mode-light')?.classList.remove('is-active');
        document.getElementById('de-mode-dark')?.classList.remove('is-active');
      }
    }

    ['light', 'dark'].forEach(m => {
      const btn = document.getElementById(`de-mode-${m}`);
      if (btn && !btn.dataset.deModeBound) {
        btn.dataset.deModeBound = '1';
        btn.addEventListener('click', () => { currentMode = m; updateModeUI(); loadInputs(); showDefaultsTab(false); });
      }
    });
    const defBtn = document.getElementById('de-mode-defaults');
    if (defBtn && !defBtn.dataset.deDefBound) {
      defBtn.dataset.deDefBound = '1';
      defBtn.addEventListener('click', () => { renderArchiveList(); showDefaultsTab(true); });
    }
    // Restore defaults — prefer factory snapshot if saved, else built-in
    const restoreBtn = document.getElementById('de-restore-defaults');
    if (restoreBtn && !restoreBtn.dataset.deRestoreBound) {
      restoreBtn.dataset.deRestoreBound = '1';
      restoreBtn.addEventListener('click', () => {
        if (!confirm('Restore Dashboard Editor defaults?')) return;
        const factory = loadFactory();
        if (factory) {
          window.Settings.set(KEY, factory);
        } else {
          window.Settings.set(KEY, undefined);
          try { localStorage.removeItem(LEGACY_V2); } catch {}
          try { localStorage.removeItem(LEGACY_V1); } catch {}
        }
        const fresh = load();
        Object.assign(current, fresh);
        loadInputs();
        apply(fresh);
      });
    }

    // Save as defaults — capture current settings as factory defaults and archive prior
    const saveDefBtn = document.getElementById('de-save-defaults');
    if (saveDefBtn && !saveDefBtn.dataset.deSaveBound) {
      saveDefBtn.dataset.deSaveBound = '1';
      saveDefBtn.addEventListener('click', () => {
        const name = prompt('Name this defaults snapshot:', new Date().toLocaleString());
        if (!name) return;
        const prev = loadFactory();
        if (prev) {
          const archive = loadArchive();
          archive.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: (prev.__name || 'Previous defaults'),
            savedAt: prev.__savedAt || new Date().toISOString(),
            snap: prev,
          });
          saveArchive(archive);
        }
        const snap = JSON.parse(JSON.stringify(current));
        snap.__name = name;
        snap.__savedAt = new Date().toISOString();
        saveFactory(snap);
        alert('Saved as defaults.');
      });
    }

    const archiveList = document.getElementById('de-archive-list');
    function renderArchiveList() {
      archiveList.innerHTML = '';
      const list = loadArchive();
      if (list.length === 0) {
        archiveList.innerHTML = '<p style="margin:0;padding:8px;color:#6a7280;font-size:12px;">No archived defaults yet. Use "Save as defaults" to create snapshots.</p>';
        return;
      }
      list
        .slice()
        .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
        .forEach(item => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #eef0f2;';
          const info = document.createElement('div');
          info.style.cssText = 'flex:1;min-width:0;';
          const nm = document.createElement('div');
          nm.style.cssText = 'font-size:13px;font-weight:500;color:#1f2328;';
          nm.textContent = item.name;
          const dt = document.createElement('div');
          dt.style.cssText = 'font-size:11px;color:#6a7280;';
          dt.textContent = item.savedAt ? new Date(item.savedAt).toLocaleString() : '';
          info.appendChild(nm); info.appendChild(dt);

          const loadBtn = document.createElement('button');
          loadBtn.type = 'button'; loadBtn.className = 'button button-secondary';
          loadBtn.style.cssText = 'font-size:12px;padding:4px 10px;';
          loadBtn.textContent = 'Load';
          loadBtn.addEventListener('click', () => {
            if (!confirm(`Load "${item.name}" as current settings and factory defaults?`)) return;
            saveFactory(item.snap);
            window.Settings.set(KEY, item.snap);
            const fresh = load();
            Object.assign(current, fresh);
            loadInputs();
            apply(fresh);
          });

          const delBtn = document.createElement('button');
          delBtn.type = 'button'; delBtn.className = 'button button-secondary';
          delBtn.style.cssText = 'font-size:12px;padding:4px 10px;';
          delBtn.textContent = 'Delete';
          delBtn.addEventListener('click', () => {
            if (!confirm(`Delete "${item.name}"?`)) return;
            saveArchive(loadArchive().filter(x => x.id !== item.id));
            renderArchiveList();
          });

          row.appendChild(info); row.appendChild(loadBtn); row.appendChild(delBtn);
          archiveList.appendChild(row);
        });
    }
    // Bind panel sub-tabs
    ['left', 'center', 'right'].forEach(p => {
      const btn = document.getElementById(`de-subtab-${p}`);
      if (btn && !btn.dataset.dePanelBound) {
        btn.dataset.dePanelBound = '1';
        btn.addEventListener('click', () => { currentPanel = p; updatePanelUI(); });
      }
    });

    currentMode = isDarkActive() ? 'dark' : 'light';
    currentPanel = 'left';
    updateModeUI();
    updatePanelUI();

    if (panel.dataset.deBound !== '1') {
      panel.dataset.deBound = '1';
      Object.entries(ids).forEach(([id, path]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const [panelKey, group, key, cast] = path;
        const handler = () => {
          const raw = el.type === 'checkbox' ? el.checked : el.value;
          current[currentMode][panelKey][group][key] = cast ? cast(raw) : raw;
          window.Settings.set(KEY, current);
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      });
    }

    loadInputs();
  }

  function register() {
    if (!document.getElementById('page-title-editor')) return;
    if (!window.Settings) { setTimeout(register, 50); return; }
    window.Settings.registerTab({
      id: 'dashboard-editor',
      label: 'Dashboard Editor',
      panelId: 'settings-panel-dashboard-editor',
      onOpen: bindInputs,
      order: 21,
    });
    window.Settings.onChange(KEY, () => apply(load()));
    apply(load());
    setTimeout(() => apply(load()), 0);
    window.addEventListener('load', () => apply(load()), { once: true });

    const pageList = document.getElementById('page-list');
    if (pageList) {
      const listObs = new MutationObserver(() => apply(load()));
      listObs.observe(pageList, { childList: true, subtree: true });
    }
    const bodyObs = new MutationObserver(() => apply(load()));
    if (document.body) bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    else document.addEventListener('DOMContentLoaded', () => bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] }));
  }

  register();
})();
