// Tab 4 — XP curve: configurable formula, level table, Chart.js graph, export.

import { h, clear, fmt, field, numberInput, select } from '../core/dom.js';
import { getState, update } from '../core/store.js';
import { validRows } from '../core/validate.js';
import { downloadCSV, downloadJSON } from '../core/io.js';
import { FORMULAS, buildLevelTable, describeFormula } from '../domain/progression.js';
import { onThemeChange, cssVar } from './theme.js';

const MAX_LEVEL_LIMIT = 200;

const PARAM_FIELDS = {
  a: { label: 'a — базовый опыт', min: 0 },
  b: { label: 'b — степень', min: 0 },
  c: { label: 'c — линейная добавка', min: 0 },
  r: { label: 'r — рост за уровень', min: 1 },
};

const fmtMinutes = (m) => {
  if (m == null) return '—';
  if (m < 60) return `${fmt(m, 1)} мин`;
  return `${fmt(m / 60, 1)} ч`;
};

export function createProgressionTab() {
  const settingsCard = h('div', { class: 'card' });
  const summary = h('div', { class: 'stats' });
  const formulaBox = h('div', { class: 'formula-box' });
  const canvas = h('canvas', { 'aria-label': 'График опыта по уровням', role: 'img' });
  const chartBox = h('div', { class: 'chart-box' }, canvas);
  const tableWrap = h('div', { class: 'table-wrap' });
  let chart = null;
  let rows = [];

  const params = () => getState().settings.progression;
  const selectedUnit = () => validRows('units', getState().units).find((u) => String(u.id) === String(params().unitId)) ?? null;

  function set(key, value) {
    update((s) => { s.settings.progression[key] = value; }, 'progression');
    if (key === 'formula') renderSettings();
    renderOutput();
  }

  function renderSettings() {
    const p = params();
    const units = validRows('units', getState().units);
    clear(settingsCard).append(
      h('h2', {}, 'Параметры кривой'),
      field('Формула опыта до следующего уровня', select(
        Object.entries(FORMULAS).map(([value, f]) => ({ value, label: f.label })), p.formula, (v) => set('formula', v),
      )),
      h('div', { class: 'fields-2' },
        FORMULAS[p.formula].params.map((key) => field(PARAM_FIELDS[key].label,
          numberInput({ value: p[key], min: PARAM_FIELDS[key].min, onChange: (v) => set(key, v) }))),
        field('Макс. уровень', numberInput({ value: p.maxLevel, min: 2, max: MAX_LEVEL_LIMIT, step: 1, onChange: (v) => set('maxLevel', Math.round(v)) })),
        field('Опыт в минуту', numberInput({ value: p.xpPerMinute, min: 0, onChange: (v) => set('xpPerMinute', v) }), 'для оценки времени'),
      ),
      h('h3', { style: 'margin-top:8px' }, 'Рост статов юнита'),
      h('div', { class: 'fields-2', style: 'margin-top:8px' },
        field('Юнит', select([{ value: '', label: '— не показывать —' }, ...units.map((u) => ({ value: u.id, label: u.name }))], p.unitId, (v) => set('unitId', v))),
        field('Рост за уровень, %', numberInput({ value: p.statGrowth * 100, min: 0, onChange: (v) => set('statGrowth', v / 100) })),
      ),
      h('p', { class: 'hint' }, 'Стат(L) = round(база × (1 + рост)^(L−1)) — для HP и атаки выбранного юнита.'),
    );
  }

  function renderChart() {
    if (!window.Chart) {
      clear(chartBox).append(h('div', { class: 'alert alert--warn' }, 'Chart.js не загрузился (нет интернета?). Таблица уровней ниже работает и без графика.'));
      return;
    }
    const levels = rows.filter((r) => r.xpToNext != null);
    const text = cssVar('--text-muted');
    const grid = cssVar('--border');
    const data = {
      labels: levels.map((r) => r.level),
      datasets: [
        { type: 'bar', label: 'Опыт до следующего уровня', data: levels.map((r) => r.xpToNext), backgroundColor: cssVar('--accent'), yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Всего опыта на уровне', data: levels.map((r) => r.totalXp), borderColor: cssVar('--warn'), backgroundColor: cssVar('--warn'), pointRadius: 0, borderWidth: 2, yAxisID: 'y1', order: 1 },
      ],
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: text } } },
      scales: {
        x: { title: { display: true, text: 'Уровень', color: text }, ticks: { color: text }, grid: { color: grid } },
        y: { title: { display: true, text: 'Опыт до след. уровня', color: text }, ticks: { color: text }, grid: { color: grid }, beginAtZero: true },
        y1: { position: 'right', title: { display: true, text: 'Накоплено', color: text }, ticks: { color: text }, grid: { drawOnChartArea: false }, beginAtZero: true },
      },
    };
    if (chart) {
      chart.data = data;
      chart.options = options;
      chart.update();
    } else {
      chart = new window.Chart(canvas, { data, options });
    }
  }

  function renderOutput() {
    const p = params();
    const unit = selectedUnit();
    rows = buildLevelTable(p, unit);
    const last = rows[rows.length - 1];

    formulaBox.textContent = describeFormula(p);
    clear(summary).append(
      h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, `Опыта до ${p.maxLevel} ур.`), h('div', { class: 'stat__value' }, fmt(last.totalXp))),
      h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Время прокачки'), h('div', { class: 'stat__value' }, fmtMinutes(last.totalMinutes))),
      h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Уровень 1 → 2'), h('div', { class: 'stat__value' }, fmt(rows[0].xpToNext))),
      h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, `Уровень ${p.maxLevel - 1} → ${p.maxLevel}`), h('div', { class: 'stat__value' }, fmt(rows[rows.length - 2].xpToNext))),
    );

    clear(tableWrap).append(h('table', { class: 'table' },
      h('thead', {}, h('tr', {},
        h('th', { class: 'num' }, 'Уровень'),
        h('th', { class: 'num' }, 'Опыт до след.'),
        h('th', { class: 'num' }, 'Всего опыта'),
        h('th', { class: 'num' }, 'Рост, %'),
        h('th', { class: 'num' }, 'Время уровня'),
        h('th', { class: 'num' }, 'Время всего'),
        unit ? [h('th', { class: 'num' }, `HP (${unit.name})`), h('th', { class: 'num' }, 'Атака')] : null,
      )),
      h('tbody', {}, rows.map((r) => h('tr', {},
        h('td', { class: 'num' }, r.level),
        h('td', { class: 'num' }, r.xpToNext == null ? 'макс.' : fmt(r.xpToNext)),
        h('td', { class: 'num' }, fmt(r.totalXp)),
        h('td', { class: 'num' }, r.growthPct == null ? '—' : `${fmt(r.growthPct, 1)}`),
        h('td', { class: 'num' }, fmtMinutes(r.minutes)),
        h('td', { class: 'num' }, fmtMinutes(r.totalMinutes)),
        unit ? [h('td', { class: 'num' }, fmt(r.hp)), h('td', { class: 'num' }, fmt(r.attack))] : null,
      ))),
    ));
    renderChart();
  }

  function exportColumns() {
    const base = ['level', 'xpToNext', 'totalXp', 'growthPct', 'minutes', 'totalMinutes'];
    return selectedUnit() ? [...base, 'hp', 'attack'] : base;
  }

  onThemeChange(() => {
    if (chart) renderChart();
  });

  return {
    id: 'progression',
    title: 'Прогрессия',
    mount(panel) {
      panel.append(h('div', { class: 'grid grid--sidebar' },
        settingsCard,
        h('div', { class: 'stack' },
          h('div', { class: 'card' },
            h('div', { class: 'card__head' },
              h('h2', {}, 'Кривая опыта'),
              h('div', { class: 'row' },
                h('button', { class: 'btn btn--ghost btn--small', onClick: () => downloadCSV('progression', exportColumns(), rows) }, 'CSV'),
                h('button', { class: 'btn btn--ghost btn--small', onClick: () => downloadJSON('progression', { params: params(), levels: rows }) }, 'JSON'),
              ),
            ),
            formulaBox,
            summary,
            chartBox,
          ),
          h('div', { class: 'card' }, h('h2', {}, 'Таблица уровней'), tableWrap),
        ),
      ));
    },
    render() {
      renderSettings();
      renderOutput();
    },
  };
}
