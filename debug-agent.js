(function () {
  // Disable in production — only runs on localhost AND when ?debug=1 is present, or on any host with localStorage.debug=1
  const enabled =
    localStorage.getItem('debug') === '1' ||
    new URLSearchParams(location.search).has('debug');

  if (!enabled) return;

  const ENDPOINT = 'http://localhost:8765';

  function post(path, payload) {
    try {
      fetch(ENDPOINT + path, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  function log(entry) {
    entry.ts = Date.now();
    entry.page = location.pathname.split('/').pop() || 'index';
    post('/log', entry);
    // Also mirror to console so DevTools shows it
    try { console.log('[dbg]', entry); } catch {}
  }

  // Capture console.error and console.warn
  ['error', 'warn'].forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = function (...args) {
      try {
        log({ kind: 'console', level, args: args.map(safe) });
      } catch {}
      orig(...args);
    };
  });

  // Capture uncaught errors
  window.addEventListener('error', (e) => {
    log({
      kind: 'error',
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error && e.error.stack ? e.error.stack : null,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    log({
      kind: 'unhandledrejection',
      reason: safe(e.reason),
    });
  });

  // Periodic snapshot of key elements
  function describe(sel) {
    const el = document.querySelector(sel);
    if (!el) return { sel, present: false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      sel,
      present: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      display: cs.display,
      position: cs.position,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      flexDir: cs.flexDirection,
      gridCols: cs.gridTemplateColumns,
      visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden',
      childCount: el.children.length,
    };
  }

  function snapshot() {
    const sels = [
      'body',
      '.ws-topbar',
      '.cb-topbar',
      '.cb-layout',
      '.cb-canvas',
      '#cb-empty-state',
      '#cb-empty-new-grid',
      '#cb-empty-saved-grid',
      '.cb-empty-divider',
      '#cb-chart-area',
      '#settings-modal',
      '#settings-panel-library',
      '#settings-panel-toptabs',
      '#page-body-editor',
      '.cb-saved-chart-embed',
    ];
    const payload = {
      page: location.pathname,
      url: location.href,
      ts: Date.now(),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      userAgent: navigator.userAgent,
      elements: sels.map(describe),
      localStorageKeys: Object.keys(localStorage),
      styles: {
        dashboardEditor: (document.getElementById('dashboard-editor-custom-style') || {}).textContent || null,
        globalDark: (document.getElementById('global-dark-style') || {}).textContent || null,
        topTabs: (document.getElementById('top-tabs-custom-style') || {}).textContent || null,
      },
      bodyClass: document.body ? document.body.className : null,
      dashboardEditorState: (() => {
        try { return JSON.parse(localStorage.getItem('dashboard_editor_style_v3') || 'null'); }
        catch { return null; }
      })(),
    };
    post('/snapshot', payload);
  }

  function safe(v) {
    try {
      if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
      if (typeof v === 'object') return JSON.parse(JSON.stringify(v));
      return v;
    } catch {
      return String(v);
    }
  }

  // Snapshot on load, then every 3 seconds while tab is visible
  function tick() {
    if (document.visibilityState === 'visible') snapshot();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { snapshot(); setInterval(tick, 3000); });
  } else {
    snapshot();
    setInterval(tick, 3000);
  }

  // Expose a manual trigger
  window.__dbg = {
    snapshot,
    log: (msg, data) => log({ kind: 'manual', message: msg, data: safe(data) }),
    disable: () => { localStorage.removeItem('debug'); location.reload(); },
  };

  console.log('[dbg] agent active — posting to', ENDPOINT);
})();
