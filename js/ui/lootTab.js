// Tab 5 — loot tables: sum-to-100% check per table, error highlighting, normalization, export.

import { h, clear, fmt, badge, toast } from '../core/dom.js';
import { getState, update } from '../core/store.js';
import { downloadCSV, downloadJSON } from '../core/io.js';
import { checkLootTables, expectedPerOpens, normalizeTable, SUM_TOLERANCE } from '../domain/loot.js';
import { createDataGrid } from './dataGrid.js';

const OPENS = 100;

export function createLootTab() {
  const groupsBox = h('div', { class: 'group-list' });
  const statusBox = h('div');

  const grid = createDataGrid({
    type: 'loot',
    ownerId: 'loot',
    analyze: (rows) => {
      const check = checkLootTables(rows);
      const badRows = new Set(check.groups.filter((g) => !g.ok).flatMap((g) => g.indexes));
      return { check, badRows };
    },
    rowStatus: (index, ctx) => (ctx.badRows.has(index) ? 'warn' : null),
    extraColumns: [{
      title: `В среднем за ${OPENS} открытий`,
      className: 'num',
      cell: (row) => {
        const v = expectedPerOpens(row, OPENS);
        return Number.isFinite(v) ? fmt(v, 1) : '—';
      },
    }],
    newRow: (rows) => ({ table: rows[rows.length - 1]?.table ?? 'new_table', item: '', chance: 0, min_qty: 1, max_qty: 1 }),
  });

  function normalize(table) {
    update((s) => { s.loot.rows = normalizeTable(s.loot.rows, table); }, 'loot-normalize');
    toast(`Таблица «${table}» приведена к 100%`, 'ok');
  }

  function buildReport(validation) {
    const check = checkLootTables(validation.rows);
    return {
      checkedAt: new Date().toISOString(),
      ok: check.ok && validation.ok,
      tolerancePct: SUM_TOLERANCE,
      tables: check.groups.map((g) => ({
        table: g.table,
        items: g.count,
        sumPct: g.sum,
        diffPct: g.diff,
        ok: g.ok,
        rows: g.indexes.map((i) => ({ ...validation.rows[i], expectedPer100: expectedPerOpens(validation.rows[i], OPENS) })),
      })),
      rowErrors: validation.issues.map((i) => ({ row: i.index + 1, column: i.column, message: i.message })),
    };
  }

  function exportReport(format) {
    const validation = grid.validation();
    const report = buildReport(validation);
    if (format === 'json') {
      downloadJSON('loot_report', report);
      return;
    }
    const rows = report.tables.flatMap((t) => t.rows.map((r) => ({
      table: t.table, item: r.item, chance: r.chance, min_qty: r.min_qty ?? '', max_qty: r.max_qty ?? '',
      expected_per_100: r.expectedPer100, table_sum: t.sumPct, table_ok: t.ok ? 'OK' : 'ОШИБКА',
    })));
    downloadCSV('loot_report', ['table', 'item', 'chance', 'min_qty', 'max_qty', 'expected_per_100', 'table_sum', 'table_ok'], rows);
  }

  grid.element.addEventListener('grid:refresh', (event) => {
    const validation = event.detail;
    const check = checkLootTables(validation.rows);
    const badTables = check.groups.filter((g) => !g.ok);

    clear(statusBox).append(
      badTables.length || validation.issues.length
        ? h('div', { class: 'alert alert--error' },
          badTables.length ? `Сумма не равна 100% в таблицах: ${badTables.map((g) => g.table).join(', ')}. ` : '',
          validation.issues.length ? `Ошибок в строках: ${validation.issues.length} (красные ячейки, наведите для подробностей).` : '')
        : h('div', { class: 'alert alert--ok' }, `Все таблицы в порядке: ${check.groups.length} шт., сумма каждой = 100%.`),
    );

    clear(groupsBox).append(...check.groups.map((g) => h('div', { class: `group-card ${g.ok ? '' : 'group-card--error'}` },
      h('div', { class: 'group-card__name' }, g.table, g.ok ? badge('OK', 'ok') : badge(g.diff > 0 ? `+${fmt(g.diff)}%` : `${fmt(g.diff)}%`, 'error')),
      h('div', { class: 'group-card__sum' }, `${fmt(g.sum)}%`),
      h('div', { class: 'progress' }, h('div', { class: 'progress__bar', style: `width:${Math.min(100, Math.max(0, g.sum))}%` })),
      h('div', { class: 'row' },
        h('span', { class: 'muted' }, `предметов: ${g.count}`),
        h('span', { class: 'spacer' }),
        !g.ok && !g.invalidChance && g.sum > 0
          ? h('button', { class: 'btn btn--ghost btn--small', title: 'Пропорционально масштабировать шансы', onClick: () => normalize(g.table) }, 'Привести к 100%')
          : null,
      ),
    )));
  });

  return {
    id: 'loot',
    title: 'Лут',
    mount(panel) {
      panel.append(h('div', { class: 'stack' },
        h('div', { class: 'card' },
          h('div', { class: 'card__head' },
            h('h2', {}, 'Проверка таблиц дропа'),
            h('div', { class: 'row' },
              h('button', { class: 'btn btn--ghost btn--small', onClick: () => exportReport('csv') }, 'Отчёт CSV'),
              h('button', { class: 'btn btn--ghost btn--small', onClick: () => exportReport('json') }, 'Отчёт JSON'),
            ),
          ),
          h('p', { class: 'muted' }, `Одно открытие таблицы выдаёт ровно одну строку, поэтому сумма chance в каждой таблице должна быть 100% (допуск ±${SUM_TOLERANCE}%). «Ничего» — тоже строка.`),
          statusBox,
          groupsBox,
        ),
        h('div', { class: 'card' },
          h('div', { class: 'card__head' },
            h('h2', {}, 'Строки лута'),
            h('div', { class: 'row' },
              h('button', { class: 'btn', title: 'Alt+N', onClick: () => grid.addRow() }, '+ Строка'),
              h('button', { class: 'btn btn--ghost', onClick: () => { const l = getState().loot; downloadCSV('loot', l.columns, l.rows); } }, 'CSV'),
              h('button', { class: 'btn btn--ghost', onClick: () => downloadJSON('loot', getState().loot.rows) }, 'JSON'),
            ),
          ),
          grid.element,
          h('p', { class: 'hint' }, 'Жёлтые строки — в таблице с неверной суммой, красные — с ошибкой в самой строке.'),
        ),
      ));
    },
    render() {
      grid.render();
    },
    addRow: () => grid.addRow(),
  };
}
