// ── Oura Dashboard App ──────────────────────────────────────────────────────

// ── Helpers ─────────────────────────────────────────────────────────────────
const sec2h = s => (s / 3600).toFixed(1);
const sec2min = s => Math.round(s / 60);

async function fetchJSON(url, opts) {
    const resp = await fetch(url, opts);
    return resp.json();
}

// ── Glossary (Tooltips) ─────────────────────────────────────────────────────
const GLOSSARY = {
    'Readiness': 'Bereitschafts-Score (0\u2013100). Zeigt, wie gut dein K\u00f6rper f\u00fcr Belastung vorbereitet ist \u2013 basierend auf HRV-Balance, Ruheherzfrequenz, Schlafqualit\u00e4t und Erholung.',
    'Schlaf': 'Schlaf-Score (0\u2013100). Bewertet deine Schlafqualit\u00e4t anhand von Dauer, Effizienz, Schlafphasen, Einschlafzeit und Erholsamkeit.',
    'Aktivitaet': 'Aktivit\u00e4ts-Score (0\u2013100). Misst dein Bewegungslevel \u2013 basierend auf Schritten, Trainingsvolumen, Bewegungspausen und Erholungszeit.',
    'Schlaf Dauer': 'Gesamte Schlafdauer der letzten Nacht in Stunden. Empfohlen: 7\u20139 Stunden f\u00fcr Erwachsene.',
    'Ruhe-HF': 'Ruheherzfrequenz \u2013 die niedrigste Herzfrequenz w\u00e4hrend des Schlafs (in bpm). Ein niedriger Wert deutet auf gute Fitness und Erholung hin.',
    'HRV': 'Herzratenvariabilit\u00e4t \u2013 die Schwankung zwischen aufeinanderfolgenden Herzschl\u00e4gen (in ms). H\u00f6here Werte = bessere Erholung und ausgeglichenes autonomes Nervensystem.',
    'Schlaf-Phasen': 'Die verschiedenen Stadien des Schlafs: Tiefschlaf, Leichtschlaf, REM-Schlaf und Wachphasen \u2013 sie wiederholen sich zyklisch.',
    'Tiefschlaf': 'Die erholsamste Schlafphase. Wichtig f\u00fcr k\u00f6rperliche Regeneration, Immunsystem und Zellreparatur. Typisch: 1\u20132 Std. pro Nacht.',
    'Leicht': 'Leichtschlaf \u2013 die h\u00e4ufigste Schlafphase (~50 %). \u00dcbergang zwischen Wach- und Tiefschlaf. Unterst\u00fctzt Ged\u00e4chtnis und motorisches Lernen.',
    'REM': 'Rapid Eye Movement \u2013 Schlafphase mit schnellen Augenbewegungen. Wichtig f\u00fcr Ged\u00e4chtnis, emotionale Verarbeitung und Tr\u00e4ume. Typisch: 1,5\u20132 Std.',
    'Wach': 'Wachphasen w\u00e4hrend der Nacht. Kurze Wachphasen sind normal \u2013 l\u00e4ngere beeintr\u00e4chtigen die Schlafqualit\u00e4t.',
    'Ruhe-Herzfrequenz': 'Die niedrigste Herzfrequenz w\u00e4hrend des Schlafs (in bpm). Indikator f\u00fcr kardiovaskul\u00e4re Fitness \u2013 niedrigere Werte = effizienteres Herz.',
    'SpO2': 'Periphere Sauerstoffs\u00e4ttigung \u2013 Anteil des sauerstoffbeladenen H\u00e4moglobins im Blut. Normal: 95\u2013100 %. Niedrige Werte k\u00f6nnen auf Atemst\u00f6rungen hinweisen.',
    'Blutsauerstoff': 'Sauerstoffs\u00e4ttigung im Blut (SpO2). Normal: 95\u2013100 %. Wird per Infrarot-Sensor am Finger gemessen.',
    'Kardiovaskulaeres Alter': 'Biologisches Alter deines Herz-Kreislauf-Systems. Basiert auf Ruheherzfrequenz und HRV. J\u00fcnger als dein echtes Alter = gute Herzgesundheit.',
    'Schlaf-Effizienz': 'Anteil der Schlafzeit an der Gesamtzeit im Bett (in %). Gute Werte: \u00fcber 85 %. Niedrig = h\u00e4ufiges Aufwachen oder lange Einschlafzeit.',
    'Stress': 'Vom Oura-Ring erkannte Phasen hoher Stressbelastung, basierend auf HRV-Analyse und Aktivit\u00e4tsmuster.',
    'Erholung': 'Perioden hoher Erholung \u2013 das parasympathische Nervensystem dominiert. K\u00f6rper und Geist regenerieren sich.',
    'Kalorien': 'Energieverbrauch in kcal. Aktive Kalorien = durch Bewegung verbrannt. Gesamt = Grundumsatz + aktive Kalorien.',
    'Schritte': 'T\u00e4gliche Schrittzahl. Die WHO empfiehlt 7.000\u201310.000 Schritte pro Tag f\u00fcr die Gesundheit.',
    'Herzfrequenz': 'Herzschl\u00e4ge pro Minute (bpm). Die 24-Stunden-Kurve zeigt Ruhe-, Wach- und Aktivit\u00e4tsphasen im Tagesverlauf.',
};

function tip(term, display) {
    const text = GLOSSARY[term];
    if (!text) return display || term;
    return `<span class="tip">${display || term}<span class="tip-text">${text}</span></span>`;
}

// ── Chart defaults ──────────────────────────────────────────────────────────
const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#1a1a24',
            titleColor: '#e0e0e0',
            bodyColor: '#aaa',
            borderColor: '#2a2a3a',
            borderWidth: 1,
        }
    },
    scales: {
        x: {
            grid: { color: '#1f1f2e' },
            ticks: { color: '#555', maxTicksLimit: 10 }
        },
        y: {
            grid: { color: '#1f1f2e' },
            ticks: { color: '#555' }
        }
    }
};

function makeOpts(overrides = {}) {
    const base = JSON.parse(JSON.stringify(CHART_DEFAULTS));
    return { ...base, ...overrides };
}

// ── Widget definitions ──────────────────────────────────────────────────────
const WIDGETS = [
    { id: 'scoresTrend',  label: 'Tages-Scores',          fullWidth: true  },
    { id: 'sleepStages',  label: 'Schlaf-Phasen',         fullWidth: false },
    { id: 'hrHrv',        label: 'Ruhe-HF & HRV',        fullWidth: false },
    { id: 'steps',        label: 'Schritte',              fullWidth: false },
    { id: 'stress',       label: 'Stress vs. Erholung',   fullWidth: false },
    { id: 'spo2',         label: 'SpO2',                  fullWidth: false },
    { id: 'cvAge',        label: 'Kardiovaskul\u00e4res Alter', fullWidth: false },
    { id: 'calories',     label: 'Kalorien',              fullWidth: false },
    { id: 'sleepEff',     label: 'Schlaf-Effizienz',      fullWidth: false },
    { id: 'hr24',         label: 'Herzfrequenz 24h',      fullWidth: true  },
    { id: 'resilience',   label: 'Resilienz',             fullWidth: false },
];

// Track chart instances for cleanup
const chartInstances = {};

// ── State ───────────────────────────────────────────────────────────────────
let currentStart = '';
let currentEnd = '';
let personalInfo = {};

// ── localStorage persistence ────────────────────────────────────────────────
function getVisibility() {
    try {
        const stored = localStorage.getItem('oura_widget_visibility');
        if (stored) return JSON.parse(stored);
    } catch {}
    // Default: all visible
    const vis = {};
    WIDGETS.forEach(w => vis[w.id] = true);
    return vis;
}

function saveVisibility(vis) {
    localStorage.setItem('oura_widget_visibility', JSON.stringify(vis));
}

function getOrder() {
    try {
        const stored = localStorage.getItem('oura_widget_order');
        if (stored) return JSON.parse(stored);
    } catch {}
    return WIDGETS.map(w => w.id);
}

function saveOrder(order) {
    localStorage.setItem('oura_widget_order', JSON.stringify(order));
}

function getSizes() {
    try {
        const stored = localStorage.getItem('oura_widget_sizes');
        if (stored) return JSON.parse(stored);
    } catch {}
    // Default: use the fullWidth from WIDGETS definition
    const sizes = {};
    WIDGETS.forEach(w => sizes[w.id] = w.fullWidth ? 'full' : 'normal');
    return sizes;
}

function saveSizes(sizes) {
    localStorage.setItem('oura_widget_sizes', JSON.stringify(sizes));
}

function isFullWidth(widgetId) {
    return getSizes()[widgetId] === 'full';
}

function setWidgetSize(widgetId, size) {
    const sizes = getSizes();
    sizes[widgetId] = size;
    saveSizes(sizes);
    const box = document.getElementById('box_' + widgetId);
    if (box) {
        box.classList.toggle('full-width', size === 'full');
        // Re-render chart to fit new size
        if (chartInstances[widgetId]) {
            chartInstances[widgetId].resize();
        }
    }
    closeSizePopups();
}

// ── Widget Panel ────────────────────────────────────────────────────────────
function toggleWidgetPanel() {
    document.getElementById('widgetPanel').classList.toggle('open');
    document.getElementById('panelOverlay').classList.toggle('open');
}

function buildWidgetToggles() {
    const vis = getVisibility();
    const container = document.getElementById('widgetToggles');
    container.innerHTML = WIDGETS.map(w => `
        <div class="widget-toggle">
            <input type="checkbox" id="toggle_${w.id}" ${vis[w.id] ? 'checked' : ''}
                   onchange="onWidgetToggle('${w.id}', this.checked)">
            <label for="toggle_${w.id}">${w.label}</label>
        </div>
    `).join('');
}

function toggleAllWidgets(on) {
    const vis = getVisibility();
    WIDGETS.forEach(w => {
        vis[w.id] = on;
        const el = document.getElementById('box_' + w.id);
        if (el) el.classList.toggle('hidden', !on);
        const cb = document.getElementById('toggle_' + w.id);
        if (cb) cb.checked = on;
        if (on && !chartInstances[w.id]) loadWidget(w.id);
    });
    saveVisibility(vis);
}

function onWidgetToggle(widgetId, visible) {
    const vis = getVisibility();
    vis[widgetId] = visible;
    saveVisibility(vis);

    const el = document.getElementById('box_' + widgetId);
    if (el) {
        if (visible) {
            el.classList.remove('hidden');
            // Lazy load: build chart if not yet created
            if (!chartInstances[widgetId]) {
                loadWidget(widgetId);
            }
        } else {
            el.classList.add('hidden');
        }
    }
}

// ── Size popup helpers ───────────────────────────────────────────────────────
function closeSizePopups() {
    document.querySelectorAll('.size-popup.open').forEach(el => el.classList.remove('open'));
}

function openSizePopup(widgetId) {
    closeSizePopups();
    const popup = document.getElementById('popup_' + widgetId);
    if (!popup) return;
    const isFull = isFullWidth(widgetId);
    popup.querySelector('.check-normal').textContent = isFull ? '' : '\u2713';
    popup.querySelector('.check-full').textContent = isFull ? '\u2713' : '';
    popup.classList.add('open');
}

// Close popups when clicking elsewhere
document.addEventListener('click', (e) => {
    if (!e.target.closest('.size-popup') && !e.target.closest('.drag-handle')) {
        closeSizePopups();
    }
});

// ── Drag handle: click vs drag detection ────────────────────────────────────
let _handleMouseDown = 0;
let _handleMoved = false;

function onHandlePointerDown(e) {
    _handleMouseDown = Date.now();
    _handleMoved = false;
}

function onHandlePointerMove(e) {
    _handleMoved = true;
}

function onHandlePointerUp(e, widgetId) {
    const elapsed = Date.now() - _handleMouseDown;
    // Short click (< 200ms) and no drag movement → open settings
    if (elapsed < 200 && !_handleMoved) {
        e.preventDefault();
        e.stopPropagation();
        openSizePopup(widgetId);
    }
}

// ── Create widget box ───────────────────────────────────────────────────────
function createWidgetBox(widgetId, title, extraHtml = '') {
    const vis = getVisibility();
    const full = isFullWidth(widgetId);
    const box = document.createElement('div');
    box.className = 'chart-box' + (full ? ' full-width' : '') + (!vis[widgetId] ? ' hidden' : '');
    box.id = 'box_' + widgetId;
    box.setAttribute('data-widget', widgetId);
    box.innerHTML = `
        <span class="drag-handle" title="Klick: Breite \u00e4ndern | Halten: Verschieben"
              onpointerdown="onHandlePointerDown(event)"
              onpointermove="onHandlePointerMove(event)"
              onpointerup="onHandlePointerUp(event, '${widgetId}')">&#x2630;</span>
        <div class="size-popup" id="popup_${widgetId}">
            <div class="size-popup-item" onclick="setWidgetSize('${widgetId}', 'normal')">
                <span class="check check-normal"></span> Normal
            </div>
            <div class="size-popup-item" onclick="setWidgetSize('${widgetId}', 'full')">
                <span class="check check-full"></span> Volle Breite
            </div>
        </div>
        <h3>${title}</h3>
        <div class="chart-container"><canvas id="${widgetId}"></canvas></div>
        ${extraHtml}
    `;
    return box;
}

function buildChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return new Chart(canvas, config);
}

// ── Date range ──────────────────────────────────────────────────────────────
function qs(start, end) {
    return `?start=${start}&end=${end}`;
}

let activeFilter = null; // 'yesterday' | 'all' | null

function updateFilterButtons() {
    const btnYesterday = document.getElementById('btnYesterday');
    const btnAll = document.getElementById('btnAll');
    btnYesterday.classList.toggle('btn-active', activeFilter === 'yesterday');
    btnAll.classList.toggle('btn-active', activeFilter === 'all');
}

function setDateRange(start, end, filter = null) {
    document.getElementById('startDate').value = start;
    document.getElementById('endDate').value = end;
    currentStart = start;
    currentEnd = end;
    activeFilter = filter;
    updateFilterButtons();
    document.getElementById('subtitle').textContent = start === end ? start : `${start} bis ${end}`;
    loadScoreCards();
    loadAllWidgets();
}

function setYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    setDateRange(yesterday, yesterday, 'yesterday');
}

function setAllTime() {
    fetchJSON('/api/date-range').then(range => {
        if (range.min_day && range.max_day) {
            setDateRange(range.min_day, range.max_day, 'all');
        }
    });
}

function onDateChange() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (start && end && (start !== currentStart || end !== currentEnd)) {
        setDateRange(start, end, null);
    }
}

// ── Sync button ─────────────────────────────────────────────────────────────
async function triggerSync() {
    const btn = document.getElementById('syncBtn');
    btn.classList.add('syncing');
    btn.textContent = 'Syncing...';

    await fetchJSON('/api/sync', { method: 'POST' }).catch(() => {});

    // Poll status
    const poll = setInterval(async () => {
        const status = await fetchJSON('/api/sync/status');
        if (!status.running) {
            clearInterval(poll);
            btn.classList.remove('syncing');
            btn.textContent = 'Sync';
            // Reload data
            loadScoreCards();
            loadAllWidgets();
        }
    }, 2000);
}

// ── Score Cards ─────────────────────────────────────────────────────────────
async function loadScoreCards() {
    const scores = await fetchJSON(`/api/scores${qs(currentStart, currentEnd)}`);
    let html = '';

    if (scores.readiness) {
        html += `<div class="score-card"><div class="label">${tip('Readiness')}</div><div class="value color-green">${scores.readiness.score}</div><div class="unit">${scores.readiness.day}</div></div>`;
    }
    if (scores.sleep) {
        html += `<div class="score-card"><div class="label">${tip('Schlaf')}</div><div class="value color-blue">${scores.sleep.score}</div><div class="unit">${scores.sleep.day}</div></div>`;
    }
    if (scores.activity) {
        html += `<div class="score-card"><div class="label">${tip('Aktivitaet')}</div><div class="value color-purple">${scores.activity.score}</div><div class="unit">${scores.activity.day}</div></div>`;
    }
    if (scores.sleep_detail) {
        const sd = scores.sleep_detail;
        html += `<div class="score-card"><div class="label">${tip('Schlaf Dauer')}</div><div class="value color-cyan">${sec2h(sd.total_sleep_duration)}</div><div class="unit">Stunden</div></div>`;
        html += `<div class="score-card"><div class="label">${tip('Ruhe-HF')}</div><div class="value color-orange">${sd.lowest_heart_rate}</div><div class="unit">bpm</div></div>`;
        html += `<div class="score-card"><div class="label">${tip('HRV')}</div><div class="value color-green">${sd.average_hrv}</div><div class="unit">ms</div></div>`;
    }

    document.getElementById('scoreCards').innerHTML = html;
}

// ── Chart builders ──────────────────────────────────────────────────────────

function isSingleDay() { return currentStart === currentEnd; }

// Shared doughnut options for single-day gauges
function doughnutOpts(centerLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1a1a24', titleColor: '#e0e0e0', bodyColor: '#aaa',
                borderColor: '#2a2a3a', borderWidth: 1,
            },
        },
    };
}

// Center-text plugin (register once)
const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        const txt = chart.config.options?._centerText;
        if (!txt) return;
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = txt.color || '#e0e0e0';
        ctx.font = `bold ${txt.size || '2rem'} -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText(txt.main, cx, cy + 4);
        if (txt.sub) {
            ctx.font = `0.75rem -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillStyle = '#666';
            ctx.fillText(txt.sub, cx, cy + 24);
        }
        ctx.restore();
    }
};
Chart.register(centerTextPlugin);

// Horizontal bar options for single-day
function hbarOpts(max) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#1a1a24', titleColor: '#e0e0e0', bodyColor: '#aaa', borderColor: '#2a2a3a', borderWidth: 1 },
        },
        scales: {
            x: { min: 0, max, grid: { color: '#1f1f2e' }, ticks: { color: '#555' } },
            y: { grid: { display: false }, ticks: { color: '#aaa', font: { size: 13 } } },
        },
    };
}

async function buildScoresTrend() {
    const data = await fetchJSON(`/api/daily-scores${qs(currentStart, currentEnd)}`);

    if (isSingleDay()) {
        const r = data.readiness[0]?.score ?? 0;
        const s = data.sleep[0]?.score ?? 0;
        const a = data.activity[0]?.score ?? 0;
        return {
            type: 'bar',
            data: {
                labels: ['Readiness', 'Schlaf', 'Aktivit\u00e4t'],
                datasets: [{
                    data: [r, s, a],
                    backgroundColor: ['#6ee7b7', '#60a5fa', '#a78bfa'],
                    borderRadius: 6,
                    barThickness: 32,
                }]
            },
            options: hbarOpts(100),
        };
    }

    const allDays = [...new Set([
        ...data.readiness.map(d => d.day),
        ...data.sleep.map(d => d.day),
        ...data.activity.map(d => d.day),
    ])].sort();
    const rMap = Object.fromEntries(data.readiness.map(d => [d.day, d.score]));
    const sMap = Object.fromEntries(data.sleep.map(d => [d.day, d.score]));
    const aMap = Object.fromEntries(data.activity.map(d => [d.day, d.score]));
    const opts = makeOpts();
    opts.scales.y.min = 0; opts.scales.y.max = 100;
    opts.plugins.legend = { display: true, labels: { color: '#888' } };
    return {
        type: 'line',
        data: {
            labels: allDays,
            datasets: [
                { label: 'Readiness', data: allDays.map(d => rMap[d] ?? null), borderColor: '#6ee7b7', backgroundColor: '#6ee7b733', tension: 0.3, pointRadius: 3, spanGaps: true },
                { label: 'Schlaf', data: allDays.map(d => sMap[d] ?? null), borderColor: '#60a5fa', backgroundColor: '#60a5fa33', tension: 0.3, pointRadius: 3, spanGaps: true },
                { label: 'Aktivitaet', data: allDays.map(d => aMap[d] ?? null), borderColor: '#a78bfa', backgroundColor: '#a78bfa33', tension: 0.3, pointRadius: 3, spanGaps: true },
            ]
        },
        options: opts,
    };
}

async function buildSleepStages() {
    const data = await fetchJSON(`/api/sleep-stages${qs(currentStart, currentEnd)}`);
    if (!data.length) return null;

    if (isSingleDay()) {
        const d = data[0];
        const deep = +(sec2h(d.deep_sleep_duration));
        const light = +(sec2h(d.light_sleep_duration));
        const rem = +(sec2h(d.rem_sleep_duration));
        const awake = +(sec2h(d.awake_time));
        const total = (deep + light + rem + awake).toFixed(1);
        const opts = doughnutOpts();
        opts._centerText = { main: `${total}h`, sub: 'Gesamt' };
        return {
            type: 'doughnut',
            data: {
                labels: ['Tiefschlaf', 'Leicht', 'REM', 'Wach'],
                datasets: [{
                    data: [deep, light, rem, awake],
                    backgroundColor: ['#6366f1', '#60a5fa', '#a78bfa', '#f87171'],
                    borderWidth: 0,
                }]
            },
            options: opts,
        };
    }

    const nights = data.map(d => d.day);
    const opts = makeOpts();
    opts.scales.x = { ...opts.scales.x, stacked: true };
    opts.scales.y = { ...opts.scales.y, stacked: true, title: { display: true, text: 'Stunden', color: '#555' } };
    return {
        type: 'bar',
        data: {
            labels: nights,
            datasets: [
                { label: 'Tiefschlaf', data: data.map(d => +(sec2h(d.deep_sleep_duration))), backgroundColor: '#6366f1' },
                { label: 'Leicht', data: data.map(d => +(sec2h(d.light_sleep_duration))), backgroundColor: '#60a5fa' },
                { label: 'REM', data: data.map(d => +(sec2h(d.rem_sleep_duration))), backgroundColor: '#a78bfa' },
                { label: 'Wach', data: data.map(d => +(sec2h(d.awake_time))), backgroundColor: '#f87171' },
            ]
        },
        options: opts,
    };
}

async function buildHrHrv() {
    const data = await fetchJSON(`/api/hr-hrv${qs(currentStart, currentEnd)}`);
    if (!data.length) return null;

    if (isSingleDay()) {
        const d = data[0];
        return {
            type: 'bar',
            data: {
                labels: ['Ruhe-HF (bpm)', 'HRV (ms)'],
                datasets: [{
                    data: [d.lowest_heart_rate, d.average_hrv],
                    backgroundColor: ['#f87171', '#6ee7b7'],
                    borderRadius: 6,
                    barThickness: 32,
                }]
            },
            options: hbarOpts(Math.max(d.lowest_heart_rate, d.average_hrv, 80) + 20),
        };
    }

    const nights = data.map(d => d.day);
    const opts = makeOpts();
    opts.plugins.legend = { display: true, labels: { color: '#888' } };
    opts.scales.y = { position: 'left', grid: { color: '#1f1f2e' }, ticks: { color: '#555' }, title: { display: true, text: 'bpm', color: '#555' } };
    opts.scales.y1 = { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#555' }, title: { display: true, text: 'ms (HRV)', color: '#555' } };
    return {
        type: 'line',
        data: {
            labels: nights,
            datasets: [
                { label: 'Ruhe-HF', data: data.map(d => d.lowest_heart_rate), borderColor: '#f87171', tension: 0.3, pointRadius: 3, yAxisID: 'y' },
                { label: 'HRV', data: data.map(d => d.average_hrv), borderColor: '#6ee7b7', tension: 0.3, pointRadius: 3, yAxisID: 'y1' },
            ]
        },
        options: opts,
    };
}

async function buildSteps() {
    const data = await fetchJSON(`/api/steps${qs(currentStart, currentEnd)}`);
    if (!data.length) return null;

    if (isSingleDay()) {
        const steps = data[0].steps || 0;
        const goal = 10000;
        const opts = doughnutOpts();
        opts._centerText = { main: steps.toLocaleString('de-DE'), sub: `/ ${goal.toLocaleString('de-DE')} Ziel` };
        return {
            type: 'doughnut',
            data: {
                labels: ['Schritte', 'Verbleibend'],
                datasets: [{
                    data: [steps, Math.max(goal - steps, 0)],
                    backgroundColor: ['#a78bfa', '#1f1f2e'],
                    borderWidth: 0,
                }]
            },
            options: opts,
        };
    }

    const opts = makeOpts();
    opts.scales.y.title = { display: true, text: 'Schritte', color: '#555' };
    return {
        type: 'bar',
        data: {
            labels: data.map(d => d.day),
            datasets: [{ data: data.map(d => d.steps), backgroundColor: '#a78bfa88', borderColor: '#a78bfa', borderWidth: 1, borderRadius: 4 }]
        },
        options: opts,
    };
}

async function buildStress() {
    const data = await fetchJSON(`/api/stress${qs(currentStart, currentEnd)}`);
    const filtered = data.filter(d => d.stress_high != null);
    if (!filtered.length) return null;

    if (isSingleDay()) {
        const d = filtered[0];
        const stressMin = sec2min(d.stress_high || 0);
        const recoveryMin = sec2min(d.recovery_high || 0);
        return {
            type: 'bar',
            data: {
                labels: ['Stress', 'Erholung'],
                datasets: [{
                    data: [stressMin, recoveryMin],
                    backgroundColor: ['#f87171', '#6ee7b7'],
                    borderRadius: 6,
                    barThickness: 32,
                }]
            },
            options: hbarOpts(Math.max(stressMin, recoveryMin) + 30),
        };
    }

    const opts = makeOpts();
    opts.plugins.legend = { display: true, labels: { color: '#888' } };
    opts.scales.y.title = { display: true, text: 'Minuten', color: '#555' };
    return {
        type: 'bar',
        data: {
            labels: filtered.map(d => d.day),
            datasets: [
                { label: 'Stress', data: filtered.map(d => sec2min(d.stress_high || 0)), backgroundColor: '#f8717188', borderColor: '#f87171', borderWidth: 1, borderRadius: 4 },
                { label: 'Erholung', data: filtered.map(d => sec2min(d.recovery_high || 0)), backgroundColor: '#6ee7b788', borderColor: '#6ee7b7', borderWidth: 1, borderRadius: 4 },
            ]
        },
        options: opts,
    };
}

async function buildSpo2() {
    const data = await fetchJSON(`/api/spo2${qs(currentStart, currentEnd)}`);
    const filtered = data.filter(d => d.spo2_average && d.spo2_average > 0);
    if (!filtered.length) return null;

    if (isSingleDay()) {
        const val = +filtered[0].spo2_average.toFixed(1);
        const opts = doughnutOpts();
        opts._centerText = { main: `${val}%`, color: '#22d3ee' };
        return {
            type: 'doughnut',
            data: {
                labels: ['SpO2', ''],
                datasets: [{
                    data: [val - 90, 100 - val],  // scale 90-100 range
                    backgroundColor: ['#22d3ee', '#1f1f2e'],
                    borderWidth: 0,
                }]
            },
            options: opts,
        };
    }

    const opts = makeOpts();
    opts.scales.y.min = 90; opts.scales.y.max = 100;
    opts.scales.y.title = { display: true, text: '%', color: '#555' };
    return {
        type: 'line',
        data: {
            labels: filtered.map(d => d.day),
            datasets: [{ data: filtered.map(d => d.spo2_average), borderColor: '#22d3ee', backgroundColor: '#22d3ee22', fill: true, tension: 0.3, pointRadius: 3 }]
        },
        options: opts,
    };
}

async function buildCvAge() {
    const data = await fetchJSON('/api/cardiovascular-age');
    const realAge = personalInfo.age || 24;

    if (isSingleDay()) {
        const match = data.find(d => d.day === currentStart);
        const vAge = match ? match.vascular_age : null;
        if (vAge == null) return null;
        const maxAge = Math.max(vAge, realAge) + 10;
        return {
            type: 'bar',
            data: {
                labels: ['Kardio-Alter', 'Echtes Alter'],
                datasets: [{
                    data: [vAge, realAge],
                    backgroundColor: ['#fbbf24', '#555'],
                    borderRadius: 6,
                    barThickness: 32,
                }]
            },
            options: hbarOpts(maxAge),
        };
    }

    const opts = makeOpts();
    opts.plugins.legend = { display: true, labels: { color: '#888' } };
    opts.scales.y.title = { display: true, text: 'Alter (Jahre)', color: '#555' };
    return {
        type: 'line',
        data: {
            labels: data.map(d => d.day),
            datasets: [
                { label: 'Kardio-Alter', data: data.map(d => d.vascular_age), borderColor: '#fbbf24', tension: 0.3, pointRadius: 3 },
                { label: 'Echtes Alter', data: data.map(d => realAge), borderColor: '#555', borderDash: [5, 5], pointRadius: 0 },
            ]
        },
        options: opts,
    };
}

async function buildCalories() {
    const data = await fetchJSON(`/api/calories${qs(currentStart, currentEnd)}`);
    if (!data.length) return null;

    if (isSingleDay()) {
        const d = data[0];
        const active = d.active_calories || 0;
        const basal = (d.total_calories || 0) - active;
        const opts = doughnutOpts();
        opts._centerText = { main: `${d.total_calories}`, sub: 'kcal gesamt' };
        opts.plugins.legend = { display: true, position: 'bottom', labels: { color: '#888', padding: 16 } };
        return {
            type: 'doughnut',
            data: {
                labels: ['Aktiv', 'Grundumsatz'],
                datasets: [{
                    data: [active, basal],
                    backgroundColor: ['#6ee7b7', '#3b82f6'],
                    borderWidth: 0,
                }]
            },
            options: opts,
        };
    }

    const opts = makeOpts();
    opts.plugins.legend = { display: true, labels: { color: '#888' } };
    opts.scales.y.title = { display: true, text: 'kcal', color: '#555' };
    return {
        type: 'bar',
        data: {
            labels: data.map(d => d.day),
            datasets: [
                { label: 'Aktive Kalorien', data: data.map(d => d.active_calories), backgroundColor: '#6ee7b788', borderColor: '#6ee7b7', borderWidth: 1, borderRadius: 4 },
                { label: 'Gesamt', data: data.map(d => d.total_calories), backgroundColor: '#3b82f633', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4 },
            ]
        },
        options: opts,
    };
}

async function buildSleepEff() {
    const data = await fetchJSON(`/api/sleep-efficiency${qs(currentStart, currentEnd)}`);
    if (!data.length) return null;

    if (isSingleDay()) {
        const eff = data[0].efficiency || 0;
        const opts = doughnutOpts();
        opts._centerText = { main: `${eff}%`, color: '#60a5fa' };
        return {
            type: 'doughnut',
            data: {
                labels: ['Effizienz', ''],
                datasets: [{
                    data: [eff, 100 - eff],
                    backgroundColor: ['#60a5fa', '#1f1f2e'],
                    borderWidth: 0,
                }]
            },
            options: opts,
        };
    }

    const opts = makeOpts();
    opts.scales.y.min = 70; opts.scales.y.max = 100;
    opts.scales.y.title = { display: true, text: '%', color: '#555' };
    return {
        type: 'line',
        data: {
            labels: data.map(d => d.day),
            datasets: [{ data: data.map(d => d.efficiency), borderColor: '#60a5fa', backgroundColor: '#60a5fa22', fill: true, tension: 0.3, pointRadius: 3 }]
        },
        options: opts,
    };
}

async function buildHr24() {
    // In single-day mode, fetch HR for that specific day
    const dateParam = isSingleDay() ? `?date=${currentStart}` : '';
    const data = await fetchJSON(`/api/heartrate${dateParam}`);
    if (!data.length) return null;

    const times = data.map(h => h.timestamp.slice(11, 16));
    const bpms = data.map(h => h.bpm);
    const lastDay = data[0].timestamp.slice(0, 10);

    const box = document.getElementById('box_hr24');
    if (box) {
        box.querySelector('h3').innerHTML = tip('Herzfrequenz') + ` am ${lastDay}`;
    }

    const opts = makeOpts();
    opts.scales.y.title = { display: true, text: 'bpm', color: '#555' };
    return {
        type: 'line',
        data: {
            labels: times,
            datasets: [{ data: bpms, borderColor: '#f8717188', borderWidth: 1.5, pointRadius: 0, tension: 0.1 }]
        },
        options: opts,
    };
}

async function buildResilience() {
    const data = await fetchJSON(`/api/stress${qs(currentStart, currentEnd)}`);
    const filtered = data.filter(d => d.recovery_high != null && d.stress_high != null);
    if (!filtered.length) return null;

    if (isSingleDay()) {
        const d = filtered[0];
        const ratio = d.stress_high > 0 ? +(d.recovery_high / d.stress_high).toFixed(2) : 0;
        const opts = doughnutOpts();
        opts._centerText = { main: `${ratio}`, sub: 'Erholung/Stress', color: ratio >= 1 ? '#6ee7b7' : '#f87171' };
        return {
            type: 'doughnut',
            data: {
                labels: ['Erholung', 'Stress'],
                datasets: [{
                    data: [d.recovery_high, d.stress_high],
                    backgroundColor: ['#6ee7b7', '#f87171'],
                    borderWidth: 0,
                }]
            },
            options: opts,
        };
    }

    const opts = makeOpts();
    opts.scales.y.title = { display: true, text: 'Ratio', color: '#555' };
    return {
        type: 'line',
        data: {
            labels: filtered.map(d => d.day),
            datasets: [{
                label: 'Erholung/Stress',
                data: filtered.map(d => d.stress_high > 0 ? +(d.recovery_high / d.stress_high).toFixed(2) : null),
                borderColor: '#6ee7b7',
                backgroundColor: '#6ee7b722',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                spanGaps: true,
            }]
        },
        options: opts,
    };
}

// ── Widget → builder mapping ────────────────────────────────────────────────
const BUILDERS = {
    scoresTrend: { build: buildScoresTrend, title: () => 'Tages-Scores (' + tip('Readiness') + ' / ' + tip('Schlaf') + ' / ' + tip('Aktivitaet') + ')' },
    sleepStages: { build: buildSleepStages, title: () => tip('Schlaf-Phasen') + ' pro Nacht',
        extraHtml: `<div class="sleep-legend"><span class="leg-deep">${tip('Tiefschlaf')}</span><span class="leg-light">${tip('Leicht')}</span><span class="leg-rem">${tip('REM')}</span><span class="leg-awake">${tip('Wach')}</span></div>` },
    hrHrv:       { build: buildHrHrv,       title: () => tip('Ruhe-Herzfrequenz') + ' & ' + tip('HRV') },
    steps:       { build: buildSteps,       title: () => 'T\u00e4gliche ' + tip('Schritte') },
    stress:      { build: buildStress,      title: () => tip('Stress') + ' vs. ' + tip('Erholung') },
    spo2:        { build: buildSpo2,        title: () => tip('SpO2') + ' (' + tip('Blutsauerstoff') + ')' },
    cvAge:       { build: buildCvAge,       title: () => tip('Kardiovaskulaeres Alter') + ' vs. echtes Alter' },
    calories:    { build: buildCalories,    title: () => tip('Kalorien') + ' (aktiv vs. gesamt)' },
    sleepEff:    { build: buildSleepEff,    title: () => tip('Schlaf-Effizienz') },
    hr24:        { build: buildHr24,        title: () => tip('Herzfrequenz') + ' (24h)' },
    resilience:  { build: buildResilience,  title: () => 'Erholung/Stress Ratio' },
};

// ── Load a single widget ────────────────────────────────────────────────────
async function loadWidget(widgetId) {
    const builder = BUILDERS[widgetId];
    if (!builder) return;

    try {
        const config = await builder.build();
        if (!config) return;

        // Destroy previous chart if exists
        if (chartInstances[widgetId]) {
            chartInstances[widgetId].destroy();
            delete chartInstances[widgetId];
        }

        // Replace canvas to ensure clean state (needed for type switches like line→doughnut)
        const oldCanvas = document.getElementById(widgetId);
        if (oldCanvas) {
            const newCanvas = document.createElement('canvas');
            newCanvas.id = widgetId;
            oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
        }

        const chart = buildChart(widgetId, config);
        if (chart) chartInstances[widgetId] = chart;
    } catch (err) {
        console.error(`Error loading widget ${widgetId}:`, err);
    }
}

// ── Build all widget boxes (DOM) ────────────────────────────────────────────
function buildWidgetGrid() {
    const grid = document.getElementById('widgetGrid');
    grid.innerHTML = '';

    const order = getOrder();
    // Add any new widgets not in saved order
    WIDGETS.forEach(w => {
        if (!order.includes(w.id)) order.push(w.id);
    });

    order.forEach(widgetId => {
        const builder = BUILDERS[widgetId];
        if (!builder) return;
        const box = createWidgetBox(widgetId, builder.title(), builder.extraHtml || '');
        grid.appendChild(box);
    });

    // Init SortableJS
    if (window.Sortable) {
        Sortable.create(grid, {
            handle: '.drag-handle',
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: () => {
                const newOrder = Array.from(grid.children).map(el => el.getAttribute('data-widget')).filter(Boolean);
                saveOrder(newOrder);
            }
        });
    }
}

// ── Load all visible widgets ────────────────────────────────────────────────
async function loadAllWidgets() {
    const vis = getVisibility();
    const promises = [];

    WIDGETS.forEach(w => {
        if (vis[w.id]) {
            promises.push(loadWidget(w.id));
        }
    });

    await Promise.all(promises);
}

// ── Tooltip overflow fix ────────────────────────────────────────────────────
document.addEventListener('mouseover', function(e) {
    const el = e.target.closest('.tip');
    if (!el) return;
    const tt = el.querySelector('.tip-text');
    if (!tt) return;
    tt.style.left = '50%';
    tt.style.transform = 'translateX(-50%)';
    tt.style.bottom = 'calc(100% + 8px)';
    tt.style.top = 'auto';
    tt.style.right = 'auto';
    requestAnimationFrame(() => {
        const r = tt.getBoundingClientRect();
        if (r.left < 8) {
            tt.style.left = '0';
            tt.style.transform = 'translateX(0)';
        } else if (r.right > window.innerWidth - 8) {
            tt.style.left = 'auto';
            tt.style.right = '0';
            tt.style.transform = 'translateX(0)';
        }
        if (r.top < 8) {
            tt.style.bottom = 'auto';
            tt.style.top = 'calc(100% + 8px)';
        }
    });
});

// ── Initialize ──────────────────────────────────────────────────────────────
async function init() {
    // Load personal info
    personalInfo = await fetchJSON('/api/personal-info');

    // Load profile display
    if (personalInfo && personalInfo.age) {
        document.getElementById('profile').innerHTML = `
            <div class="profile-item">Alter: <span>${personalInfo.age}</span></div>
            <div class="profile-item">Gewicht: <span>${personalInfo.weight} kg</span></div>
            <div class="profile-item">Gr\u00f6\u00dfe: <span>${(personalInfo.height * 100).toFixed(0)} cm</span></div>
        `;
    }

    // Get date range from DB
    const range = await fetchJSON('/api/date-range');
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    if (range.min_day && range.max_day) {
        startInput.value = range.min_day;
        endInput.value = range.max_day;
        currentStart = range.min_day;
        currentEnd = range.max_day;
        document.getElementById('subtitle').textContent = `${range.min_day} bis ${range.max_day} \u00b7 ${Math.round((new Date(range.max_day) - new Date(range.min_day)) / 86400000)} Tage`;
    } else {
        // Fallback: last 30 days
        const now = new Date();
        const end = now.toISOString().slice(0, 10);
        const start = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
        startInput.value = start;
        endInput.value = end;
        currentStart = start;
        currentEnd = end;
    }

    // Listen for date changes
    startInput.addEventListener('change', onDateChange);
    endInput.addEventListener('change', onDateChange);

    // Build UI
    loadScoreCards();
    buildWidgetToggles();
    buildWidgetGrid();
    loadAllWidgets();
}

init();
