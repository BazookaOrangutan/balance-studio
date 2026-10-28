// Editable table shared by the "Таблица" (units) and "Лут" tabs.
//
// Cells are edited in place: typing updates the store with source = ownerId and then
// only re-decorates rows (validation highlights, computed columns), so focus is never lost.
// Structural changes (add/delete/sort) rebuild the table.

import { h, clear } from '../core/dom.js';
import { getState, update } from '../core/store.js';
import { SCHEMAS } from '../core/schema.js';
import { validateDataset, issuesByCell, parseNumber } from '../core/validate.js';

/**
 * @param {object} options
 * @param {'units'|'loot'} options.type
 * @param {string} options.ownerId       tab id used as the store change source
 * @param {(rows, validation) => any} [options.analyze]  computed once per refresh, passed to extras
 * @param {{title:string, className?:string, cell:(row, index, ctx) => Node|string}[]} [options.extraColumns]
 * @param {(index, ctx) => 'error'|'warn'|null} [options.rowStatus]
 * @param {() => object} [options.newRow]
 * @param {(row) => Object<string, string>} [options.placeholders]  grey hint shown in empty cells, by column
 */
export function createDataGrid({ type, ownerId, analyze = () => null, extraColumns = [], rowStatus = () => null, newRow, placeholders = () => ({}) }) {
  const schema = SCHEMAS[type];
  const element = h('div', { class: 'table-wrap' });
  let sort = { column: null, dir: 1 };
  let filter = '';
  let rowNodes = [];
  let lastValidation = null;

  const dataset = () => getState()[type];

  function viewOrder() {
    const { rows } = dataset();
    const order = rows.map((_, i) => i);
    if (!sort.column) return order;
    const col = sort.column;
    return order.sort((a, b) => {
      const x = rows[a][col];
      const y = rows[b][col];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x).localeCompare(String(y), 'ru', { numeric: true }) * sort.dir;
    });
  }

  function onCellInput(index, column, input) {
    const raw = input.value;
    const isNumeric = schema.numeric.includes(column);
    const num = parseNumber(raw);
    update((s) => {
      s[type].rows[index][column] = isNumeric && !Number.isNaN(num) && raw.trim() !== '' ? num : raw;
    }, ownerId);
    refresh();
  }

  function deleteRow(index) {
    update((s) => s[type].rows.splice(index, 1), ownerId);
    render();
  }

  function render() {
    const { columns, rows } = dataset();
    const sortMark = (c) => (sort.column === c ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');
    const headerCell = (c) => h('th', {
      class: `sortable ${schema.numeric.includes(c) ? 'num' : ''}`,
      title: schema.descriptions[c] ?? 'дополнительная колонка',
      onClick: () => {
        sort = sort.column === c ? { column: c, dir: -sort.dir } : { column: c, dir: 1 };
        render();
      },
    }, c + sortMark(c));

    const tbody = h('tbody');
    rowNodes = [];
    for (const index of viewOrder()) {
      const row = rows[index];
      const inputs = {};
      const cells = columns.map((column) => {
        const numeric = schema.numeric.includes(column);
        const input = h('input', {
          class: `grid-input ${numeric ? 'grid-input--num' : ''}`,
          value: row[column] ?? '',
          inputMode: numeric ? 'decimal' : 'text',
          'aria-label': `${column}, строка ${index + 1}`,
        });
        input.addEventListener('input', () => onCellInput(index, column, input));
        inputs[column] = input;
        return h('td', {}, input);
      });
      const extras = extraColumns.map((x) => h('td', { class: x.className ?? '' }));
      const tr = h('tr', {},
        h('td', { class: 'muted num' }, index + 1),
        cells,
        extras,
        h('td', {}, h('button', { class: 'btn btn--danger btn--small', title: 'Удалить строку', onClick: () => deleteRow(index) }, '✕')),
      );
      tbody.append(tr);
      rowNodes.push({ index, tr, inputs, extras });
    }

    clear(element).append(h('table', { class: 'table' },
      h('thead', {}, h('tr', {},
        h('th', { class: 'num' }, '#'),
        columns.map(headerCell),
        extraColumns.map((x) => h('th', { class: x.className ?? '' }, x.title)),
        h('th', {}),
      )),
      tbody,
    ));
    if (!rows.length) {
      element.append(h('p', { class: 'muted', style: 'padding:12px' }, 'Строк нет. Добавьте строку или импортируйте файл.'));
    }
    refresh();
  }

  /** Re-applies validation highlights, computed columns and the search filter without rebuilding inputs. */
  function refresh() {
    const { columns, rows } = dataset();
    lastValidation = validateDataset(type, columns, rows);
    const cellIssues = issuesByCell(lastValidation.issues);
    const ctx = analyze(lastValidation.rows, lastValidation);
    const needle = filter.trim().toLowerCase();

    for (const { index, tr, inputs, extras } of rowNodes) {
      const hints = placeholders(lastValidation.rows[index]);
      for (const column of columns) {
        inputs[column].placeholder = hints[column] ?? '';
        const messages = cellIssues.get(`${index}:${column}`);
        inputs[column].classList.toggle('grid-input--invalid', Boolean(messages));
        inputs[column].title = messages ? messages.join('; ') : '';
      }
      const rowMessages = cellIssues.get(`${index}:`);
      const status = lastValidation.invalid.has(index) ? 'error' : rowStatus(index, ctx);
      tr.className = status ? `row--${status}` : '';
      tr.title = rowMessages ? rowMessages.join('; ') : '';

      extraColumns.forEach((x, i) => {
        const value = x.cell(lastValidation.rows[index], index, ctx);
        clear(extras[i]).append(value ?? '');
      });

      const text = columns.map((c) => rows[index][c]).join(' ').toLowerCase();
      tr.hidden = needle !== '' && !text.includes(needle);
    }
    element.dispatchEvent(new CustomEvent('grid:refresh', { detail: lastValidation }));
  }

  function addRow() {
    const { columns, rows } = dataset();
    const row = newRow ? newRow(rows) : {};
    for (const c of columns) if (!(c in row)) row[c] = '';
    update((s) => s[type].rows.push(row), ownerId);
    sort = { column: null, dir: 1 };
    render();
    const last = rowNodes[rowNodes.length - 1];
    const firstEmpty = columns.find((c) => row[c] === '') ?? columns[0];
    last?.inputs[firstEmpty]?.focus();
    last?.tr.scrollIntoView({ block: 'nearest' });
  }

  function setFilter(value) {
    filter = value;
    refresh();
  }

  return { element, render, refresh, addRow, setFilter, validation: () => lastValidation };
}

/** Next numeric id: max(id) + 1, ignoring non-numeric ids. */
export function nextId(rows) {
  const ids = rows.map((r) => Number(r.id)).filter(Number.isFinite);
  return ids.length ? Math.max(...ids) + 1 : 1;
}
