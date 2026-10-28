// Tab 2 — units table editor with live validation and balance audit.

import { h, clear, fmt, badge, numberInput, field } from '../core/dom.js';
import { getState, update } from '../core/store.js';
import { downloadCSV, downloadJSON } from '../core/io.js';
import { auditUnits } from '../domain/audit.js';
import { createDataGrid, nextId } from './dataGrid.js';

const VERDICTS = {
  dominant: ['доминирует', 'warn', 'Сильнее остальных за свою цену: проверьте, не стоит ли ослабить или поднять цену'],
  weak: ['бесполезен', 'error', 'Слабее остальных за свою цену: игроку невыгодно его покупать'],
  ok: ['норма', 'ok', 'Эффективность за цену близка к медиане'],
};

export function createTableTab() {
  const summary = h('div', { class: 'row' });
  const auditInfo = h('div');

  const grid = createDataGrid({
    type: 'units',
    ownerId: 'table',
    analyze: (rows, validation) => {
      const valid = rows.filter((_, i) => !validation.invalid.has(i));
      const { combat, audit } = getState().settings;
      return { audit: auditUnits(valid, combat, audit) };
    },
    extraColumns: [
      {
        title: 'Сила / цена',
        className: 'num',
        cell: (row, _i, ctx) => {
          const a = ctx.audit.get(row);
          return a ? fmt(a.value, 2) : '—';
        },
      },
      {
        title: 'Аудит',
        cell: (row, _i, ctx) => {
          const a = ctx.audit.get(row);
          if (!a) return '';
          const [label, kind, title] = VERDICTS[a.verdict];
          return badge(label, kind, title);
        },
      },
    ],
    newRow: (rows) => ({ id: nextId(rows), name: 'Новый юнит', hp: 100, attack: 20, defense: 5, cost: 100 }),
    placeholders: () => {
      const c = getState().settings.combat;
      return { crit_chance: String(c.critChance), crit_mult: String(c.critMult), attack_speed: String(c.attackSpeed) };
    },
  });

  grid.element.addEventListener('grid:refresh', (event) => {
    const validation = event.detail;
    const rows = validation.rows.length;
    clear(summary).append(
      badge(`Строк: ${rows}`, 'neutral'),
      validation.invalid.size
        ? badge(`С ошибками: ${validation.invalid.size} — наведите на красную ячейку`, 'error')
        : badge('Ошибок нет', 'ok'),
    );
  });

  function renderAuditInfo() {
    const settings = getState().settings.audit;
    const threshold = numberInput({
      value: settings.threshold * 100,
      min: 1,
      max: 100,
      onChange: (v) => {
        update((s) => { s.settings.audit.threshold = v / 100; }, 'table');
        grid.refresh();
      },
    });
    clear(auditInfo).append(
      h('h3', {}, 'Аудит баланса'),
      h('p', { class: 'muted' },
        'Для каждой пары юнитов считается отношение «сколько я живу против него» / «за сколько я его убиваю» (по TTK). ',
        'Сила юнита — среднее геометрическое этих отношений, затем делится на цену и сравнивается с медианой. ',
        '«Сила / цена» = 1 — как у медианного юнита.'),
      h('div', { style: 'max-width:240px' }, field('Порог отклонения от медианы, %', threshold)),
      h('p', { class: 'hint' }, 'Нужно минимум 3 юнита без ошибок. Юниты с ошибками в аудит не попадают.'),
    );
  }

  const search = h('input', { class: 'input', type: 'search', placeholder: 'Поиск по таблице…', style: 'max-width:260px' });
  search.addEventListener('input', () => grid.setFilter(search.value));

  return {
    id: 'table',
    title: 'Таблица',
    mount(panel) {
      panel.append(h('div', { class: 'stack' },
        h('div', { class: 'card' },
          h('div', { class: 'card__head' },
            h('h2', {}, 'Юниты'),
            h('div', { class: 'row' },
              search,
              h('button', { class: 'btn', title: 'Alt+N', onClick: () => grid.addRow() }, '+ Строка'),
              h('button', { class: 'btn btn--ghost', onClick: () => { const u = getState().units; downloadCSV('units', u.columns, u.rows); } }, 'CSV'),
              h('button', { class: 'btn btn--ghost', onClick: () => downloadJSON('units', getState().units.rows) }, 'JSON'),
            ),
          ),
          h('div', { style: 'margin-bottom:10px' }, summary),
          grid.element,
          h('p', { class: 'hint' }, 'Изменения сохраняются автоматически. Клик по заголовку — сортировка.'),
          h('p', { class: 'hint' }, 'crit_chance, crit_mult и attack_speed можно не заполнять: серое значение в пустой ячейке — значение по умолчанию из вкладки TTK, оно и используется в расчётах.'),
        ),
        h('div', { class: 'card' }, auditInfo),
      ));
    },
    render() {
      grid.render();
      renderAuditInfo();
    },
    addRow: () => grid.addRow(),
  };
}
