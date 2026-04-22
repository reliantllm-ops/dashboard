(function () {
  // "Saved states" tab: snapshots of Top bar + Chart Builder settings.

  const STATES_KEY = 'cb_saved_states_v1';
  const FACTORY_STATE_KEY = 'cb_factory_state_id_v1';
  const ACTIVE_STATE_KEY = 'cb_active_state_id_v1';
  const CAPTURED_KEYS = [
    'top_tabs_style_v1',
    'cb_new_chart_defaults_v1',
    'cb_splash_card_v1',
  ];
  let applyingSnapshot = false;

  function loadStates() {
    try { return JSON.parse(localStorage.getItem(STATES_KEY) || '[]') || []; }
    catch { return []; }
  }
  function saveStates(list) { localStorage.setItem(STATES_KEY, JSON.stringify(list)); }
  function getFactoryStateId() { return localStorage.getItem(FACTORY_STATE_KEY) || ''; }
  function setFactoryStateId(id) {
    if (id) localStorage.setItem(FACTORY_STATE_KEY, id);
    else localStorage.removeItem(FACTORY_STATE_KEY);
  }
  function getActiveStateId() { return localStorage.getItem(ACTIVE_STATE_KEY) || ''; }
  function setActiveStateId(id) {
    if (id) localStorage.setItem(ACTIVE_STATE_KEY, id);
    else localStorage.removeItem(ACTIVE_STATE_KEY);
  }

  function captureCurrent() {
    const snap = {};
    CAPTURED_KEYS.forEach(k => {
      const v = window.Settings?.get(k);
      if (v !== undefined) snap[k] = v;
    });
    return snap;
  }

  function applySnapshot(snap) {
    applyingSnapshot = true;
    CAPTURED_KEYS.forEach(k => {
      if (snap[k] !== undefined) window.Settings.set(k, snap[k]);
      else window.Settings.set(k, undefined);
    });
    applyingSnapshot = false;
  }

  function findStateById(id) {
    return loadStates().find(item => item.id === id) || null;
  }

  function restoreActiveState() {
    const activeId = getActiveStateId();
    if (!activeId) return;
    const item = findStateById(activeId);
    if (!item) {
      setActiveStateId('');
      return;
    }
    applySnapshot(item.snap || {});
  }

  function renderList() {
    const host = document.getElementById('ss-list');
    if (!host) return;
    const list = loadStates();
    const factoryId = getFactoryStateId();
    const activeId = getActiveStateId();
    host.innerHTML = '';
    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cb-saved-empty';
      empty.textContent = 'No saved states yet.';
      empty.style.padding = '8px 0';
      host.appendChild(empty);
      return;
    }
    list
      .slice()
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
      .forEach(item => {
        const row = document.createElement('div');
        row.className = 'ss-row';

        const info = document.createElement('div');
        info.className = 'ss-row-info';
        const name = document.createElement('div');
        name.className = 'ss-row-name';
        name.textContent = item.name;
        if (item.id === factoryId || item.id === activeId) {
          const badges = [];
          if (item.id === factoryId) badges.push('Factory default');
          if (item.id === activeId) badges.push('Current');
          name.textContent = `${item.name} (${badges.join(', ')})`;
        }
        const meta = document.createElement('div');
        meta.className = 'ss-row-meta';
        const d = item.savedAt ? new Date(item.savedAt).toLocaleString() : '';
        meta.textContent = d;
        info.appendChild(name);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'ss-row-actions';

        const load = document.createElement('button');
        load.type = 'button';
        load.className = 'button button-secondary';
        load.textContent = 'Load';
        load.addEventListener('click', () => {
          if (!confirm(`Load "${item.name}"? This overwrites current Top bar and Chart Builder settings.`)) return;
          setActiveStateId(item.id);
          applySnapshot(item.snap);
          renderList();
        });

        const factory = document.createElement('button');
        factory.type = 'button';
        factory.className = 'button button-secondary';
        factory.textContent = item.id === factoryId ? 'Factory default' : 'Make factory';
        factory.disabled = item.id === factoryId;
        factory.addEventListener('click', () => {
          setFactoryStateId(item.id);
          renderList();
        });

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'button button-secondary ss-delete';
        del.textContent = 'Delete';
        del.addEventListener('click', () => {
          if (!confirm(`Delete "${item.name}"?`)) return;
          const current = loadStates().filter(s => s.id !== item.id);
          if (item.id === factoryId) setFactoryStateId('');
          if (item.id === activeId) setActiveStateId('');
          saveStates(current);
          renderList();
        });

        actions.appendChild(load);
        actions.appendChild(factory);
        actions.appendChild(del);

        row.appendChild(info);
        row.appendChild(actions);
        host.appendChild(row);
      });
  }

  function bindPanel() {
    const save = document.getElementById('ss-save-current');
    if (save && !save.dataset.ssBound) {
      save.dataset.ssBound = '1';
      save.addEventListener('click', () => {
        const name = prompt('Name this saved state:');
        if (!name) return;
        const list = loadStates();
        list.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name,
          savedAt: new Date().toISOString(),
          snap: captureCurrent(),
        });
        saveStates(list);
        renderList();
      });
    }
    renderList();
  }

  function register() {
    if (!window.Settings) { setTimeout(register, 50); return; }
    window.Settings.registerTab({
      id: 'saved-states',
      label: 'Saved States',
      panelId: 'settings-panel-saved-states',
      onOpen: bindPanel,
      order: 50,
    });
    CAPTURED_KEYS.forEach((key) => {
      window.Settings.onChange(key, () => {
        if (applyingSnapshot) return;
        if (!getActiveStateId()) return;
        setActiveStateId('');
        renderList();
      });
    });
    setTimeout(restoreActiveState, 0);
  }

  register();
})();
