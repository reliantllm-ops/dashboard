(function () {
  // Site-wide theme settings (accent color, dark mode).

  const KEY = 'global_theme_v1';
  const defaults = { dark: false };

  function load() {
    return { ...defaults, ...(window.Settings?.get(KEY) || {}) };
  }

  function apply(cfg) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => apply(cfg), { once: true });
      return;
    }
    document.body.classList.toggle('dark-mode', !!cfg.dark);
    if (!document.getElementById('global-dark-style')) {
      const style = document.createElement('style');
      style.id = 'global-dark-style';
      // Every selector below uses :not(.settings-modal, .settings-modal *, .settings-modal-backdrop)
      // so the settings modal remains completely unaffected by dark mode.
      const SKIP = ':not(.settings-modal):not(.settings-modal *):not(.settings-modal-backdrop)';
      style.textContent = `
        body.dark-mode${SKIP} {
          background: #1a1d21 !important;
          color: #e6e6e6 !important;
        }
        body.dark-mode.cb-body${SKIP},
        body.dark-mode .workspace-shell${SKIP},
        body.dark-mode .sidebar${SKIP},
        body.dark-mode .card${SKIP},
        body.dark-mode .editor-toolbar-bar${SKIP},
        body.dark-mode .ws-topbar${SKIP},
        body.dark-mode .cb-topbar${SKIP},
        body.dark-mode .dashboard-bottom-bar${SKIP} {
          background: #1a1d21 !important;
          color: #e6e6e6 !important;
          border-color: #2d3136 !important;
        }
        body.dark-mode .sidebar-panel${SKIP},
        body.dark-mode .page-item${SKIP} {
          background: #232629 !important;
          color: #e6e6e6 !important;
        }
        body.dark-mode .page-title-editor${SKIP},
        body.dark-mode .body-editor${SKIP},
        body.dark-mode .body-editor p${SKIP},
        body.dark-mode .body-editor h1${SKIP},
        body.dark-mode .body-editor h2${SKIP},
        body.dark-mode .body-editor h3${SKIP},
        body.dark-mode .body-editor li${SKIP},
        body.dark-mode .editor-text-block${SKIP} {
          color: #ffffff !important;
        }
        body.dark-mode .page-title-editor:empty::before${SKIP} {
          color: rgba(255, 255, 255, 0.45) !important;
        }
        body.dark-mode .toolbar-button${SKIP},
        body.dark-mode .toolbar-select${SKIP},
        body.dark-mode .cb-topbar-button${SKIP},
        body.dark-mode .button-secondary${SKIP} {
          background: #2d3136 !important;
          color: #e6e6e6 !important;
          border-color: #3a3f45 !important;
        }
        body.dark-mode .cb-canvas${SKIP},
        body.dark-mode .cb-side-panel${SKIP} {
          background: #1a1d21 !important;
          color: #e6e6e6 !important;
        }
        body.dark-mode .cb-section${SKIP} {
          background: #232629 !important;
          border-color: #3a3f45 !important;
        }
        body.dark-mode .cb-section-body${SKIP} {
          background: #1a1d21 !important;
        }
        body.dark-mode .cb-side-panel-header .section-label${SKIP},
        body.dark-mode .cb-side-close${SKIP},
        body.dark-mode .cb-field${SKIP},
        body.dark-mode .cb-field label${SKIP},
        body.dark-mode .cb-field-hint${SKIP},
        body.dark-mode .cb-section-summary${SKIP},
        body.dark-mode .cb-section-summary::before${SKIP},
        body.dark-mode .cb-empty-heading${SKIP},
        body.dark-mode .cb-saved-empty${SKIP},
        body.dark-mode .cb-chart-modal-help${SKIP} {
          color: #e6e6e6 !important;
        }
        body.dark-mode input${SKIP},
        body.dark-mode select${SKIP},
        body.dark-mode textarea${SKIP} {
          background: #2d3136 !important;
          color: #e6e6e6 !important;
          border-color: #3a3f45 !important;
        }
        /* Tab area (tabbed container) in dark mode — matches light mode's style structure */
        body.dark-mode .tabbed-container-block${SKIP} {
          background: #2b2f33 !important;
          border-color: #4a5058 !important;
          color: #f0f2f5 !important;
        }
        body.dark-mode .tabbed-container-tabs${SKIP} {
          background: transparent !important;
          border-color: #4a5058 !important;
        }
        body.dark-mode .tabbed-container-tab${SKIP} {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #b8bec5 !important;
          border: 0 !important;
        }
        body.dark-mode .tabbed-container-tab:hover${SKIP} {
          background: rgba(255, 255, 255, 0.14) !important;
          color: #ffffff !important;
        }
        body.dark-mode .tabbed-container-tab.is-active${SKIP} {
          background: rgba(255, 255, 255, 0.82) !important;
          color: #1f2328 !important;
          box-shadow: inset 0 0 0 1px rgba(110, 168, 254, 0.4) !important;
        }
        body.dark-mode .tabbed-container-tab-label${SKIP} {
          color: inherit !important;
        }
        body.dark-mode .tabbed-container-content${SKIP},
        body.dark-mode .tabbed-container-panel${SKIP} {
          background: #2b2f33 !important;
          color: #f0f2f5 !important;
        }
        body.dark-mode .tabbed-container-controls${SKIP} {
          background: transparent !important;
        }
        body.dark-mode .tabbed-container-control${SKIP} {
          background: rgba(255, 255, 255, 0.88) !important;
          color: #1f2328 !important;
          border: 0 !important;
        }
        body.dark-mode .tabbed-container-control:hover${SKIP} {
          background: #ffffff !important;
          color: #000000 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  function bindInputs() {
    const panel = document.getElementById('settings-panel-global');
    if (!panel) return;
    if (panel.dataset.gsBound === '1') return;
    panel.dataset.gsBound = '1';

    const current = load();
    const dark = document.getElementById('gs-dark');
    if (dark) {
      dark.checked = !!current.dark;
      dark.addEventListener('change', () => {
        current.dark = dark.checked;
        window.Settings.set(KEY, current);
      });
    }
  }

  function register() {
    if (!window.Settings) { setTimeout(register, 50); return; }
    window.Settings.registerTab({
      id: 'global',
      label: 'Global',
      panelId: 'settings-panel-global',
      onOpen: bindInputs,
      order: 10,
    });
    window.Settings.onChange(KEY, () => apply(load()));
    apply(load());
  }

  register();
})();
