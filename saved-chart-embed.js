(function () {
  const STORAGE_KEY = 'cb_saved_charts_v1';

  function loadSavedCharts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  // ---------- Color / gradient helpers (mirror chart-builder.js) ----------
  function hexWithAlpha(hex, alpha) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function stopsToGradientArgs(stops) {
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    return sorted.map(s => ({ offset: s.position, color: hexWithAlpha(s.color, s.opacity) }));
  }

  function makeAngledLinearGradient(ctx, area, angleDeg, gStops) {
    if (!area) return gStops[0]?.color || 'rgba(0,0,0,0)';
    const cx = (area.left + area.right) / 2;
    const cy = (area.top + area.bottom) / 2;
    const w = area.right - area.left;
    const h = area.bottom - area.top;
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const len = Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h;
    const dx = (Math.cos(rad) * len) / 2;
    const dy = (Math.sin(rad) * len) / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    gStops.forEach(s => g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
    return g;
  }

  function makeRadialGradient(ctx, area, gStops) {
    if (!area) return gStops[0]?.color || 'rgba(0,0,0,0)';
    const cx = (area.left + area.right) / 2;
    const cy = (area.top + area.bottom) / 2;
    const r = Math.max(area.right - area.left, area.bottom - area.top) / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gStops.forEach(s => g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
    return g;
  }

  function resolveGradient(ctx, area, type, angle, stopObjs) {
    const gStops = stopsToGradientArgs(stopObjs);
    if (type === 'radial' || type === 'rectangular' || type === 'path') {
      return makeRadialGradient(ctx, area, gStops);
    }
    return makeAngledLinearGradient(ctx, area, angle, gStops);
  }

  function resolveLineStroke(ctx, area, fmt) {
    if (fmt.lineMode === 'gradient' && fmt.lineGradientStops?.length >= 2) {
      return resolveGradient(ctx, area, fmt.lineGradientType || 'linear', fmt.lineGradientAngle ?? 0, fmt.lineGradientStops);
    }
    return hexWithAlpha(fmt.lineColor, fmt.lineOpacity ?? 1);
  }

  function resolveFill(ctx, area, fmt) {
    if (fmt.fillMode === 'none') return 'transparent';
    if (fmt.fillMode === 'gradient' && fmt.fillGradientStops?.length >= 2) {
      return resolveGradient(ctx, area, fmt.fillGradientType || 'linear', fmt.fillGradientAngle ?? 90, fmt.fillGradientStops);
    }
    return hexWithAlpha(fmt.fillColor, fmt.fillOpacity ?? 0.2);
  }

  function buildPalette(baseHex, count) {
    const m = baseHex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16) / 255;
    const g = parseInt(m.substring(2, 4), 16) / 255;
    const b = parseInt(m.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = 0; s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = ((b - r) / d + 2); break;
        default: h = ((r - g) / d + 4);
      }
      h *= 60;
    }
    const sP = s * 100, lP = l * 100;
    const hslToHex = (hh, ss, ll) => {
      ss /= 100; ll /= 100;
      const k = n => (n + hh / 30) % 12;
      const a = ss * Math.min(ll, 1 - ll);
      const f = n => {
        const c = ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return Math.round(255 * c).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };
    const out = [];
    for (let i = 0; i < count; i++) {
      const hh = (h + (360 / Math.max(count, 1)) * i) % 360;
      out.push(hslToHex(hh, sP, lP));
    }
    return out;
  }

  function lineStyleToDash(styleId, weight) {
    const map = {
      solid: null,
      dashed: [4, 3],
      dotted: [1, 2],
      'long-dash': [8, 3],
      'dash-dot': [5, 3, 1, 3],
    };
    const f = map[styleId];
    if (!f) return [];
    return f.map(n => Math.max(1, Math.round(n * (weight / 2))));
  }

  // ---------- Render a saved chart into a canvas ----------
  function renderSavedChart(canvas, state) {
    if (!window.Chart) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const { type, title, labels, values, color, lineFormat, series, points } = state;
    const chartJsTypeMap = { area: 'line', donut: 'doughnut', column: 'bar', grouped: 'bar', stacked: 'bar', histogram: 'bar' };
    const chartJsType = chartJsTypeMap[type] || type;

    let datasets;
    if (type === 'grouped' || type === 'stacked') {
      datasets = (series || []).map(sr => ({
        label: sr.label,
        data: sr.values,
        backgroundColor: hexWithAlpha(sr.color, lineFormat?.fillOpacity ?? 1),
        borderColor: sr.color,
        borderWidth: lineFormat?.lineWeight ?? 1,
      }));
    } else if (type === 'scatter') {
      datasets = [{ label: title, data: points, backgroundColor: hexWithAlpha(color, 0.8), borderColor: color, pointRadius: lineFormat?.plotSize ?? 4, pointStyle: lineFormat?.plotStyle || 'circle' }];
    } else if (type === 'bubble') {
      datasets = [{ label: title, data: points, backgroundColor: hexWithAlpha(color, 0.6), borderColor: color, borderWidth: lineFormat?.lineWeight ?? 1 }];
    } else {
      const dataset = { label: title, data: values };
      if (type === 'donut' || type === 'pie') {
        dataset.backgroundColor = buildPalette(color, values.length);
        dataset.borderColor = '#ffffff';
        dataset.borderWidth = 2;
      } else if (type === 'radar') {
        dataset.borderColor = color;
        dataset.backgroundColor = hexWithAlpha(color, lineFormat?.fillOpacity ?? 0.3);
        dataset.pointBackgroundColor = color;
        dataset.borderWidth = lineFormat?.lineWeight ?? 2;
      } else if (type === 'line' || type === 'area') {
        dataset.tension = 0.3;
        dataset.fill = lineFormat.fillMode !== 'none';
        dataset.borderColor = (ctx) => resolveLineStroke(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.backgroundColor = (ctx) => resolveFill(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.pointBackgroundColor = hexWithAlpha(lineFormat.plotColor || lineFormat.lineColor, lineFormat.plotOpacity ?? 1);
        dataset.pointBorderColor = hexWithAlpha(lineFormat.plotColor || lineFormat.lineColor, lineFormat.plotOpacity ?? 1);
        dataset.pointStyle = lineFormat.plotStyle || 'circle';
        dataset.pointRadius = lineFormat.plotSize ?? 3;
        dataset.borderWidth = lineFormat.lineWeight ?? 2;
        dataset.borderDash = lineStyleToDash(lineFormat.lineStyle, lineFormat.lineWeight ?? 2);
      } else {
        dataset.borderColor = (ctx) => resolveLineStroke(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.backgroundColor = (ctx) => resolveFill(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.borderWidth = lineFormat.lineWeight ?? (lineFormat.fillMode === 'none' ? 2 : 1);
        if (type === 'histogram') { dataset.barPercentage = 1.0; dataset.categoryPercentage = 1.0; }
      }
      datasets = [dataset];
    }

    const cf = state.chartFormat || {};
    const gridIsGradient = cf.gridMode === 'gradient' && cf.gridGradientStops?.length >= 2;
    const gridSolid = hexWithAlpha(cf.gridColor ?? '#d5d9de', cf.gridOpacity ?? 1);
    const gridColor = gridIsGradient ? 'rgba(0,0,0,0)' : gridSolid;

    const surroundPlugin = {
      id: 'cb-embed-surround',
      beforeDraw(c) {
        const { ctx, chartArea, width, height } = c;
        if (!chartArea) return;
        const mode = cf.surroundMode ?? 'solid';
        const wholeArea = { left: 0, top: 0, right: width, bottom: height };
        let fillStyle;
        if (mode === 'gradient' && cf.surroundGradientStops?.length >= 2) {
          fillStyle = resolveGradient(ctx, wholeArea, cf.surroundGradientType || 'linear', cf.surroundGradientAngle ?? 90, cf.surroundGradientStops);
        } else {
          fillStyle = hexWithAlpha(cf.surroundColor ?? '#ffffff', cf.surroundOpacity ?? 1);
        }
        ctx.save();
        ctx.fillStyle = fillStyle;
        ctx.fillRect(0, 0, width, chartArea.top);
        ctx.fillRect(0, chartArea.bottom, width, height - chartArea.bottom);
        ctx.fillRect(0, chartArea.top, chartArea.left, chartArea.bottom - chartArea.top);
        ctx.fillRect(chartArea.right, chartArea.top, width - chartArea.right, chartArea.bottom - chartArea.top);
        ctx.restore();
      },
    };

    const bgPlugin = {
      id: 'cb-embed-background',
      beforeDraw(c) {
        const { ctx, chartArea } = c;
        if (!chartArea) return;
        const mode = cf.bgMode ?? 'solid';
        let fillStyle;
        if (mode === 'gradient' && cf.bgGradientStops?.length >= 2) {
          fillStyle = resolveGradient(ctx, chartArea, cf.bgGradientType || 'linear', cf.bgGradientAngle ?? 90, cf.bgGradientStops);
        } else {
          fillStyle = hexWithAlpha(cf.bgColor ?? '#ffffff', cf.bgOpacity ?? 1);
        }
        ctx.save();
        ctx.fillStyle = fillStyle;
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        ctx.restore();
      },
    };

    const gridGradientPlugin = {
      id: 'cb-embed-grid-gradient',
      beforeDatasetsDraw(c) {
        if (!gridIsGradient) return;
        const { ctx, chartArea, scales } = c;
        if (!chartArea) return;
        const stroke = resolveGradient(ctx, chartArea, cf.gridGradientType || 'linear', cf.gridGradientAngle ?? 90, cf.gridGradientStops);
        ctx.save();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        if (scales.x?.ticks) {
          scales.x.ticks.forEach((_, i) => {
            const x = scales.x.getPixelForTick(i);
            ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
          });
        }
        if (scales.y?.ticks) {
          scales.y.ticks.forEach((_, i) => {
            const y = scales.y.getPixelForTick(i);
            ctx.beginPath(); ctx.moveTo(chartArea.left, y); ctx.lineTo(chartArea.right, y); ctx.stroke();
          });
        }
        ctx.restore();
      },
    };

    const indexAxis = type === 'bar' ? 'y' : 'x';
    const hasCategorical = !(type === 'scatter' || type === 'bubble' || type === 'radar' || type === 'pie' || type === 'donut');
    const showLegend = type === 'donut' || type === 'pie' || type === 'grouped' || type === 'stacked' || type === 'radar';

    let scales = {};
    if (type === 'radar') {
      scales = { r: { grid: { color: gridColor } } };
    } else if (type !== 'pie' && type !== 'donut') {
      scales = {
        x: { grid: { color: gridColor } },
        y: { beginAtZero: true, grid: { color: gridColor } },
      };
      if (type === 'stacked') { scales.x.stacked = true; scales.y.stacked = true; }
    }

    // If background is dark, force readable white text/ticks
    const textColor = cf.textColor || (isDarkHex(cf.bgColor) ? '#ffffff' : '#1f2328');
    // Apply text color to scales
    Object.values(scales).forEach(sc => {
      sc.ticks = { ...(sc.ticks || {}), color: textColor };
      if (!sc.grid) sc.grid = {};
    });

    new Chart(canvas, {
      type: chartJsType,
      data: hasCategorical ? { labels, datasets } : { datasets },
      options: {
        indexAxis,
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        color: textColor,
        plugins: {
          title: { display: !!title, text: title, font: { size: 14, weight: '600' }, color: textColor },
          legend: { display: showLegend, labels: { color: textColor } },
        },
        scales,
      },
      plugins: [surroundPlugin, bgPlugin, gridGradientPlugin],
    });
  }

  function isDarkHex(hex) {
    if (!hex) return false;
    const m = hex.replace('#', '');
    if (m.length < 6) return false;
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    // relative luminance
    const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return L < 0.5;
  }

  // ---------- Insertion + resize ----------
  function decodeState(attr) {
    try { return JSON.parse(decodeURIComponent(attr)); } catch { return null; }
  }
  function encodeState(obj) {
    return encodeURIComponent(JSON.stringify(obj));
  }

  function renderAllEmbeds(root) {
    if (!window.Chart) return;
    const scope = root || document;
    scope.querySelectorAll('.cb-saved-chart-embed').forEach(el => {
      const state = decodeState(el.getAttribute('data-chart-state'));
      if (!state) return;
      // Clean any attribute serialized cache from previous render
      el.removeAttribute('data-cb-rendered');
      delete el.dataset.cbRendered;

      let canvas = el.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        el.insertBefore(canvas, el.firstChild);
      }
      // Only render if no chart is attached to this canvas yet.
      if (!Chart.getChart(canvas)) {
        renderSavedChart(canvas, state);
      }
      attachResize(el);
      attachSelectAndDrag(el);
    });
  }

  function getPositioningHost(el) {
    // Prefer the nearest meaningful ancestor: tab panel > text block > editor root.
    const tabPanel = el.closest('.tabbed-container-panel');
    if (tabPanel) {
      const cs = getComputedStyle(tabPanel);
      if (cs.position === 'static') tabPanel.style.position = 'relative';
      return tabPanel;
    }
    const block = el.closest('.editor-text-block');
    if (block) {
      const cs = getComputedStyle(block);
      if (cs.position === 'static') block.style.position = 'relative';
      return block;
    }
    const editor = findEditorRoot();
    if (editor && getComputedStyle(editor).position === 'static') editor.style.position = 'relative';
    return editor || document.body;
  }

  function deselectAll() {
    document.querySelectorAll('.cb-saved-chart-embed.is-selected').forEach(el => {
      el.classList.remove('is-selected');
    });
  }

  function attachSelectAndDrag(el) {
    // Remove any stale flag from a previous HTML serialization round-trip.
    el.removeAttribute('data-cb-drag-attached');
    delete el.dataset.cbDragAttached;
    if (el._cbDragAttached) return;
    el._cbDragAttached = true;

    el.addEventListener('mousedown', e => {
      if (e.target.classList.contains('cb-saved-chart-resize')) return;
      deselectAll();
      el.classList.add('is-selected');
      e.stopPropagation();
    });

    el.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('cb-saved-chart-resize')) return;
      if (e.button !== 0) return;

      const host = getPositioningHost(el);
      const hostRect = host.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      // Switch to absolute positioning in the host
      const currentLeft = elRect.left - hostRect.left;
      const currentTop = elRect.top - hostRect.top;
      el.style.position = 'absolute';
      el.style.left = `${currentLeft}px`;
      el.style.top = `${currentTop}px`;
      el.style.margin = '0';

      const offsetX = e.clientX - elRect.left;
      const offsetY = e.clientY - elRect.top;

      let moved = false;
      el.setPointerCapture(e.pointerId);

      const onMove = ev => {
        moved = true;
        const hr = host.getBoundingClientRect();
        const newLeft = Math.max(0, ev.clientX - hr.left - offsetX);
        const newTop = Math.max(0, ev.clientY - hr.top - offsetY);
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
      };
      const onUp = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        if (moved) {
          document.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
    });
  }

  document.addEventListener('mousedown', e => {
    if (!e.target.closest('.cb-saved-chart-embed')) {
      deselectAll();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const target = e.target;
    // Don't steal Delete inside text inputs/contenteditable when no chart is selected
    const selected = document.querySelector('.cb-saved-chart-embed.is-selected');
    if (!selected) return;
    // Ignore if user is typing in an input/textarea
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    const chart = window.Chart && Chart.getChart(selected.querySelector('canvas'));
    if (chart) chart.destroy();
    selected.remove();
    document.dispatchEvent(new Event('input', { bubbles: true }));
  });

  function attachResize(el) {
    // Always replace the handle so we never stack duplicate listeners after HTML round-trips.
    const oldHandle = el.querySelector('.cb-saved-chart-resize');
    if (oldHandle) oldHandle.remove();
    const handle = document.createElement('div');
    handle.className = 'cb-saved-chart-resize';
    handle.contentEditable = 'false';
    el.appendChild(handle);
    let startX, startY, startW, startH;
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX; startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startW = rect.width; startH = rect.height;
      handle.setPointerCapture(e.pointerId);

      const onMove = ev => {
        const newW = Math.max(200, startW + (ev.clientX - startX));
        const newH = Math.max(120, startH + (ev.clientY - startY));
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
        const chart = Chart.getChart(el.querySelector('canvas'));
        if (chart) chart.resize();
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        document.dispatchEvent(new Event('input', { bubbles: true }));
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }

  function buildEmbedHTML(state) {
    const encoded = encodeState(state);
    return `<div class="cb-saved-chart-embed" data-chart-state="${encoded}" style="width: 480px; height: 300px;" contenteditable="false"><canvas></canvas></div>`;
  }

  function findEditorRoot() {
    return document.getElementById('page-body-editor');
  }

  function findClosestTextBlock(node) {
    let el = node;
    while (el) {
      if (el.nodeType === 1 && el.classList && el.classList.contains('editor-text-block')) return el;
      el = el.parentNode;
    }
    return null;
  }

  function insertEmbedAtCursor(state) {
    const html = buildEmbedHTML(state);
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const node = temp.firstElementChild;

    const editor = findEditorRoot();
    if (!editor) {
      document.body.appendChild(node);
      renderAllEmbeds();
      return;
    }

    const host = resolveHost();

    if (host && host.kind === 'tabPanel') {
      host.el.appendChild(node);
      renderAllEmbeds();
      document.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    if (host && host.kind === 'textBlock') {
      // Append inside the text block (at the end), then add an empty paragraph after so the caret lands cleanly
      const block = host.el;
      block.appendChild(node);
      const trailingP = document.createElement('p');
      trailingP.innerHTML = '<br>';
      block.appendChild(trailingP);
      renderAllEmbeds();
      document.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // No recent caret in editor — append a new text block containing the chart
    const newBlock = document.createElement('div');
    newBlock.className = 'editor-text-block';
    newBlock.setAttribute('data-body-text-block', 'true');
    newBlock.setAttribute('contenteditable', 'true');
    newBlock.innerHTML = '<p></p>';
    editor.appendChild(newBlock);
    newBlock.appendChild(node);
    renderAllEmbeds();
    document.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---------- Chart menu wiring ----------
  function populateSavedMenu() {
    const list = document.getElementById('chart-menu-saved-list');
    if (!list) return;
    list.innerHTML = '';
    const saved = loadSavedCharts();
    if (saved.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'chart-menu-empty';
      empty.textContent = 'No saved charts yet.';
      list.appendChild(empty);
      return;
    }
    saved
      .slice()
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
      .forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chart-menu-item chart-menu-saved-item';
        btn.textContent = item.name;
        btn.addEventListener('click', () => {
          insertEmbedAtCursor(item.state);
          const dropdown = document.getElementById('chart-menu-dropdown');
          if (dropdown) dropdown.hidden = true;
          const trigger = document.getElementById('chart-menu-trigger');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
        list.appendChild(btn);
      });
  }

  // Track the last editor host where the user had focus (tab panel or text block).
  let lastHostInfo = null;

  function captureHost() {
    const editor = findEditorRoot();
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    const node = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode;
    if (!node || !editor.contains(node)) return;

    const tabPanel = node.closest?.('.tabbed-container-panel');
    if (tabPanel) {
      const container = tabPanel.closest('.tabbed-container-block');
      lastHostInfo = {
        kind: 'tabPanel',
        containerId: container?.getAttribute('data-block-id') || null,
      };
      return;
    }
    const textBlock = findClosestTextBlock(node);
    if (textBlock) {
      lastHostInfo = {
        kind: 'textBlock',
        blockId: textBlock.getAttribute('data-block-id') || null,
        offsetAtEnd: true,
      };
    }
  }
  document.addEventListener('selectionchange', captureHost);

  function resolveHost() {
    const editor = findEditorRoot();
    if (!editor || !lastHostInfo) return null;

    if (lastHostInfo.kind === 'tabPanel') {
      // Find the active tab panel within the stored container. If container id is null, fall back to the first tab panel.
      let container = null;
      if (lastHostInfo.containerId) {
        container = editor.querySelector(`.tabbed-container-block[data-block-id="${lastHostInfo.containerId}"]`);
      }
      if (!container) container = editor.querySelector('.tabbed-container-block');
      const panel = container?.querySelector('.tabbed-container-panel');
      if (panel) return { kind: 'tabPanel', el: panel };
    }

    if (lastHostInfo.kind === 'textBlock') {
      let block = null;
      if (lastHostInfo.blockId) {
        block = editor.querySelector(`.editor-text-block[data-block-id="${lastHostInfo.blockId}"]`);
      }
      if (!block) {
        const allBlocks = editor.querySelectorAll('.editor-text-block');
        block = allBlocks[allBlocks.length - 1] || null;
      }
      if (block) return { kind: 'textBlock', el: block };
    }
    return null;
  }

  function watchChartMenu() {
    const trigger = document.getElementById('chart-menu-trigger');
    if (!trigger) return;
    trigger.addEventListener('mousedown', captureHost);
    trigger.addEventListener('click', () => {
      setTimeout(populateSavedMenu, 0);
    });
  }

  // ---------- Init ----------
  function init() {
    if (!window.Chart) {
      // Chart.js not loaded yet — retry briefly
      setTimeout(init, 50);
      return;
    }
    renderAllEmbeds();
    watchChartMenu();

    let pending = false;
    const scheduleRender = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        renderAllEmbeds();
      });
    };

    const editor = findEditorRoot();
    if (editor) {
      const mo = new MutationObserver(scheduleRender);
      mo.observe(editor, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-chart-state'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.cbSavedCharts = { loadSavedCharts, renderAllEmbeds, insertEmbedAtCursor };
})();
