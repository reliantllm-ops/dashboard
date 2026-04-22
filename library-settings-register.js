(function () {
  // Registers the existing Library panel (which firebase-workspace.js owns)
  // with the shared Settings module, and wires the standalone outline-thickness
  // slider that lives inside the Library panel.

  function bindOutlineThickness() {
    const input = document.getElementById('library-outline-thickness-input');
    const readout = document.getElementById('library-outline-thickness-value');
    if (!input || !readout) return;
    if (input.dataset.ttBound === '1') return;
    input.dataset.ttBound = '1';

    try {
      const cssVal = getComputedStyle(document.documentElement).getPropertyValue('--library-page-active-outline-width').trim();
      const n = parseInt(cssVal, 10);
      if (!isNaN(n)) { input.value = n; readout.textContent = `${n}px`; }
    } catch {}

    input.addEventListener('input', () => {
      const v = Math.max(0, Math.min(8, parseInt(input.value, 10) || 0));
      readout.textContent = `${v}px`;
      document.documentElement.style.setProperty('--library-page-active-outline-width', `${v}px`);
      try {
        const raw = localStorage.getItem('engineering-workspace-ui-settings');
        if (raw) {
          const s = JSON.parse(raw);
          if (!s.librarySelection) s.librarySelection = {};
          s.librarySelection.outlineWeight = v;
          localStorage.setItem('engineering-workspace-ui-settings', JSON.stringify(s));
        }
      } catch {}
    });
  }

  function register() {
    if (!window.Settings) { setTimeout(register, 50); return; }
    window.Settings.registerTab({
      id: 'library',
      label: 'Library',
      panelId: 'settings-panel-library',
      onOpen: bindOutlineThickness,
      order: 30,
    });
  }

  register();
})();
