(function () {
  // Chart Builder-scoped preferences, lives in the shared Settings modal.

  const KEY = 'cb_prefs_v1';
  const defaults = { darkDefaults: false };

  function load() { return { ...defaults, ...(window.Settings?.get(KEY) || {}) }; }

  function bindInputs() {
    const panel = document.getElementById('settings-panel-cb');
    if (!panel) return;
    if (panel.dataset.cbBound === '1') return;
    panel.dataset.cbBound = '1';

    const current = load();
    const dark = document.getElementById('cb-prefs-dark');
    if (dark) {
      dark.checked = !!current.darkDefaults;
      dark.addEventListener('change', () => {
        current.darkDefaults = dark.checked;
        window.Settings.set(KEY, current);
      });
    }

    const restore = document.getElementById('cb-restore-defaults');
    if (restore) {
      restore.addEventListener('click', () => {
        if (!confirm('Clear all saved chart templates and new-chart defaults?')) return;
        localStorage.removeItem('cb_templates_v1');
        localStorage.removeItem('cb_new_chart_defaults_v1');
        if (typeof window.populateEmptyGrids === 'function') {
          window.populateEmptyGrids();
        }
        // Also re-mount the defaults editor so fields reset
        const defaultsHost = document.getElementById('cb-defaults-sections');
        if (defaultsHost && typeof window.mountNewChartDefaultsEditor === 'function') {
          window.mountNewChartDefaultsEditor(defaultsHost);
        }
      });
    }
  }

  function mountDefaultsEditor() {
    if (typeof window.mountNewChartDefaultsEditor !== 'function') return;
    const light = document.getElementById('cb-defaults-sections-light');
    const dark  = document.getElementById('cb-defaults-sections-dark');
    if (light) window.mountNewChartDefaultsEditor(light, 'light');
    if (dark)  window.mountNewChartDefaultsEditor(dark,  'dark');
  }

  function bindSubTabs() {
    const tabs = {
      light: { btn: document.getElementById('cb-subtab-light'), panel: document.getElementById('cb-subpanel-light') },
      dark:  { btn: document.getElementById('cb-subtab-dark'),  panel: document.getElementById('cb-subpanel-dark') },
      other: { btn: document.getElementById('cb-subtab-other'), panel: document.getElementById('cb-subpanel-other') },
    };
    function show(which) {
      Object.entries(tabs).forEach(([k, v]) => {
        if (v.btn) v.btn.classList.toggle('is-active', k === which);
        if (v.panel) v.panel.hidden = k !== which;
      });
    }
    Object.entries(tabs).forEach(([k, v]) => {
      if (v.btn && !v.btn.dataset.cbSubBound) {
        v.btn.dataset.cbSubBound = '1';
        v.btn.addEventListener('click', () => show(k));
      }
    });
    // Default to whichever mode is currently active
    const initial = document.body && document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    show(initial);
  }

  function register() {
    if (!window.Settings) { setTimeout(register, 50); return; }
    window.Settings.registerTab({
      id: 'cb',
      label: 'Chart Builder',
      panelId: 'settings-panel-cb',
      onOpen: () => {
        bindInputs();
        mountDefaultsEditor();
        bindSubTabs();
        if (window.bindSplashCardInputs) window.bindSplashCardInputs();
        if (window.bindCbPreviewSizeSlider) window.bindCbPreviewSizeSlider();
      },
      order: 40,
    });
  }

  register();
})();
