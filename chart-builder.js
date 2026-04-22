(function () {
  const layout = document.querySelector('.cb-layout');
  const sidePanel = document.getElementById('cb-side-panel');
  const sidePanelBody = document.getElementById('cb-side-panel-body');
  const sideCloseBtn = document.getElementById('cb-side-close');
  const emptyState = document.getElementById('cb-empty-state');
  const chartWrapper = document.getElementById('cb-chart-wrapper');
  const chartArea = document.getElementById('cb-chart-area');
  const chartCanvas = document.getElementById('cb-chart');

  let chart = null;
  let state = null;

  const PREFS_KEY = 'cb_prefs_v1';
  function loadPrefs() {
    try { return { darkDefaults: false, ...(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')) }; }
    catch { return { darkDefaults: false }; }
  }
  function savePrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }
  let prefs = loadPrefs();

  // User overrides to apply to every NEW chart, split by mode.
  const NEW_DEFAULTS_KEY = 'cb_new_chart_defaults_v1';
  function loadAllNewDefaults() {
    try {
      const raw = JSON.parse(localStorage.getItem(NEW_DEFAULTS_KEY) || '{}') || {};
      // Back-compat: legacy flat {chartFormat, lineFormat} stored as single config
      if (raw.light || raw.dark) return { light: raw.light || {}, dark: raw.dark || {} };
      return { light: raw, dark: {} };
    } catch { return { light: {}, dark: {} }; }
  }
  function saveAllNewDefaults(v) { localStorage.setItem(NEW_DEFAULTS_KEY, JSON.stringify(v)); }
  function isDarkActive() { return document.body && document.body.classList.contains('dark-mode'); }
  function loadNewDefaults(mode) {
    const all = loadAllNewDefaults();
    return all[mode || (isDarkActive() ? 'dark' : 'light')] || {};
  }
  // Merge user defaults on top of a fresh state.
  function applyNewDefaults(s, mode) {
    const nd = loadNewDefaults(mode);
    if (nd.chartFormat) {
      s.chartFormat = { ...(s.chartFormat || {}), ...JSON.parse(JSON.stringify(nd.chartFormat)) };
    }
    if (nd.lineFormat && s.lineFormat) {
      s.lineFormat = { ...s.lineFormat, ...JSON.parse(JSON.stringify(nd.lineFormat)) };
    }
    return s;
  }

  function applyDarkToState(s) {
    // Mutate state to use dark-theme palette
    if (!s.chartFormat) s.chartFormat = {};
    const cf = s.chartFormat;
    cf.bgMode = 'solid'; cf.bgColor = '#1f2328'; cf.bgOpacity = 1;
    cf.surroundMode = 'solid'; cf.surroundColor = '#1f2328'; cf.surroundOpacity = 1;
    cf.gridMode = 'solid'; cf.gridColor = '#3a3f45'; cf.gridOpacity = 1;
    cf.textColor = '#ffffff';
    // Use a brighter accent for data
    if (s.color) s.color = '#6ea8fe';
    if (s.lineFormat) {
      s.lineFormat.lineColor = '#6ea8fe';
      s.lineFormat.fillColor = '#6ea8fe';
      s.lineFormat.plotColor = '#6ea8fe';
    }
    if (Array.isArray(s.series)) {
      const palette = ['#6ea8fe', '#f7a072', '#5ddc9a', '#f2c94c', '#c084fc'];
      s.series.forEach((sr, i) => { sr.color = palette[i % palette.length]; });
    }
    return s;
  }

  const CHART_TYPES = [
    { id: 'bar',       label: 'Bar chart' },
    { id: 'column',    label: 'Column chart' },
    { id: 'grouped',   label: 'Grouped bar chart' },
    { id: 'stacked',   label: 'Stacked bar chart' },
    { id: 'area',      label: 'Area chart' },
    { id: 'pie',       label: 'Pie chart' },
    { id: 'donut',     label: 'Donut chart' },
    { id: 'scatter',   label: 'Scatter plot' },
    { id: 'bubble',    label: 'Bubble chart' },
    { id: 'histogram', label: 'Histogram' },
  ];

  const defaultLineFormat = () => ({
    lineStyle: 'solid',          // 'solid' | 'dashed' | 'dotted' | 'long-dash' | 'dash-dot'
    lineWeight: 2,               // px
    lineMode: 'solid',           // 'solid' | 'gradient'
    lineColor: '#3f6ad8',
    lineOpacity: 1,
    lineGradientType: 'linear',  // 'linear' | 'radial' | 'rectangular' | 'path'
    lineGradientAngle: 90,       // degrees (0 = left→right, 90 = top→bottom)
    lineGradientStops: [
      { position: 0, color: '#ffffff', opacity: 1 },
      { position: 1, color: '#999999', opacity: 1 },
    ],
    fillMode: 'solid',           // 'solid' | 'gradient' | 'none'
    fillColor: '#3f6ad8',
    fillOpacity: 0.2,
    fillGradientType: 'linear',
    fillGradientAngle: 90,
    fillGradientStops: [
      { position: 0, color: '#3f6ad8', opacity: 0.45 },
      { position: 1, color: '#ffffff', opacity: 0 },
    ],
    plotMode: 'solid',
    plotColor: '#3f6ad8',
    plotOpacity: 1,
    plotStyle: 'circle',         // circle | triangle | rect | rectRot | rectRounded | cross | crossRot | star | dash | line
    plotSize: 3,
    plotGradientType: 'linear',
    plotGradientAngle: 90,
    plotGradientStops: [
      { position: 0, color: '#ffffff', opacity: 1 },
      { position: 1, color: '#999999', opacity: 1 },
    ],
  });

  const defaults = {
    bar: {
      title: 'Bar Chart',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      values: [12, 19, 7, 14, 22],
      color: '#3f6ad8',
      lineFormat: defaultLineFormat(),
    },
    column: {
      title: 'Column Chart',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      values: [12, 19, 7, 14, 22],
      color: '#3f6ad8',
      lineFormat: defaultLineFormat(),
    },
    grouped: {
      title: 'Grouped Bar Chart',
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      series: [
        { label: 'Series A', values: [12, 19, 7, 14], color: '#3f6ad8' },
        { label: 'Series B', values: [9, 14, 11, 17], color: '#e97132' },
      ],
      lineFormat: defaultLineFormat(),
    },
    stacked: {
      title: 'Stacked Bar Chart',
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      series: [
        { label: 'Series A', values: [12, 19, 7, 14], color: '#3f6ad8' },
        { label: 'Series B', values: [9, 14, 11, 17], color: '#e97132' },
      ],
      lineFormat: defaultLineFormat(),
    },
    line: {
      title: 'Line Chart',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      values: [12, 19, 7, 14, 22],
      color: '#3f6ad8',
      lineFormat: { ...defaultLineFormat(), fillMode: 'none' },
    },
    area: {
      title: 'Area Chart',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      values: [12, 19, 7, 14, 22],
      color: '#3f6ad8',
      lineFormat: { ...defaultLineFormat(), fillMode: 'gradient' },
    },
    pie: {
      title: 'Pie Chart',
      labels: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      values: [30, 25, 25, 20],
      color: '#3f6ad8',
      lineFormat: defaultLineFormat(),
    },
    donut: {
      title: 'Donut Chart',
      labels: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      values: [30, 25, 25, 20],
      color: '#3f6ad8',
      lineFormat: defaultLineFormat(),
    },
    scatter: {
      title: 'Scatter Plot',
      points: [
        { x: 1, y: 5 }, { x: 2, y: 8 }, { x: 3, y: 6 }, { x: 4, y: 10 },
        { x: 5, y: 7 }, { x: 6, y: 12 }, { x: 7, y: 9 }, { x: 8, y: 14 },
      ],
      color: '#3f6ad8',
      lineFormat: defaultLineFormat(),
    },
    bubble: {
      title: 'Bubble Chart',
      points: [
        { x: 1, y: 5, r: 8 }, { x: 2, y: 8, r: 12 }, { x: 3, y: 6, r: 6 },
        { x: 4, y: 10, r: 14 }, { x: 5, y: 7, r: 10 }, { x: 6, y: 12, r: 16 },
      ],
      color: '#3f6ad8',
      lineFormat: defaultLineFormat(),
    },
    radar: {
      title: 'Radar Chart',
      labels: ['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency'],
      values: [65, 59, 90, 81, 56],
      color: '#3f6ad8',
      lineFormat: defaultLineFormat(),
    },
    histogram: {
      title: 'Histogram',
      labels: ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70'],
      values: [3, 7, 14, 22, 16, 9, 4],
      color: '#3f6ad8',
      lineFormat: defaultLineFormat(),
    },
  };

  function openPanel() {
    sidePanel.hidden = false;
    layout.classList.add('cb-panel-open');
  }

  function applySplashCardAppearance(card, preview, name) {
    const cfg = typeof window.getSplashCardStyleConfig === 'function'
      ? window.getSplashCardStyleConfig()
      : null;
    if (!cfg) return;
    if (card) {
      card.style.background = cfg.background;
      card.style.border = `${cfg.borderWidth}px solid ${cfg.borderColor}`;
    }
    if (preview) {
      preview.style.background = cfg.frameBackground;
      preview.style.border = `${cfg.frameBorderWidth}px solid ${cfg.frameBorderColor}`;
      preview.style.borderRadius = `${cfg.frameRadius}px`;
    }
    if (name) {
      name.style.color = cfg.labelColor;
      name.style.fontSize = `${cfg.labelSize}px`;
    }
  }

  function closePanel() {
    sidePanel.hidden = true;
    layout.classList.remove('cb-panel-open');
  }

  function showChart() {
    emptyState.hidden = true;
    chartWrapper.hidden = false;
    if (chartArea) chartArea.hidden = false;
  }

  function buildPalette(baseHex, count) {
    const base = hexToHsl(baseHex);
    const out = [];
    for (let i = 0; i < count; i++) {
      const h = (base.h + (360 / Math.max(count, 1)) * i) % 360;
      out.push(hslToHex(h, base.s, base.l));
    }
    return out;
  }

  function hexToHsl(hex) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16) / 255;
    const g = parseInt(m.substring(2, 4), 16) / 255;
    const b = parseInt(m.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
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
    return { h, s: s * 100, l: l * 100 };
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function hexWithAlpha(hex, alpha) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function makeLinearGradient(ctx, area, direction, stops) {
    if (!area) return stops[0].color;
    const g = direction === 'vertical'
      ? ctx.createLinearGradient(0, area.top, 0, area.bottom)
      : ctx.createLinearGradient(area.left, 0, area.right, 0);
    stops.forEach(s => g.addColorStop(s.offset, s.color));
    return g;
  }

  function stopsToGradientArgs(stops) {
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    return sorted.map(s => ({ offset: s.position, color: hexWithAlpha(s.color, s.opacity) }));
  }

  function makeAngledLinearGradient(ctx, area, angleDeg, stops) {
    if (!area) return stops[0].color;
    const cx = (area.left + area.right) / 2;
    const cy = (area.top + area.bottom) / 2;
    const w = area.right - area.left;
    const h = area.bottom - area.top;
    const rad = ((angleDeg - 90) * Math.PI) / 180; // 0deg = top→bottom in CSS; adjust so 90 = horizontal like PP linear-right
    // project gradient axis so it spans the full area
    const len = Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h;
    const dx = (Math.cos(rad) * len) / 2;
    const dy = (Math.sin(rad) * len) / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    stops.forEach(s => g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
    return g;
  }

  function makeRadialGradient(ctx, area, stops) {
    if (!area) return stops[0].color;
    const cx = (area.left + area.right) / 2;
    const cy = (area.top + area.bottom) / 2;
    const r = Math.max(area.right - area.left, area.bottom - area.top) / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    stops.forEach(s => g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
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
    if (fmt.lineMode === 'gradient' && fmt.lineGradientStops.length >= 2) {
      return resolveGradient(ctx, area, fmt.lineGradientType || 'linear', fmt.lineGradientAngle ?? 0, fmt.lineGradientStops);
    }
    return hexWithAlpha(fmt.lineColor, fmt.lineOpacity ?? 1);
  }

  function resolveFill(ctx, area, fmt) {
    if (fmt.fillMode === 'none') return 'transparent';
    if (fmt.fillMode === 'gradient' && fmt.fillGradientStops.length >= 2) {
      return resolveGradient(ctx, area, fmt.fillGradientType || 'linear', fmt.fillGradientAngle ?? 90, fmt.fillGradientStops);
    }
    return hexWithAlpha(fmt.fillColor, fmt.fillOpacity);
  }

  function chartJsTypeFor(type) {
    switch (type) {
      case 'area': return 'line';
      case 'donut': return 'doughnut';
      case 'column': return 'bar';
      case 'grouped': return 'bar';
      case 'stacked': return 'bar';
      case 'histogram': return 'bar';
      default: return type;
    }
  }

  function renderChart() {
    if (!state) return;
    showChart();

    if (chart) {
      chart.destroy();
      chart = null;
    }

    const { type, title, labels, values, color, lineFormat, series, points } = state;
    const chartJsType = chartJsTypeFor(type);

    let datasets;

    if (type === 'grouped' || type === 'stacked') {
      datasets = (series || []).map(s => ({
        label: s.label,
        data: s.values,
        backgroundColor: hexWithAlpha(s.color, lineFormat.fillOpacity ?? 1),
        borderColor: s.color,
        borderWidth: lineFormat.lineWeight ?? 1,
      }));
    } else if (type === 'scatter') {
      datasets = [{
        label: title,
        data: points,
        backgroundColor: hexWithAlpha(color, 0.8),
        borderColor: color,
        pointStyle: lineFormat.plotStyle || 'circle',
        pointRadius: lineFormat.plotSize ?? 5,
      }];
    } else if (type === 'bubble') {
      datasets = [{
        label: title,
        data: points,
        backgroundColor: hexWithAlpha(color, 0.6),
        borderColor: color,
        borderWidth: lineFormat.lineWeight ?? 1,
      }];
    } else {
      const dataset = { label: title, data: values };
      if (type === 'donut' || type === 'pie') {
        const pieColors = ['#3f6ad8', '#e97132'];
        const alpha = lineFormat?.fillOpacity ?? 0.2;
        dataset.backgroundColor = values.map((_, i) => hexWithAlpha(pieColors[i % pieColors.length], alpha));
        dataset.borderColor = pieColors.map((c, i) => pieColors[i % pieColors.length]);
        dataset.borderWidth = 1;
      } else if (type === 'radar') {
        dataset.borderColor = color;
        dataset.backgroundColor = hexWithAlpha(color, lineFormat.fillOpacity ?? 0.3);
        dataset.pointBackgroundColor = color;
        dataset.pointRadius = lineFormat.plotSize ?? 3;
        dataset.borderWidth = lineFormat.lineWeight ?? 2;
      } else if (type === 'line' || type === 'area') {
        dataset.tension = 0.3;
        dataset.pointRadius = 3;
        dataset.fill = lineFormat.fillMode !== 'none';
        dataset.borderColor = (ctx) => resolveLineStroke(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.backgroundColor = (ctx) => resolveFill(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.pointBackgroundColor = hexWithAlpha(lineFormat.plotColor, lineFormat.plotOpacity ?? 1);
        dataset.pointBorderColor = hexWithAlpha(lineFormat.plotColor, lineFormat.plotOpacity ?? 1);
        dataset.pointStyle = lineFormat.plotStyle || 'circle';
        dataset.pointRadius = lineFormat.plotSize ?? 3;
        dataset.borderWidth = lineFormat.lineWeight ?? 2;
        dataset.borderDash = lineStyleToDash(lineFormat.lineStyle, lineFormat.lineWeight ?? 2);
      } else {
        // bar, column, histogram
        dataset.borderColor = (ctx) => resolveLineStroke(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.backgroundColor = (ctx) => resolveFill(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.borderWidth = lineFormat.lineWeight ?? (lineFormat.fillMode === 'none' ? 2 : 1);
        if (type === 'histogram') {
          dataset.barPercentage = 1.0;
          dataset.categoryPercentage = 1.0;
        }
      }
      datasets = [dataset];
    }

    const cf = state.chartFormat || {};
    const gridIsGradient = cf.gridMode === 'gradient' && cf.gridGradientStops && cf.gridGradientStops.length >= 2;
    const gridSolid = hexWithAlpha(cf.gridColor ?? '#d5d9de', cf.gridOpacity ?? 1);
    const gridColor = gridIsGradient ? 'rgba(0,0,0,0)' : gridSolid;

    const surroundPlugin = {
      id: 'cb-surround',
      beforeDraw(chart) {
        const { ctx, chartArea, width, height } = chart;
        if (!chartArea) return;
        const mode = cf.surroundMode ?? 'solid';
        const wholeArea = { left: 0, top: 0, right: width, bottom: height };
        let fillStyle;
        if (mode === 'gradient' && cf.surroundGradientStops && cf.surroundGradientStops.length >= 2) {
          fillStyle = resolveGradient(ctx, wholeArea, cf.surroundGradientType || 'linear', cf.surroundGradientAngle ?? 90, cf.surroundGradientStops);
        } else {
          fillStyle = hexWithAlpha(cf.surroundColor ?? '#ffffff', cf.surroundOpacity ?? 1);
        }
        ctx.save();
        ctx.fillStyle = fillStyle;
        // Paint the four strips around the chart area
        ctx.fillRect(0, 0, width, chartArea.top);
        ctx.fillRect(0, chartArea.bottom, width, height - chartArea.bottom);
        ctx.fillRect(0, chartArea.top, chartArea.left, chartArea.bottom - chartArea.top);
        ctx.fillRect(chartArea.right, chartArea.top, width - chartArea.right, chartArea.bottom - chartArea.top);
        ctx.restore();
      },
    };

    const bgPlugin = {
      id: 'cb-background',
      beforeDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const mode = cf.bgMode ?? 'solid';
        let fillStyle;
        if (mode === 'gradient' && cf.bgGradientStops && cf.bgGradientStops.length >= 2) {
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
      id: 'cb-grid-gradient',
      beforeDatasetsDraw(chart) {
        if (!gridIsGradient) return;
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        const stroke = resolveGradient(ctx, chartArea, cf.gridGradientType || 'linear', cf.gridGradientAngle ?? 90, cf.gridGradientStops);
        ctx.save();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        // X axis (vertical lines)
        if (scales.x && scales.x.ticks) {
          scales.x.ticks.forEach((t, i) => {
            const x = scales.x.getPixelForTick(i);
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();
          });
        }
        // Y axis (horizontal lines)
        if (scales.y && scales.y.ticks) {
          scales.y.ticks.forEach((t, i) => {
            const y = scales.y.getPixelForTick(i);
            ctx.beginPath();
            ctx.moveTo(chartArea.left, y);
            ctx.lineTo(chartArea.right, y);
            ctx.stroke();
          });
        }
        ctx.restore();
      },
    };

    const indexAxis = type === 'bar' ? 'y' : 'x';
    const hasCategorical = !(type === 'scatter' || type === 'bubble' || type === 'radar' || type === 'pie' || type === 'donut');
    const showLegend = type === 'donut' || type === 'pie' || type === 'grouped' || type === 'stacked' || type === 'radar';

    const scales = {};
    if (type === 'radar') {
      scales.r = { grid: { color: gridColor } };
    } else if (type === 'pie' || type === 'donut') {
      // no axes
    } else {
      scales.x = { grid: { color: gridColor } };
      scales.y = { beginAtZero: true, grid: { color: gridColor } };
      if (type === 'stacked') {
        scales.x.stacked = true;
        scales.y.stacked = true;
      }
    }

    // Dark-bg contrast for text/ticks
    const isDark = (h) => {
      if (!h) return false;
      const m = h.replace('#', '');
      if (m.length < 6) return false;
      const r = parseInt(m.substring(0, 2), 16), g = parseInt(m.substring(2, 4), 16), b = parseInt(m.substring(4, 6), 16);
      return ((0.299 * r + 0.587 * g + 0.114 * b) / 255) < 0.5;
    };
    const textColor = cf.textColor || (isDark(cf.bgColor) ? '#ffffff' : '#1f2328');
    Object.values(scales).forEach(sc => {
      sc.ticks = { ...(sc.ticks || {}), color: textColor };
      if (!sc.grid) sc.grid = {};
    });

    const config = {
      type: chartJsType,
      data: hasCategorical ? { labels, datasets } : { datasets },
      options: {
        indexAxis,
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        animations: { colors: false, x: false, y: false },
        transitions: { active: { animation: { duration: 0 } } },
        color: textColor,
        plugins: {
          title: { display: !!title, text: title, font: { size: 16, weight: '600' }, color: textColor },
          legend: { display: showLegend, labels: { color: textColor } },
        },
        scales,
      },
      plugins: [surroundPlugin, bgPlugin, gridGradientPlugin],
    };

    chart = new Chart(chartCanvas, config);
  }

  function buildControls() {
    sidePanelBody.innerHTML = '';

    sidePanelBody.appendChild(field('Title', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = state.title;
      input.addEventListener('input', e => {
        state.title = e.target.value;
        renderChart();
      });
      return input;
    }));

    sidePanelBody.appendChild(buildDataSection());
    sidePanelBody.appendChild(buildBackgroundAxisSection());

    if (state.type === 'donut') {
      sidePanelBody.appendChild(field('Base color', () => {
        const wrap = document.createElement('div');
        wrap.className = 'cb-field-inline';
        const input = document.createElement('input');
        input.type = 'color';
        input.value = state.color;
        input.addEventListener('input', e => {
          state.color = e.target.value;
          renderChart();
        });
        const hint = document.createElement('span');
        hint.className = 'cb-field-hint';
        hint.textContent = 'Slices rotate around this hue.';
        wrap.appendChild(input);
        wrap.appendChild(hint);
        return wrap;
      }));
    } else {
      sidePanelBody.appendChild(buildLinePlotFormatSection());
    }
  }

  function buildDataSection() {
    const details = document.createElement('details');
    details.className = 'cb-section';
    details.open = false;

    const summary = document.createElement('summary');
    summary.className = 'cb-section-summary';
    summary.textContent = 'Data';
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'cb-section-body';
    details.appendChild(body);

    body.appendChild(field('Labels (comma separated)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cb-data-input';
      input.value = state.labels.join(', ');
      input.addEventListener('input', e => {
        state.labels = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        syncValuesLength();
        renderChart();
      });
      return input;
    }));

    body.appendChild(field('Values (comma separated)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cb-data-input';
      input.value = state.values.join(', ');
      input.addEventListener('input', e => {
        const nums = e.target.value.split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n));
        state.values = nums;
        renderChart();
      });
      return input;
    }));

    return details;
  }

  function buildBackgroundAxisSection() {
    const details = document.createElement('details');
    details.className = 'cb-section';

    const summary = document.createElement('summary');
    summary.className = 'cb-section-summary';
    summary.textContent = 'Background/Axis';
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'cb-section-body';
    details.appendChild(body);

    if (!state.chartFormat) state.chartFormat = {};
    const cf = state.chartFormat;
    if (cf.bgMode == null) cf.bgMode = 'solid';
    if (cf.bgColor == null) cf.bgColor = '#ffffff';
    if (cf.bgOpacity == null) cf.bgOpacity = 1;
    if (cf.bgGradientType == null) cf.bgGradientType = 'linear';
    if (cf.bgGradientAngle == null) cf.bgGradientAngle = 90;
    if (!cf.bgGradientStops) cf.bgGradientStops = [
      { position: 0, color: '#ffffff', opacity: 1 },
      { position: 1, color: '#e5e7eb', opacity: 1 },
    ];
    if (cf.surroundMode == null) cf.surroundMode = 'solid';
    if (cf.surroundColor == null) cf.surroundColor = '#ffffff';
    if (cf.surroundOpacity == null) cf.surroundOpacity = 1;
    if (cf.surroundGradientType == null) cf.surroundGradientType = 'linear';
    if (cf.surroundGradientAngle == null) cf.surroundGradientAngle = 90;
    if (!cf.surroundGradientStops) cf.surroundGradientStops = [
      { position: 0, color: '#ffffff', opacity: 1 },
      { position: 1, color: '#e5e7eb', opacity: 1 },
    ];
    if (cf.gridMode == null) cf.gridMode = 'solid';
    if (cf.gridColor == null) cf.gridColor = '#d5d9de';
    if (cf.gridOpacity == null) cf.gridOpacity = 1;
    if (cf.gridGradientType == null) cf.gridGradientType = 'linear';
    if (cf.gridGradientAngle == null) cf.gridGradientAngle = 90;
    if (!cf.gridGradientStops) cf.gridGradientStops = [
      { position: 0, color: '#d5d9de', opacity: 1 },
      { position: 1, color: '#d5d9de', opacity: 1 },
    ];

    body.appendChild(buildColorRow('Background', cf, 'bg', 'bgOpacity'));
    body.appendChild(makeHSep());
    body.appendChild(buildColorRow('Surrounding', cf, 'surround', 'surroundOpacity'));
    body.appendChild(makeHSep());
    body.appendChild(buildColorRow('Grid', cf, 'grid', 'gridOpacity'));

    return details;
  }

  function buildLinePlotFormatSection() {
    const details = document.createElement('details');
    details.className = 'cb-section';
    details.open = false;

    const summary = document.createElement('summary');
    summary.className = 'cb-section-summary';
    summary.textContent = 'Line/Plot Format';
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'cb-section-body';
    details.appendChild(body);

    const fmt = state.lineFormat;

    // --- Fill first, then Line + Line style + Line weight ---
    body.appendChild(buildColorRow('Fill', fmt, 'fill', 'fillOpacity'));
    body.appendChild(makeHSep());
    const lineRow = buildColorRow(state.type === 'bar' ? 'Border' : 'Line', fmt, 'line', 'lineOpacity');
    lineRow.classList.add('cb-line-sub');
    body.appendChild(lineRow);
    const styleRow = buildLineStyleRow(fmt);
    styleRow.classList.add('cb-line-sub');
    body.appendChild(styleRow);
    body.appendChild(buildLineWeightRow(fmt));
    if (state.type === 'line' || state.type === 'area') {
      body.appendChild(makeHSep());
      const plotsRow = buildColorRow('Plots', fmt, 'plot', 'plotOpacity');
      plotsRow.classList.add('cb-line-sub');
      body.appendChild(plotsRow);
      body.appendChild(buildPlotStyleRow(fmt));
    }

    return details;
  }

  function modeSelect(options, current, onChange) {
    const sel = document.createElement('select');
    sel.className = 'cb-mode-select';
    options.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v[0].toUpperCase() + v.slice(1);
      if (current === v) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', e => onChange(e.target.value));
    return sel;
  }

  function barePicker(value, onChange) {
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'cb-bare-color';
    input.value = value;
    input.addEventListener('input', e => onChange(e.target.value));
    return input;
  }

  const THEME_COLORS = [
    ['#000000', '#7F7F7F', '#595959', '#3F3F3F', '#262626', '#0D0D0D'],
    ['#FFFFFF', '#F2F2F2', '#D9D9D9', '#BFBFBF', '#A6A6A6', '#7F7F7F'],
    ['#4A90E2', '#D9E8F9', '#B6D1F3', '#92BAED', '#376CAB', '#254871'],
    ['#E97132', '#FCE2D6', '#F9C5AC', '#F6A883', '#AF5526', '#753919'],
    ['#196B24', '#D1E1D3', '#A3C3A7', '#75A67B', '#13501B', '#0D3612'],
    ['#156082', '#D0DFE6', '#A1BEDD', '#729DB3', '#104862', '#0B3041'],
    ['#A02B93', '#EBD5EA', '#D7ABD4', '#C381BF', '#78206E', '#50164A'],
    ['#4EA72E', '#DCEFD5', '#B9DFAA', '#97CF80', '#3B7D23', '#275417'],
    ['#0F9ED5', '#CFEBF6', '#9FD7ED', '#6FC3E4', '#0B76A0', '#084F6B'],
    ['#D83B01', '#F7D7CC', '#EFB099', '#E78966', '#A22C01', '#6C1E01'],
  ];

  const STANDARD_COLORS = [
    '#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050',
    '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0',
  ];

  function makeHSep() {
    const s = document.createElement('div');
    s.className = 'cb-hsep';
    return s;
  }

  const LINE_STYLES = [
    { id: 'solid',     label: 'Solid',     dashFactor: null },
    { id: 'dashed',    label: 'Dashed',    dashFactor: [4, 3] },
    { id: 'dotted',    label: 'Dotted',    dashFactor: [1, 2] },
    { id: 'long-dash', label: 'Long dash', dashFactor: [8, 3] },
    { id: 'dash-dot',  label: 'Dash-dot',  dashFactor: [5, 3, 1, 3] },
  ];

  const LINE_WEIGHTS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 6];

  function lineStyleToDash(styleId, weight) {
    const s = LINE_STYLES.find(x => x.id === styleId);
    if (!s || !s.dashFactor) return [];
    return s.dashFactor.map(n => Math.max(1, Math.round(n * (weight / 2))));
  }

  function renderLineStylePreview(styleId) {
    const dash = lineStyleToDash(styleId, 2);
    const dashArr = dash.length ? dash.join(' ') : '';
    return `<svg width="80" height="10" viewBox="0 0 80 10" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="5" x2="78" y2="5" stroke="#1f2328" stroke-width="2" ${dashArr ? `stroke-dasharray="${dashArr}"` : ''} stroke-linecap="${styleId === 'dotted' ? 'round' : 'butt'}" />
    </svg>`;
  }

  function buildLineStyleRow(fmt) {
    const row = document.createElement('div');
    row.className = 'cb-color-row';
    const label = document.createElement('span');
    label.className = 'cb-inline-label cb-color-row-label';
    label.textContent = 'Line Style';
    row.appendChild(label);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cb-linestyle-trigger';
    trigger.innerHTML = renderLineStylePreview(fmt.lineStyle || 'solid');

    const popup = document.createElement('div');
    popup.className = 'cb-linestyle-popup';
    popup.hidden = true;

    let currentOff = null;
    function closePopup() {
      popup.hidden = true;
      if (currentOff) {
        document.removeEventListener('mousedown', currentOff);
        currentOff = null;
      }
    }

    LINE_STYLES.forEach(s => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cb-linestyle-item';
      item.innerHTML = renderLineStylePreview(s.id);
      item.title = s.label;
      item.addEventListener('click', e => {
        e.stopPropagation();
        fmt.lineStyle = s.id;
        trigger.innerHTML = renderLineStylePreview(s.id);
        closePopup();
        renderChart();
      });
      popup.appendChild(item);
    });

    const wrap = document.createElement('div');
    wrap.className = 'cb-linestyle-wrap';
    wrap.appendChild(trigger);
    wrap.appendChild(popup);
    row.appendChild(wrap);

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      if (popup.hidden) {
        popup.hidden = false;
        const rect = trigger.getBoundingClientRect();
        popup.style.top = `${rect.bottom + 4}px`;
        popup.style.left = `${rect.left}px`;
        setTimeout(() => {
          currentOff = ev => {
            if (!wrap.contains(ev.target) && !popup.contains(ev.target)) {
              closePopup();
            }
          };
          document.addEventListener('mousedown', currentOff);
        }, 0);
      } else {
        closePopup();
      }
    });

    return row;
  }

  const PLOT_STYLES = [
    { id: 'circle',       label: 'Circle' },
    { id: 'rect',         label: 'Square' },
    { id: 'triangle',     label: 'Triangle' },
    { id: 'rectRot',      label: 'Diamond' },
    { id: 'rectRounded',  label: 'Rounded' },
    { id: 'cross',        label: 'Cross' },
    { id: 'crossRot',     label: 'X' },
    { id: 'star',         label: 'Star' },
    { id: 'dash',         label: 'Dash' },
    { id: 'line',         label: 'Line' },
  ];

  function renderPlotShape(styleId) {
    const size = 14, c = 7, r = 4;
    let shape = '';
    switch (styleId) {
      case 'rect':
        shape = `<rect x="${c-r}" y="${c-r}" width="${r*2}" height="${r*2}" fill="#1f2328"/>`;
        break;
      case 'triangle': {
        const h = r * Math.sqrt(3);
        shape = `<polygon points="${c},${c-h/1.5} ${c-r},${c+h/3} ${c+r},${c+h/3}" fill="#1f2328"/>`;
        break;
      }
      case 'rectRot':
        shape = `<polygon points="${c},${c-r} ${c+r},${c} ${c},${c+r} ${c-r},${c}" fill="#1f2328"/>`;
        break;
      case 'rectRounded':
        shape = `<rect x="${c-r}" y="${c-r}" width="${r*2}" height="${r*2}" rx="2" ry="2" fill="#1f2328"/>`;
        break;
      case 'cross':
        shape = `<line x1="${c}" y1="${c-r}" x2="${c}" y2="${c+r}" stroke="#1f2328" stroke-width="2"/><line x1="${c-r}" y1="${c}" x2="${c+r}" y2="${c}" stroke="#1f2328" stroke-width="2"/>`;
        break;
      case 'crossRot':
        shape = `<line x1="${c-r}" y1="${c-r}" x2="${c+r}" y2="${c+r}" stroke="#1f2328" stroke-width="2"/><line x1="${c+r}" y1="${c-r}" x2="${c-r}" y2="${c+r}" stroke="#1f2328" stroke-width="2"/>`;
        break;
      case 'star': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 === 0 ? r : r / 2;
          pts.push(`${c + rr * Math.cos(ang)},${c + rr * Math.sin(ang)}`);
        }
        shape = `<polygon points="${pts.join(' ')}" fill="#1f2328"/>`;
        break;
      }
      case 'dash':
        shape = `<line x1="${c-r}" y1="${c}" x2="${c+r}" y2="${c}" stroke="#1f2328" stroke-width="2"/>`;
        break;
      case 'line':
        shape = `<line x1="0" y1="${c}" x2="${size}" y2="${c}" stroke="#1f2328" stroke-width="2"/>`;
        break;
      case 'circle':
      default:
        shape = `<circle cx="${c}" cy="${c}" r="${r}" fill="#1f2328"/>`;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${shape}</svg>`;
  }

  function buildPlotStyleRow(fmt) {
    const row = document.createElement('div');
    row.className = 'cb-color-row';
    const label = document.createElement('span');
    label.className = 'cb-inline-label cb-color-row-label';
    label.textContent = 'Plot Style';
    row.appendChild(label);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cb-linestyle-trigger';
    const triggerInner = document.createElement('span');
    triggerInner.className = 'cb-plotstyle-trigger-inner';
    triggerInner.innerHTML = renderPlotShape(fmt.plotStyle || 'circle') +
      ` <span class="cb-plotstyle-name">${(PLOT_STYLES.find(p => p.id === fmt.plotStyle) || PLOT_STYLES[0]).label}</span>`;
    trigger.appendChild(triggerInner);

    const popup = document.createElement('div');
    popup.className = 'cb-linestyle-popup';
    popup.hidden = true;

    let currentOff = null;
    function closePopup() {
      popup.hidden = true;
      if (currentOff) {
        document.removeEventListener('mousedown', currentOff);
        currentOff = null;
      }
    }

    PLOT_STYLES.forEach(s => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cb-linestyle-item cb-plotstyle-item';
      item.innerHTML = renderPlotShape(s.id) + `<span class="cb-plotstyle-name">${s.label}</span>`;
      item.title = s.label;
      item.addEventListener('click', e => {
        e.stopPropagation();
        fmt.plotStyle = s.id;
        triggerInner.innerHTML = renderPlotShape(s.id) + ` <span class="cb-plotstyle-name">${s.label}</span>`;
        closePopup();
        renderChart();
      });
      popup.appendChild(item);
    });

    const wrap = document.createElement('div');
    wrap.className = 'cb-linestyle-wrap';
    wrap.appendChild(trigger);
    wrap.appendChild(popup);
    row.appendChild(wrap);

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      if (popup.hidden) {
        popup.hidden = false;
        const rect = trigger.getBoundingClientRect();
        popup.style.top = `${rect.bottom + 4}px`;
        popup.style.left = `${rect.left}px`;
        setTimeout(() => {
          currentOff = ev => {
            if (!wrap.contains(ev.target) && !popup.contains(ev.target)) closePopup();
          };
          document.addEventListener('mousedown', currentOff);
        }, 0);
      } else {
        closePopup();
      }
    });

    return row;
  }

  function buildLineWeightRow(fmt) {
    const row = document.createElement('div');
    row.className = 'cb-color-row';
    const label = document.createElement('span');
    label.className = 'cb-inline-label cb-color-row-label';
    label.textContent = 'Line Weight';
    row.appendChild(label);

    const sel = document.createElement('select');
    sel.className = 'cb-lineweight-select';
    LINE_WEIGHTS.forEach(w => {
      const o = document.createElement('option');
      o.value = String(w);
      o.textContent = `${w} pt`;
      if (Math.abs((fmt.lineWeight ?? 2) - w) < 0.01) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', e => {
      fmt.lineWeight = Number(e.target.value);
      renderChart();
    });
    row.appendChild(sel);

    return row;
  }

  function buildColorRow(labelText, fmt, channel, opacityKey) {
    const row = document.createElement('div');
    row.className = 'cb-color-row';

    const label = document.createElement('span');
    label.className = 'cb-inline-label cb-color-row-label';
    label.textContent = labelText;
    row.appendChild(label);

    const trigger = swatchPickerTrigger(fmt, channel,
      () => { renderChart(); },
      (anchor, repaint) => {
        openGradientPopup(anchor, fmt, () => { renderChart(); repaint(); }, channel);
      }
    );
    row.appendChild(trigger);

    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'cb-transparency-wrap';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0; slider.max = 1; slider.step = 0.01;
    slider.value = fmt[opacityKey] ?? 1;
    slider.className = 'cb-transparency-slider';
    slider.title = 'Transparency';
    slider.addEventListener('input', e => {
      fmt[opacityKey] = Number(e.target.value);
      renderChart();
      if (trigger.repaintSwatch) trigger.repaintSwatch();
    });

    const caption = document.createElement('span');
    caption.className = 'cb-transparency-caption';
    caption.textContent = 'Transparency';

    sliderWrap.appendChild(slider);
    sliderWrap.appendChild(caption);
    row.appendChild(sliderWrap);

    return row;
  }

  function swatchPickerTrigger(fmt, channel, onSolidChange, onSwitchToGradient) {
    const K = {
      mode: channel + 'Mode',
      color: channel + 'Color',
      type: channel + 'GradientType',
      angle: channel + 'GradientAngle',
      stops: channel + 'GradientStops',
    };

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cb-swatch-trigger cb-swatch-trigger-block';

    function paintSwatch() {
      if (fmt[K.mode] === 'gradient' && fmt[K.stops] && fmt[K.stops].length >= 2) {
        const sorted = [...fmt[K.stops]].sort((a, b) => a.position - b.position);
        const parts = sorted.map(s => `${hexWithAlpha(s.color, s.opacity)} ${(s.position * 100).toFixed(2)}%`);
        const angle = fmt[K.type] === 'linear' ? (fmt[K.angle] ?? 90) : 90;
        if (fmt[K.type] === 'radial' || fmt[K.type] === 'rectangular' || fmt[K.type] === 'path') {
          trigger.style.background = `radial-gradient(circle, ${parts.join(', ')})`;
        } else {
          trigger.style.background = `linear-gradient(${angle}deg, ${parts.join(', ')})`;
        }
      } else {
        const opacity = fmt[channel + 'Opacity'] ?? 1;
        trigger.style.background = hexWithAlpha(fmt[K.color], opacity);
      }
    }
    trigger.repaintSwatch = paintSwatch;
    paintSwatch();

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      openSwatchPopup(trigger, fmt[K.color], color => {
        fmt[K.mode] = 'solid';
        fmt[K.color] = color;
        onSolidChange(color);
        paintSwatch();
      }, onSwitchToGradient ? () => {
        onSwitchToGradient(trigger, paintSwatch);
      } : null);
    });

    return trigger;
  }

  function openSwatchPopup(anchor, initialColor, onSelect, onSwitchToGradient) {
    document.querySelectorAll('.cb-swatch-popup').forEach(el => el.remove());

    const popup = document.createElement('div');
    popup.className = 'cb-swatch-popup';

    // Theme Colors heading
    const themeHeading = document.createElement('div');
    themeHeading.className = 'cb-swatch-heading';
    themeHeading.textContent = 'Theme Colors';
    popup.appendChild(themeHeading);

    const themeRow1 = document.createElement('div');
    themeRow1.className = 'cb-swatch-row';
    const themeRowsRest = document.createElement('div');
    themeRowsRest.className = 'cb-swatch-grid';

    for (let shade = 0; shade < 6; shade++) {
      for (let theme = 0; theme < 10; theme++) {
        const color = THEME_COLORS[theme][shade];
        const btn = makeSwatchButton(color, () => {
          onSelect(color);
          popup.remove();
        });
        (shade === 0 ? themeRow1 : themeRowsRest).appendChild(btn);
      }
    }
    popup.appendChild(themeRow1);
    popup.appendChild(themeRowsRest);

    const sep1 = document.createElement('div');
    sep1.className = 'cb-swatch-sep';
    popup.appendChild(sep1);

    // Standard Colors heading
    const stdHeading = document.createElement('div');
    stdHeading.className = 'cb-swatch-heading';
    stdHeading.textContent = 'Standard Colors';
    popup.appendChild(stdHeading);

    const stdRow = document.createElement('div');
    stdRow.className = 'cb-swatch-row';
    STANDARD_COLORS.forEach(color => {
      stdRow.appendChild(makeSwatchButton(color, () => {
        onSelect(color);
        popup.remove();
      }));
    });
    popup.appendChild(stdRow);

    const sep2 = document.createElement('div');
    sep2.className = 'cb-swatch-sep';
    popup.appendChild(sep2);

    // More Colors row — hidden native color input triggered by link
    const moreRow = document.createElement('label');
    moreRow.className = 'cb-swatch-more';
    moreRow.textContent = 'More Colors…';
    const hiddenPicker = document.createElement('input');
    hiddenPicker.type = 'color';
    hiddenPicker.value = initialColor;
    hiddenPicker.className = 'cb-swatch-more-input';
    hiddenPicker.addEventListener('input', e => {
      onSelect(e.target.value);
    });
    hiddenPicker.addEventListener('change', () => {
      popup.remove();
    });
    moreRow.appendChild(hiddenPicker);
    popup.appendChild(moreRow);

    if (onSwitchToGradient) {
      const sep3 = document.createElement('div');
      sep3.className = 'cb-swatch-sep';
      popup.appendChild(sep3);

      const gradRow = document.createElement('button');
      gradRow.type = 'button';
      gradRow.className = 'cb-swatch-gradient-row';

      const gradIcon = document.createElement('span');
      gradIcon.className = 'cb-swatch-gradient-icon';
      gradRow.appendChild(gradIcon);

      const gradLabel = document.createElement('span');
      gradLabel.textContent = 'Gradient Fill';
      gradRow.appendChild(gradLabel);

      gradRow.addEventListener('click', () => {
        popup.remove();
        onSwitchToGradient();
      });
      popup.appendChild(gradRow);
    }

    document.body.appendChild(popup);

    const rect = anchor.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    // dismiss on outside click
    setTimeout(() => {
      const off = ev => {
        if (!popup.contains(ev.target)) {
          popup.remove();
          document.removeEventListener('mousedown', off);
        }
      };
      document.addEventListener('mousedown', off);
    }, 0);
  }

  function makeSwatchButton(color, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cb-swatch-cell';
    btn.style.background = color;
    btn.title = color.toUpperCase();
    btn.addEventListener('click', onClick);
    return btn;
  }

  const DIRECTION_PRESETS = [
    { name: 'Linear Right',   angle: 0 },
    { name: 'Linear Left',    angle: 180 },
    { name: 'Linear Down',    angle: 90 },
    { name: 'Linear Up',      angle: 270 },
    { name: 'Linear Diagonal ↘', angle: 45 },
    { name: 'Linear Diagonal ↙', angle: 135 },
    { name: 'Linear Diagonal ↖', angle: 225 },
    { name: 'Linear Diagonal ↗', angle: 315 },
  ];

  function openGradientPopup(anchor, fmt, onChange, channel) {
    channel = channel || 'line';
    const K = {
      mode: channel + 'Mode',
      color: channel + 'Color',
      type: channel + 'GradientType',
      angle: channel + 'GradientAngle',
      stops: channel + 'GradientStops',
    };

    document.querySelectorAll('.cb-gradient-popup').forEach(el => el.remove());

    // Snapshot for Cancel restore
    const snapshot = {
      mode: fmt[K.mode],
      color: fmt[K.color],
      type: fmt[K.type],
      angle: fmt[K.angle],
      stops: JSON.parse(JSON.stringify(fmt[K.stops] || [])),
    };

    // Switch mode to gradient when this popup is opened
    fmt[K.mode] = 'gradient';
    if (!fmt[K.stops] || fmt[K.stops].length < 2) {
      fmt[K.stops] = [
        { position: 0, color: '#ffffff', opacity: 1 },
        { position: 1, color: '#999999', opacity: 1 },
      ];
    }
    if (fmt[K.type] == null) fmt[K.type] = 'linear';
    if (fmt[K.angle] == null) fmt[K.angle] = 90;
    onChange();

    let selectedIndex = 0;
    let showSwatches = false;

    const popup = document.createElement('div');
    popup.className = 'cb-gradient-popup';

    function rebuild() {
      popup.innerHTML = '';

      // Type row
      popup.appendChild(gpRow('Type:', gpSelect(
        ['linear', 'radial', 'rectangular', 'path'],
        fmt[K.type],
        v => { fmt[K.type] = v; onChange(); rebuild(); }
      )));

      // Direction row
      const dirSel = document.createElement('select');
      dirSel.className = 'cb-gp-select';
      DIRECTION_PRESETS.forEach((d, i) => {
        const o = document.createElement('option');
        o.value = String(d.angle);
        o.textContent = d.name;
        if (Math.abs(d.angle - fmt[K.angle]) < 0.5) o.selected = true;
        dirSel.appendChild(o);
      });
      dirSel.disabled = fmt[K.type] !== 'linear';
      dirSel.addEventListener('change', e => {
        fmt[K.angle] = Number(e.target.value);
        onChange();
        rebuild();
      });
      popup.appendChild(gpRow('Direction:', dirSel));

      // Angle row
      const angleInput = document.createElement('input');
      angleInput.type = 'number';
      angleInput.min = 0; angleInput.max = 360; angleInput.step = 1;
      angleInput.value = Math.round(fmt[K.angle]);
      angleInput.disabled = fmt[K.type] !== 'linear';
      angleInput.className = 'cb-gp-number';
      angleInput.addEventListener('input', e => {
        fmt[K.angle] = Number(e.target.value) || 0;
        onChange();
      });
      const angleWrap = document.createElement('div');
      angleWrap.className = 'cb-gp-angle-wrap';
      angleWrap.appendChild(angleInput);
      const deg = document.createElement('span');
      deg.textContent = '°';
      deg.className = 'cb-gp-deg';
      angleWrap.appendChild(deg);
      popup.appendChild(gpRow('Angle:', angleWrap));

      // Gradient stops label + slider
      const stopsLabel = document.createElement('div');
      stopsLabel.className = 'cb-gp-section-label';
      stopsLabel.textContent = 'Gradient stops';
      popup.appendChild(stopsLabel);

      const sliderRow = document.createElement('div');
      sliderRow.className = 'cb-gp-slider-row';

      const slider = buildPPSlider(fmt[K.stops], selectedIndex, (newIndex) => {
        selectedIndex = newIndex;
        onChange();
        rebuild();
      }, () => { onChange(); /* live update, no rebuild */ });
      sliderRow.appendChild(slider);

      const btnCol = document.createElement('div');
      btnCol.className = 'cb-gp-stop-btns';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'cb-gp-mini-btn';
      addBtn.textContent = '+';
      addBtn.title = 'Add gradient stop';
      addBtn.addEventListener('click', () => {
        const stops = fmt[K.stops];
        // find biggest gap
        const sorted = [...stops].sort((a, b) => a.position - b.position);
        let maxGap = 0, gapAt = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
          const g = sorted[i + 1].position - sorted[i].position;
          if (g > maxGap) { maxGap = g; gapAt = i; }
        }
        const pos = (sorted[gapAt].position + sorted[gapAt + 1].position) / 2;
        const c = interpolateStopColor(stops, pos);
        stops.push({ position: pos, color: c.color, opacity: c.opacity });
        stops.sort((a, b) => a.position - b.position);
        selectedIndex = stops.findIndex(s => Math.abs(s.position - pos) < 0.001);
        onChange();
        rebuild();
      });
      btnCol.appendChild(addBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'cb-gp-mini-btn';
      removeBtn.textContent = '−';
      removeBtn.title = 'Remove gradient stop';
      removeBtn.disabled = fmt[K.stops].length <= 2;
      removeBtn.addEventListener('click', () => {
        if (fmt[K.stops].length <= 2) return;
        fmt[K.stops].splice(selectedIndex, 1);
        selectedIndex = Math.max(0, selectedIndex - 1);
        onChange();
        rebuild();
      });
      btnCol.appendChild(removeBtn);

      sliderRow.appendChild(btnCol);
      popup.appendChild(sliderRow);

      // Separator
      const sep = document.createElement('div');
      sep.className = 'cb-gp-sep';
      popup.appendChild(sep);

      const stop = fmt[K.stops][selectedIndex];

      // Color row
      const colorBtn = document.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = 'cb-gp-color-btn';
      colorBtn.style.background = stop.color;
      colorBtn.innerHTML = `<span class="cb-gp-color-caret">${showSwatches ? '▲' : '▼'}</span>`;
      colorBtn.addEventListener('click', () => {
        showSwatches = !showSwatches;
        rebuild();
      });
      popup.appendChild(gpRow('Color:', colorBtn));

      if (showSwatches) {
        popup.appendChild(buildInlineSwatchPanel(c => {
          stop.color = c;
          onChange();
          rebuild();
        }, stop.color));
      }

      // Transparency row
      const transparencyPct = Math.round((1 - stop.opacity) * 100);
      popup.appendChild(gpSliderRow('Transparency:', transparencyPct, 0, 100, v => {
        stop.opacity = 1 - v / 100;
        onChange();
        // Update only the visible readouts without full rebuild would be nicer,
        // but rebuild keeps the swatch current. Cheap enough.
      }, '%'));

      // Brightness row
      popup.appendChild(gpSliderRow('Brightness:', 0, -100, 100, v => {
        stop.color = applyBrightness(stop.color, v / 100);
        onChange();
      }, '%'));

      // OK / Cancel buttons
      const btnRow = document.createElement('div');
      btnRow.className = 'cb-gp-buttons';

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'cb-gp-btn cb-gp-btn-primary';
      okBtn.textContent = 'OK';
      okBtn.addEventListener('click', () => {
        cleanup();
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'cb-gp-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        restoreSnapshot();
        cleanup();
      });

      btnRow.appendChild(okBtn);
      btnRow.appendChild(cancelBtn);
      popup.appendChild(btnRow);
    }

    function restoreSnapshot() {
      fmt[K.mode] = snapshot.mode;
      fmt[K.color] = snapshot.color;
      fmt[K.type] = snapshot.type;
      fmt[K.angle] = snapshot.angle;
      fmt[K.stops] = JSON.parse(JSON.stringify(snapshot.stops));
      onChange();
    }

    let offHandler = null;
    function cleanup() {
      if (offHandler) document.removeEventListener('mousedown', offHandler);
      popup.remove();
    }

    rebuild();

    document.body.appendChild(popup);
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 4;
    let left = rect.left + window.scrollX;
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    const pw = popup.getBoundingClientRect().width;
    if (left + pw > window.innerWidth - 8) {
      popup.style.left = `${window.innerWidth - pw - 8}px`;
    }

    setTimeout(() => {
      offHandler = ev => {
        if (!popup.contains(ev.target)) {
          restoreSnapshot();
          cleanup();
        }
      };
      document.addEventListener('mousedown', offHandler);
    }, 0);
  }

  function gpRow(labelText, control) {
    const row = document.createElement('div');
    row.className = 'cb-gp-row';
    const label = document.createElement('span');
    label.className = 'cb-gp-label';
    label.textContent = labelText;
    row.appendChild(label);
    row.appendChild(control);
    return row;
  }

  function gpSelect(options, current, onChange) {
    const sel = document.createElement('select');
    sel.className = 'cb-gp-select';
    options.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v[0].toUpperCase() + v.slice(1);
      if (v === current) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', e => onChange(e.target.value));
    return sel;
  }

  function gpSliderRow(labelText, value, min, max, onChange, suffix) {
    const row = document.createElement('div');
    row.className = 'cb-gp-row';
    const label = document.createElement('span');
    label.className = 'cb-gp-label';
    label.textContent = labelText;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min; slider.max = max; slider.step = 1; slider.value = value;
    slider.className = 'cb-gp-slider';
    const number = document.createElement('input');
    number.type = 'number';
    number.min = min; number.max = max; number.step = 1; number.value = value;
    number.className = 'cb-gp-number';
    const suf = document.createElement('span');
    suf.textContent = suffix || '';
    suf.className = 'cb-gp-deg';

    slider.addEventListener('input', e => {
      const v = Number(e.target.value);
      number.value = v;
      onChange(v);
    });
    number.addEventListener('input', e => {
      const v = Math.max(min, Math.min(max, Number(e.target.value) || 0));
      slider.value = v;
      onChange(v);
    });

    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(number);
    row.appendChild(suf);
    return row;
  }

  function interpolateStopColor(stops, pos) {
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    if (pos <= sorted[0].position) return { color: sorted[0].color, opacity: sorted[0].opacity };
    if (pos >= sorted[sorted.length - 1].position) {
      const s = sorted[sorted.length - 1];
      return { color: s.color, opacity: s.opacity };
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (pos >= a.position && pos <= b.position) {
        const t = (pos - a.position) / (b.position - a.position);
        return {
          color: interpolateHex(a.color, b.color, t),
          opacity: a.opacity + (b.opacity - a.opacity) * t,
        };
      }
    }
    return { color: sorted[0].color, opacity: sorted[0].opacity };
  }

  function applyBrightness(hex, factor) {
    const m = hex.replace('#', '');
    let r = parseInt(m.substring(0, 2), 16);
    let g = parseInt(m.substring(2, 4), 16);
    let b = parseInt(m.substring(4, 6), 16);
    if (factor > 0) {
      r = Math.round(r + factor * (255 - r));
      g = Math.round(g + factor * (255 - g));
      b = Math.round(b + factor * (255 - b));
    } else if (factor < 0) {
      const f = 1 + factor;
      r = Math.round(r * f);
      g = Math.round(g * f);
      b = Math.round(b * f);
    }
    const hx = n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${hx(r)}${hx(g)}${hx(b)}`;
  }

  function buildPPSlider(stops, selectedIndex, onSelect, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'cb-pp-slider';

    const bar = document.createElement('div');
    bar.className = 'cb-pp-bar';
    wrap.appendChild(bar);

    const markersLayer = document.createElement('div');
    markersLayer.className = 'cb-pp-markers';
    wrap.appendChild(markersLayer);

    function paint() {
      const sorted = [...stops].sort((a, b) => a.position - b.position);
      const parts = sorted.map(s => `${hexWithAlpha(s.color, s.opacity)} ${(s.position * 100).toFixed(2)}%`);
      bar.style.background = `linear-gradient(to right, ${parts.join(', ')})`;

      markersLayer.innerHTML = '';
      stops.forEach((s, i) => {
        const marker = document.createElement('div');
        marker.className = 'cb-pp-marker' + (i === selectedIndex ? ' is-selected' : '');
        marker.style.left = `${s.position * 100}%`;
        marker.style.setProperty('--stop-color', hexWithAlpha(s.color, s.opacity));
        marker.addEventListener('pointerdown', e => {
          e.preventDefault();
          e.stopPropagation();
          const thisStop = s;
          const rect = wrap.getBoundingClientRect();
          let moved = false;
          marker.setPointerCapture(e.pointerId);
          const onMove = ev => {
            moved = true;
            const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
            thisStop.position = p;
            stops.sort((a, b) => a.position - b.position);
            // Update marker position and bar gradient in-place without rebuilding controls
            marker.style.left = `${p * 100}%`;
            const sorted2 = [...stops].sort((a, b) => a.position - b.position);
            const parts2 = sorted2.map(ss => `${hexWithAlpha(ss.color, ss.opacity)} ${(ss.position * 100).toFixed(2)}%`);
            bar.style.background = `linear-gradient(to right, ${parts2.join(', ')})`;
            // Trigger re-render of the chart for live preview, but do NOT rebuild the popup
            if (typeof onChange === 'function') onChange();
          };
          const onUp = () => {
            marker.removeEventListener('pointermove', onMove);
            marker.removeEventListener('pointerup', onUp);
            if (moved) {
              // Now rebuild so controls reflect sorted order / new selection index
              const newIndex = stops.indexOf(thisStop);
              onSelect(newIndex);
            } else {
              onSelect(i);
            }
          };
          marker.addEventListener('pointermove', onMove);
          marker.addEventListener('pointerup', onUp);
        });
        markersLayer.appendChild(marker);
      });
    }

    bar.addEventListener('pointerdown', e => {
      if (e.target !== bar) return;
      const rect = wrap.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const c = interpolateStopColor(stops, p);
      stops.push({ position: p, color: c.color, opacity: c.opacity });
      stops.sort((a, b) => a.position - b.position);
      const newIdx = stops.findIndex(ss => Math.abs(ss.position - p) < 0.001);
      onSelect(newIdx);
    });

    paint();
    return wrap;
  }

  function buildInlineSwatchPanel(onPick, currentColor) {
    const panel = document.createElement('div');
    panel.className = 'cb-gp-inline-swatches';

    const grid = document.createElement('div');
    grid.className = 'cb-gp-inline-grid';
    for (let shade = 0; shade < 6; shade++) {
      for (let theme = 0; theme < 10; theme++) {
        const c = THEME_COLORS[theme][shade];
        grid.appendChild(miniSwatch(c, onPick));
      }
    }
    panel.appendChild(grid);

    const stdRow = document.createElement('div');
    stdRow.className = 'cb-gp-inline-row';
    STANDARD_COLORS.forEach(c => stdRow.appendChild(miniSwatch(c, onPick)));
    panel.appendChild(stdRow);

    const more = document.createElement('label');
    more.className = 'cb-gp-more';
    more.textContent = 'More Colors…';
    const hidden = document.createElement('input');
    hidden.type = 'color';
    hidden.className = 'cb-swatch-more-input';
    hidden.value = currentColor || '#000000';
    hidden.addEventListener('input', e => onPick(e.target.value));
    more.appendChild(hidden);
    panel.appendChild(more);

    return panel;
  }

  function miniSwatch(color, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cb-gp-mini-swatch';
    b.style.background = color;
    b.title = color.toUpperCase();
    b.addEventListener('click', () => onClick(color));
    return b;
  }

  function inlineSelect(labelText, options, current, onChange) {
    const row = document.createElement('div');
    row.className = 'cb-inline-row';
    const label = document.createElement('span');
    label.className = 'cb-inline-label';
    label.textContent = labelText;
    row.appendChild(label);
    row.appendChild(modeSelect(options, current, onChange));
    return row;
  }

  function inlineRange(labelText, value, min, max, step, onChange) {
    const row = document.createElement('div');
    row.className = 'cb-inline-row';
    const label = document.createElement('span');
    label.className = 'cb-inline-label';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step; input.value = value;
    input.addEventListener('input', e => onChange(Number(e.target.value)));
    row.appendChild(label);
    row.appendChild(input);
    return row;
  }

  function gradientEditor(stops, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'cb-gradient-editor';

    const track = document.createElement('div');
    track.className = 'cb-gradient-track';
    wrap.appendChild(track);

    const controls = document.createElement('div');
    controls.className = 'cb-gradient-controls';
    wrap.appendChild(controls);

    let selectedIndex = 0;
    let draggingIndex = null;
    let dragStartY = 0;
    let dragRemoved = false;

    function sortAndClampSelection() {
      // keep stops sorted by position so the selected stop stays with its data
      const selected = stops[selectedIndex];
      stops.sort((a, b) => a.position - b.position);
      selectedIndex = stops.indexOf(selected);
      if (selectedIndex < 0) selectedIndex = 0;
    }

    function trackBackground() {
      const sorted = [...stops].sort((a, b) => a.position - b.position);
      if (sorted.length === 0) return '#ffffff';
      if (sorted.length === 1) return hexWithAlpha(sorted[0].color, sorted[0].opacity);
      const parts = sorted.map(s => `${hexWithAlpha(s.color, s.opacity)} ${(s.position * 100).toFixed(2)}%`);
      return `linear-gradient(to right, ${parts.join(', ')})`;
    }

    function render() {
      sortAndClampSelection();
      track.style.background = trackBackground();
      track.innerHTML = '';

      stops.forEach((stop, idx) => {
        const handle = document.createElement('div');
        handle.className = 'cb-gradient-stop';
        if (idx === selectedIndex) handle.classList.add('is-selected');
        if (draggingIndex === idx && dragRemoved) handle.classList.add('is-removing');
        handle.style.left = `${stop.position * 100}%`;
        handle.style.setProperty('--stop-color', hexWithAlpha(stop.color, stop.opacity));
        handle.title = `Stop ${idx + 1}`;

        handle.addEventListener('pointerdown', e => {
          e.stopPropagation();
          e.preventDefault();
          selectedIndex = idx;
          draggingIndex = idx;
          dragStartY = e.clientY;
          dragRemoved = false;
          handle.setPointerCapture(e.pointerId);
          renderControls();
          render();

          const onMove = moveEvent => {
            const rect = track.getBoundingClientRect();
            const x = (moveEvent.clientX - rect.left) / rect.width;
            const dy = Math.abs(moveEvent.clientY - rect.top - rect.height / 2);
            const farOut = dy > rect.height * 2 && stops.length > 2;
            dragRemoved = farOut;
            if (!farOut) {
              stops[idx].position = Math.max(0, Math.min(1, x));
            }
            render();
            onChange();
          };

          const onUp = upEvent => {
            handle.releasePointerCapture(e.pointerId);
            track.removeEventListener('pointermove', onMove);
            track.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);

            if (dragRemoved && stops.length > 2) {
              stops.splice(idx, 1);
              selectedIndex = Math.min(selectedIndex, stops.length - 1);
            }
            draggingIndex = null;
            dragRemoved = false;
            sortAndClampSelection();
            render();
            renderControls();
            onChange();
          };

          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });

        track.appendChild(handle);
      });
    }

    track.addEventListener('pointerdown', e => {
      if (e.target !== track) return;
      const rect = track.getBoundingClientRect();
      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      // sample color from neighbors
      const sorted = [...stops].sort((a, b) => a.position - b.position);
      let before = sorted[0];
      let after = sorted[sorted.length - 1];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (position >= sorted[i].position && position <= sorted[i + 1].position) {
          before = sorted[i]; after = sorted[i + 1]; break;
        }
      }
      const span = after.position - before.position || 1;
      const t = (position - before.position) / span;
      const newStop = {
        position,
        color: interpolateHex(before.color, after.color, t),
        opacity: before.opacity + (after.opacity - before.opacity) * t,
      };
      stops.push(newStop);
      sortAndClampSelection();
      selectedIndex = stops.indexOf(newStop);
      render();
      renderControls();
      onChange();
    });

    function renderControls() {
      controls.innerHTML = '';
      if (stops.length === 0) return;
      const stop = stops[selectedIndex];

      const row = document.createElement('div');
      row.className = 'cb-gradient-row';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'cb-bare-color';
      colorInput.value = stop.color;
      colorInput.addEventListener('input', e => {
        stop.color = e.target.value;
        render();
        onChange();
      });

      const opLabel = document.createElement('span');
      opLabel.className = 'cb-inline-label';
      opLabel.textContent = 'Opacity';

      const opInput = document.createElement('input');
      opInput.type = 'range';
      opInput.min = 0; opInput.max = 1; opInput.step = 0.05;
      opInput.value = stop.opacity;
      opInput.addEventListener('input', e => {
        stop.opacity = Number(e.target.value);
        render();
        onChange();
      });

      row.appendChild(colorInput);
      row.appendChild(opLabel);
      row.appendChild(opInput);
      controls.appendChild(row);
    }

    render();
    renderControls();
    return wrap;
  }

  function interpolateHex(a, b, t) {
    const pa = a.replace('#', '');
    const pb = b.replace('#', '');
    const ar = parseInt(pa.substring(0, 2), 16);
    const ag = parseInt(pa.substring(2, 4), 16);
    const ab = parseInt(pa.substring(4, 6), 16);
    const br = parseInt(pb.substring(0, 2), 16);
    const bg = parseInt(pb.substring(2, 4), 16);
    const bb = parseInt(pb.substring(4, 6), 16);
    const r = Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0');
    const g = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0');
    const bl = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0');
    return `#${r}${g}${bl}`;
  }

  function colorField(labelText, value, onChange) {
    return field(labelText, () => {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = value;
      input.addEventListener('input', e => onChange(e.target.value));
      return input;
    });
  }

  function rangeField(labelText, value, min, max, step, onChange) {
    return field(labelText, () => {
      const wrap = document.createElement('div');
      wrap.className = 'cb-field-inline';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = min; input.max = max; input.step = step; input.value = value;
      const readout = document.createElement('span');
      readout.className = 'cb-field-hint';
      readout.textContent = Number(value).toFixed(2);
      input.addEventListener('input', e => {
        const v = Number(e.target.value);
        readout.textContent = v.toFixed(2);
        onChange(v);
      });
      wrap.appendChild(input);
      wrap.appendChild(readout);
      return wrap;
    });
  }

  function syncValuesLength() {
    const target = state.labels.length;
    if (state.values.length < target) {
      while (state.values.length < target) state.values.push(0);
    } else if (state.values.length > target) {
      state.values = state.values.slice(0, target);
    }
  }

  function field(labelText, controlFactory) {
    const wrap = document.createElement('div');
    wrap.className = 'cb-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(controlFactory());
    return wrap;
  }

  function newChart(type) {
    const templates = loadTemplates();
    if (templates[type]) {
      state = JSON.parse(JSON.stringify(templates[type]));
      state.type = type;
    } else {
      state = { type, ...JSON.parse(JSON.stringify(defaults[type])) };
      if (prefs.darkDefaults) applyDarkToState(state);
      applyNewDefaults(state);
    }
    openPanel();
    buildControls();
    renderChart();
  }

  document.getElementById('cb-new-chart').addEventListener('click', openNewChartDialog);

  // Keep prefs synced with the shared Settings module if present.
  if (window.Settings && typeof window.Settings.onChange === 'function') {
    window.Settings.onChange('cb_prefs_v1', (v) => {
      if (v) prefs = { ...prefs, ...v };
      populateEmptyGrids();
    });
  }

  function openPrefsPopup() {
    document.querySelectorAll('.cb-prefs-popup').forEach(el => el.remove());
    const popup = document.createElement('div');
    popup.className = 'cb-prefs-popup';

    const heading = document.createElement('div');
    heading.className = 'cb-prefs-heading';
    heading.textContent = 'Chart Builder preferences';
    popup.appendChild(heading);

    const row = document.createElement('label');
    row.className = 'cb-prefs-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!prefs.darkDefaults;
    input.addEventListener('change', () => {
      prefs.darkDefaults = input.checked;
      savePrefs(prefs);
      populateEmptyGrids();
    });
    const text = document.createElement('span');
    text.textContent = 'Display dark-themed charts as new charts';
    row.appendChild(input);
    row.appendChild(text);
    popup.appendChild(row);

    document.body.appendChild(popup);
    const btnRect = prefsBtn.getBoundingClientRect();
    popup.style.top = `${btnRect.bottom + 6}px`;
    popup.style.left = `${Math.max(8, btnRect.right - popup.offsetWidth)}px`;

    setTimeout(() => {
      const off = ev => {
        if (!popup.contains(ev.target) && ev.target !== prefsBtn) {
          popup.remove();
          document.removeEventListener('mousedown', off);
        }
      };
      document.addEventListener('mousedown', off);
    }, 0);
  }

  function populateEmptyGrids() {
    const newGrid = document.getElementById('cb-empty-new-grid');
    const savedGrid = document.getElementById('cb-empty-saved-grid');
    if (!newGrid || !savedGrid) return;

    // New chart cards
    newGrid.innerHTML = '';
    const types = CHART_TYPES;
    types.forEach(t => {
      const card = document.createElement('div');
      card.className = 'cb-saved-card';
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'cb-saved-card-preview';
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 200;
      canvas.className = 'cb-saved-card-canvas';
      preview.appendChild(canvas);
      const templates = loadTemplates();
      const sampleState = templates[t.id]
        ? (() => { const s = JSON.parse(JSON.stringify(templates[t.id])); s.type = t.id; return s; })()
        : { type: t.id, ...JSON.parse(JSON.stringify(defaults[t.id])) };
      if (!templates[t.id]) {
        if (prefs.darkDefaults) applyDarkToState(sampleState);
        applyNewDefaults(sampleState);
      }
      setTimeout(() => { try { renderThumbnail(canvas, sampleState); } catch {} }, 0);
      preview.addEventListener('click', () => newChart(t.id));
      const footer = document.createElement('div');
      footer.className = 'cb-saved-card-footer';
      const name = document.createElement('span');
      name.className = 'cb-saved-card-name';
      name.textContent = t.label;
      applySplashCardAppearance(card, preview, name);
      footer.appendChild(name);
      card.appendChild(preview);
      card.appendChild(footer);
      newGrid.appendChild(card);
    });

    // Saved charts
    savedGrid.innerHTML = '';
    const list = loadSavedCharts();
    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cb-saved-empty';
      empty.textContent = 'No saved charts yet.';
      savedGrid.appendChild(empty);
      return;
    }
    list
      .slice()
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
      .forEach(item => {
        const card = document.createElement('div');
        card.className = 'cb-saved-card';
        const preview = document.createElement('button');
        preview.type = 'button';
        preview.className = 'cb-saved-card-preview';
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 200;
        canvas.className = 'cb-saved-card-canvas';
        preview.appendChild(canvas);
        setTimeout(() => { try { renderThumbnail(canvas, item.state); } catch {} }, 0);
        preview.addEventListener('click', () => {
          state = JSON.parse(JSON.stringify(item.state));
          openPanel();
          buildControls();
          renderChart();
        });
        const footer = document.createElement('div');
        footer.className = 'cb-saved-card-footer';
        const name = document.createElement('span');
        name.className = 'cb-saved-card-name';
        name.textContent = item.name;
        applySplashCardAppearance(card, preview, name);
        footer.appendChild(name);
        card.appendChild(preview);
        card.appendChild(footer);
        savedGrid.appendChild(card);
      });
  }
  document.getElementById('cb-save-chart').addEventListener('click', saveCurrentChart);
  document.getElementById('cb-save-chart').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openSaveContextMenu(e.clientX, e.clientY);
  });

  const TEMPLATES_KEY = 'cb_templates_v1';
  function loadTemplates() {
    try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function saveTemplates(t) { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)); }

  function saveAsTemplate() {
    if (!state || !state.type) {
      alert('Create a chart first.');
      return;
    }
    const templates = loadTemplates();
    templates[state.type] = JSON.parse(JSON.stringify(state));
    saveTemplates(templates);
    populateEmptyGrids();
  }

  function openSaveContextMenu(x, y) {
    document.querySelectorAll('.cb-ctx-menu').forEach(el => el.remove());
    const menu = document.createElement('div');
    menu.className = 'cb-ctx-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'cb-ctx-item';
    item.textContent = 'Save as Template';
    item.addEventListener('click', () => {
      menu.remove();
      saveAsTemplate();
    });
    menu.appendChild(item);
    document.body.appendChild(menu);
    setTimeout(() => {
      const off = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('mousedown', off);
        }
      };
      document.addEventListener('mousedown', off);
    }, 0);
  }
  document.getElementById('cb-edit-chart').addEventListener('click', openEditChartDialog);
  sideCloseBtn.addEventListener('click', closePanel);

  const STORAGE_KEY = 'cb_saved_charts_v1';

  function loadSavedCharts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function writeSavedCharts(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function saveCurrentChart() {
    if (!state) {
      alert('Create a chart first.');
      return;
    }
    const defaultName = state.title || `Untitled ${state.type} chart`;
    const name = prompt('Save chart as:', defaultName);
    if (!name) return;
    const list = loadSavedCharts();
    const snapshot = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      savedAt: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(state)),
    };
    // Overwrite if a chart with the same name exists
    const existing = list.findIndex(s => s.name === name);
    if (existing >= 0) {
      if (!confirm(`"${name}" already exists. Overwrite?`)) return;
      list[existing] = snapshot;
    } else {
      list.push(snapshot);
    }
    writeSavedCharts(list);
    populateEmptyGrids();
  }

  function openNewChartDialog() {
    document.querySelectorAll('.cb-saved-backdrop').forEach(el => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'cb-saved-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'cb-saved-dialog';

    const header = document.createElement('div');
    header.className = 'cb-saved-header';
    const h = document.createElement('h2');
    h.textContent = 'New Chart';
    header.appendChild(h);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'cb-saved-close';
    close.textContent = '×';
    close.addEventListener('click', () => backdrop.remove());
    header.appendChild(close);
    dialog.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'cb-saved-grid';

    const types = CHART_TYPES;

    types.forEach(t => {
      const card = document.createElement('div');
      card.className = 'cb-saved-card';

      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'cb-saved-card-preview';

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 320;
      thumbCanvas.height = 200;
      thumbCanvas.className = 'cb-saved-card-canvas';
      preview.appendChild(thumbCanvas);

      // Sample state for this type using defaults
      const templates = loadTemplates();
      const sampleState = templates[t.id]
        ? (() => { const s = JSON.parse(JSON.stringify(templates[t.id])); s.type = t.id; return s; })()
        : { type: t.id, ...JSON.parse(JSON.stringify(defaults[t.id])) };
      if (!templates[t.id]) {
        if (prefs.darkDefaults) applyDarkToState(sampleState);
        applyNewDefaults(sampleState);
      }
      setTimeout(() => {
        try { renderThumbnail(thumbCanvas, sampleState); } catch {}
      }, 0);

      preview.addEventListener('click', () => {
        newChart(t.id);
        backdrop.remove();
      });

      const footer = document.createElement('div');
      footer.className = 'cb-saved-card-footer';
      const name = document.createElement('span');
      name.className = 'cb-saved-card-name';
      name.textContent = t.label;
      footer.appendChild(name);

      card.appendChild(preview);
      card.appendChild(footer);
      grid.appendChild(card);
    });

    dialog.appendChild(grid);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) backdrop.remove();
    });
  }

  function openEditChartDialog() {
    document.querySelectorAll('.cb-saved-backdrop').forEach(el => el.remove());

    const list = loadSavedCharts();

    const backdrop = document.createElement('div');
    backdrop.className = 'cb-saved-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'cb-saved-dialog';

    const header = document.createElement('div');
    header.className = 'cb-saved-header';
    const h = document.createElement('h2');
    h.textContent = 'Edit Chart';
    header.appendChild(h);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'cb-saved-close';
    close.textContent = '×';
    close.addEventListener('click', () => backdrop.remove());
    header.appendChild(close);
    dialog.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'cb-saved-grid';

    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cb-saved-empty';
      empty.textContent = 'No saved charts yet. Create one, then click Save chart.';
      grid.appendChild(empty);
    } else {
      list
        .slice()
        .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
        .forEach(item => {
          const card = document.createElement('div');
          card.className = 'cb-saved-card';

          const preview = document.createElement('button');
          preview.type = 'button';
          preview.className = 'cb-saved-card-preview';

          // Render thumbnail via temp canvas
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = 320;
          thumbCanvas.height = 200;
          thumbCanvas.className = 'cb-saved-card-canvas';
          preview.appendChild(thumbCanvas);
          // defer render so dialog is attached first (responsive sizing)
          setTimeout(() => {
            try { renderThumbnail(thumbCanvas, item.state); } catch (e) { /* ignore */ }
          }, 0);

          preview.addEventListener('click', () => {
            state = JSON.parse(JSON.stringify(item.state));
            openPanel();
            buildControls();
            renderChart();
            backdrop.remove();
          });

          const nameRow = document.createElement('div');
          nameRow.className = 'cb-saved-card-footer';
          const name = document.createElement('span');
          name.className = 'cb-saved-card-name';
          name.textContent = item.name;
          nameRow.appendChild(name);

          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'cb-saved-card-delete';
          del.title = 'Delete';
          del.textContent = '×';
          del.addEventListener('click', ev => {
            ev.stopPropagation();
            if (!confirm(`Delete "${item.name}"?`)) return;
            const current = loadSavedCharts().filter(s => s.id !== item.id);
            writeSavedCharts(current);
            backdrop.remove();
            openEditChartDialog();
          });
          nameRow.appendChild(del);

          const meta = document.createElement('div');
          meta.className = 'cb-saved-card-meta';
          meta.textContent = `${item.state.type} · ${formatSavedAt(item.savedAt)}`;

          card.appendChild(preview);
          card.appendChild(nameRow);
          card.appendChild(meta);
          grid.appendChild(card);
        });
    }

    dialog.appendChild(grid);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) backdrop.remove();
    });
  }

  function renderThumbnail(canvas, s) {
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const { type, title, labels, values, color, lineFormat, series, points } = s;
    const chartJsType = chartJsTypeFor(type);

    let datasets;
    if (type === 'grouped' || type === 'stacked') {
      datasets = (series || []).map(sr => ({
        label: sr.label,
        data: sr.values,
        backgroundColor: hexWithAlpha(sr.color, lineFormat?.fillOpacity ?? 1),
        borderColor: sr.color,
        borderWidth: 1,
      }));
    } else if (type === 'scatter') {
      datasets = [{ label: title, data: points, backgroundColor: hexWithAlpha(color, 0.8), borderColor: color, pointRadius: 3 }];
    } else if (type === 'bubble') {
      datasets = [{ label: title, data: points, backgroundColor: hexWithAlpha(color, 0.6), borderColor: color, borderWidth: 1 }];
    } else {
      const dataset = { label: title, data: values };
      if (type === 'donut' || type === 'pie') {
        const pieColors = ['#3f6ad8', '#e97132'];
        const alpha = lineFormat?.fillOpacity ?? 0.2;
        dataset.backgroundColor = values.map((_, i) => hexWithAlpha(pieColors[i % pieColors.length], alpha));
        dataset.borderColor = pieColors.map((_, i) => pieColors[i % pieColors.length]);
        dataset.borderWidth = 1;
      } else if (type === 'radar') {
        dataset.borderColor = color;
        dataset.backgroundColor = hexWithAlpha(color, 0.3);
        dataset.borderWidth = 1;
        dataset.pointRadius = 2;
      } else if (type === 'line' || type === 'area') {
        dataset.tension = 0.3;
        dataset.pointRadius = Math.min(2, lineFormat.plotSize ?? 2);
        dataset.fill = lineFormat.fillMode !== 'none';
        dataset.borderColor = (ctx) => resolveLineStroke(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.backgroundColor = (ctx) => resolveFill(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.pointBackgroundColor = hexWithAlpha(lineFormat.plotColor || lineFormat.lineColor, lineFormat.plotOpacity ?? 1);
        dataset.pointStyle = lineFormat.plotStyle || 'circle';
        dataset.borderWidth = Math.min(2, lineFormat.lineWeight ?? 2);
        dataset.borderDash = lineStyleToDash(lineFormat.lineStyle, lineFormat.lineWeight ?? 2);
      } else {
        dataset.borderColor = (ctx) => resolveLineStroke(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.backgroundColor = (ctx) => resolveFill(ctx.chart.ctx, ctx.chart.chartArea, lineFormat);
        dataset.borderWidth = 1;
        if (type === 'histogram') { dataset.barPercentage = 1.0; dataset.categoryPercentage = 1.0; }
      }
      datasets = [dataset];
    }

    const cf = s.chartFormat || {};
    const gridIsGradient = cf.gridMode === 'gradient' && cf.gridGradientStops?.length >= 2;
    const gridSolid = hexWithAlpha(cf.gridColor ?? '#d5d9de', cf.gridOpacity ?? 1);
    const gridColor = gridIsGradient ? 'rgba(0,0,0,0)' : gridSolid;

    const surroundPlugin = {
      id: 'cb-thumb-surround',
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
      id: 'cb-thumb-bg',
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

    const indexAxis = type === 'bar' ? 'y' : 'x';
    const hasCategorical = !(type === 'scatter' || type === 'bubble' || type === 'radar' || type === 'pie' || type === 'donut');
    let thumbScales = {};
    if (type === 'radar') {
      thumbScales = { r: { ticks: { display: false }, grid: { color: gridColor } } };
    } else if (type !== 'pie' && type !== 'donut') {
      thumbScales = {
        x: { ticks: { display: false }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { display: false }, grid: { color: gridColor } },
      };
      if (type === 'stacked') { thumbScales.x.stacked = true; thumbScales.y.stacked = true; }
    }

    new Chart(canvas, {
      type: chartJsType,
      data: hasCategorical ? { labels, datasets } : { datasets },
      options: {
        indexAxis,
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: window.devicePixelRatio || 1,
        plugins: {
          title: { display: !!title, text: title, font: { size: 11, weight: '600' } },
          legend: { display: false },
        },
        scales: thumbScales,
      },
      plugins: [surroundPlugin, bgPlugin],
    });
  }

  function formatSavedAt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString();
  }

  populateEmptyGrids();
  // Expose so Settings can refresh the splash after clearing templates.
  window.populateEmptyGrids = populateEmptyGrids;

  // Preview-size persistence (slider lives in Settings → Chart Builder → Other)
  const SIZE_KEY = 'cb_preview_size_v1';
  (function applyInitialSize() {
    const saved = parseInt(localStorage.getItem(SIZE_KEY), 10);
    const initial = !isNaN(saved) ? saved : 200;
    document.documentElement.style.setProperty('--cb-card-size', `${initial}px`);
  })();
  window.bindCbPreviewSizeSlider = function () {
    const el = document.getElementById('cb-preview-size');
    if (!el) return;
    const saved = parseInt(localStorage.getItem(SIZE_KEY), 10);
    el.value = !isNaN(saved) ? saved : 200;
    if (el.dataset.sizeBound === '1') return;
    el.dataset.sizeBound = '1';
    el.addEventListener('input', () => {
      const v = parseInt(el.value, 10) || 200;
      document.documentElement.style.setProperty('--cb-card-size', `${v}px`);
      localStorage.setItem(SIZE_KEY, String(v));
    });
  };

  // Expose a mount for the New-chart-defaults editor used by Settings.
  window.mountNewChartDefaultsEditor = function (container, mode) {
    if (!container) return;
    mode = mode || (isDarkActive() ? 'dark' : 'light');
    container.innerHTML = '';
    const sampleType = 'bar';
    const synthState = { type: sampleType, ...JSON.parse(JSON.stringify(defaults[sampleType])) };
    applyNewDefaults(synthState, mode);

    const prevState = state;
    state = synthState;
    try {
      container.appendChild(buildBackgroundAxisSection());
      container.appendChild(buildLinePlotFormatSection());
    } finally {
      state = prevState;
    }

    function persist() {
      const all = loadAllNewDefaults();
      all[mode] = {
        chartFormat: synthState.chartFormat,
        lineFormat: synthState.lineFormat,
      };
      saveAllNewDefaults(all);
      populateEmptyGrids();
    }
    container.addEventListener('input', persist, true);
    container.addEventListener('change', persist, true);
    container.addEventListener('click', () => setTimeout(persist, 0), true);
  };
})();
