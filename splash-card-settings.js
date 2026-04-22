(function () {
  // Chart Builder splash-card styling (per-mode: light/dark).

  const KEY = 'cb_splash_card_v1';
  const lightDefaults = {
    background: '#ffffff', borderColor: '#e3e5e8', borderWidth: 1,
    labelColor: '#1f2328', labelSize: 13,
    frameBackground: '#ffffff', frameBorderColor: '#e3e5e8', frameBorderWidth: 1, frameRadius: 6,
  };
  const darkDefaults  = {
    background: '#232629', borderColor: '#3a3f45', borderWidth: 1,
    labelColor: '#e6e6e6', labelSize: 13,
    frameBackground: '#1a1d21', frameBorderColor: '#3a3f45', frameBorderWidth: 1, frameRadius: 6,
  };

  function load() {
    const raw = window.Settings?.get(KEY) || {};
    if (!raw.light && !raw.dark) {
      return {
        light: { ...lightDefaults, ...raw },
        dark: { ...darkDefaults },
      };
    }
    return {
      light: { ...lightDefaults, ...(raw.light || {}) },
      dark:  { ...darkDefaults,  ...(raw.dark  || {}) },
    };
  }

  function isDarkActive() { return document.body && document.body.classList.contains('dark-mode'); }

  function getActiveVariant() {
    const cfg = load();
    return isDarkActive() ? cfg.dark : cfg.light;
  }

  function apply(cfg) {
    const variant = isDarkActive() ? cfg.dark : cfg.light;
    let styleEl = document.getElementById('cb-splash-card-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'cb-splash-card-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      .cb-empty-grid > .cb-saved-card {
        background: ${variant.background} !important;
        border: ${variant.borderWidth}px solid ${variant.borderColor} !important;
      }
      .cb-empty-grid .cb-saved-card-name {
        color: ${variant.labelColor} !important;
        font-size: ${variant.labelSize}px !important;
      }
      .cb-empty-grid .cb-saved-card-preview {
        background: ${variant.frameBackground} !important;
        border: ${variant.frameBorderWidth}px solid ${variant.frameBorderColor} !important;
        border-radius: ${variant.frameRadius}px !important;
      }
    `;
  }

  function bindInputs(mode) {
    const prefix = `cb-card-${mode}-`;
    const ids = {
      [`${prefix}background`]: 'background',
      [`${prefix}border-color`]: 'borderColor',
      [`${prefix}border-width`]: ['borderWidth', Number],
      [`${prefix}label-color`]: 'labelColor',
      [`${prefix}label-size`]: ['labelSize', Number],
      [`${prefix}frame-background`]: 'frameBackground',
      [`${prefix}frame-border-color`]: 'frameBorderColor',
      [`${prefix}frame-border-width`]: ['frameBorderWidth', Number],
      [`${prefix}frame-radius`]: ['frameRadius', Number],
    };
    const current = load();
    Object.entries(ids).forEach(([id, path]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const key = Array.isArray(path) ? path[0] : path;
      el.value = current[mode][key];
      if (el.dataset.scBound === '1') return;
      el.dataset.scBound = '1';
      const cast = Array.isArray(path) ? path[1] : null;
      const handler = () => {
        const v = cast ? cast(el.value) : el.value;
        current[mode][key] = v;
        window.Settings.set(KEY, current);
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  // Called when the Chart Builder tab opens
  window.bindSplashCardInputs = function () {
    bindInputs('light');
    bindInputs('dark');
  };
  window.getSplashCardStyleConfig = getActiveVariant;

  function register() {
    if (!window.Settings) { setTimeout(register, 50); return; }
    window.Settings.onChange(KEY, () => apply(load()));
    apply(load());
    document.addEventListener('DOMContentLoaded', () => apply(load()), { once: true });
    window.addEventListener('load', () => apply(load()), { once: true });
    setTimeout(() => {
      if (typeof window.populateEmptyGrids === 'function') window.populateEmptyGrids();
    }, 0);
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof window.populateEmptyGrids === 'function') window.populateEmptyGrids();
    }, { once: true });
    window.addEventListener('load', () => {
      if (typeof window.populateEmptyGrids === 'function') window.populateEmptyGrids();
    }, { once: true });
    // Re-apply on dark-mode toggle
    const obs = new MutationObserver(() => apply(load()));
    if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    else document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { attributes: true, attributeFilter: ['class'] }));
  }

  register();
})();
