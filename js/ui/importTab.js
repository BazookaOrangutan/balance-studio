// Tab 1 — import CSV/JSON with validation preview, plus project and dataset export.

import { h, clear, toast, select, badge } from '../core/dom.js';
import { getState, replaceDataset, loadProject, resetToSamples, exportProject } from '../core/store.js';
import { SCHEMAS, DATASET_TYPES } from '../core/schema.js';
import { validateDataset, issuesByCell } from '../core/validate.js';
import { readFileText, parseDataText, canonicalizeDataset, downloadCSV, downloadJSON, ImportError } from '../core/io.js';

const PREVIEW_ROWS = 30;
const MAX_LISTED_ISSUES = 100;

export function createImportTab() {
  let root;
  let pending = null; // { fileName, parsed, type }
  const report = h('div', { class: 'stack' });

  async function handleFile(file) {
    if (!file) return;
    if (!/\.(csv|json|txt)$/i.test(file.name)) {
      toast(`Формат «${file.name}» не поддерживается: нужен .csv или .json`, 'error');
      return;
    }
    try {
      const text = await readFileText(file);
      const parsed = parseDataText(file.name, text);
      pending = { fileName: file.name, parsed, type: parsed.detectedType ?? 'units' };
    } catch (error) {
      pending = null;
      const message = error instanceof ImportError ? error.message : `Не удалось прочитать файл: ${error.message}`;
      clear(report).append(h('div', { class: 'card' },
        h('h2', {}, file.name),
        h('div', { class: 'alert alert--error' }, message),
      ));
      return;
    }
    renderReport();
  }

  function renderProjectReport() {
    const { project } = pending;
    const counts = DATASET_TYPES.map((t) => `${SCHEMAS[t].label}: ${project[t]?.rows?.length ?? 0}`).join(', ');
    clear(report).append(h('div', { class: 'card' },
      h('h2', {}, pending.fileName),
      h('div', { class: 'alert alert--ok' }, `Файл проекта. ${counts}. Загрузка заменит все текущие данные и настройки.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => {
          loadProject(project);
          toast('Проект загружен', 'ok');
          pending = null;
          clear(report);
        } }, 'Загрузить проект'),
        h('button', { class: 'btn btn--ghost', onClick: cancel }, 'Отмена'),
      ),
    ));
  }

  function renderReport() {
    if (pending.parsed.kind === 'project') return renderProjectReport();

    const parsed = canonicalizeDataset(pending.parsed, pending.type);
    const result = validateDataset(pending.type, parsed.columns, parsed.rows, parsed.structural);
    const validCount = result.rows.length - result.invalid.size;
    const cellIssues = issuesByCell(result.issues);

    const typeSelect = select(
      DATASET_TYPES.map((t) => ({ value: t, label: SCHEMAS[t].label })),
      pending.type,
      (value) => {
        pending.type = value;
        renderReport();
      },
    );

    let status;
    if (result.fatal.length) {
      status = h('div', { class: 'alert alert--error' }, result.fatal.join('. '), '. Импорт невозможен — исправьте файл или выберите другой тип данных.');
    } else if (result.issues.length) {
      status = h('div', { class: 'alert alert--warn' }, `Найдено ошибок: ${result.issues.length} в ${result.invalid.size} строках из ${result.rows.length}. Можно импортировать только корректные строки или всё (ошибки будут подсвечены в таблице).`);
    } else {
      status = h('div', { class: 'alert alert--ok' }, `Ошибок нет: ${result.rows.length} строк, колонки: ${parsed.columns.join(', ')}.`);
    }

    const issueList = result.issues.length
      ? h('ul', { class: 'issue-list' },
        result.issues.slice(0, MAX_LISTED_ISSUES).map((i) => h('li', {}, `Строка ${i.index + 1}${i.column ? `, ${i.column}` : ''}: ${i.message}`)),
        result.issues.length > MAX_LISTED_ISSUES ? h('li', {}, `…и ещё ${result.issues.length - MAX_LISTED_ISSUES}`) : null)
      : null;

    const apply = (rows) => {
      replaceDataset(pending.type, parsed.columns, rows);
      toast(`${SCHEMAS[pending.type].label}: импортировано строк — ${rows.length}`, 'ok');
      pending = null;
      clear(report);
    };

    const preview = h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', { class: 'num' }, '#'), parsed.columns.map((c) => h('th', {}, c)))),
      h('tbody', {}, result.rows.slice(0, PREVIEW_ROWS).map((row, index) => h('tr', { class: result.invalid.has(index) ? 'row--error' : '' },
        h('td', { class: 'muted num' }, index + 1),
        parsed.columns.map((c) => {
          const messages = cellIssues.get(`${index}:${c}`);
          return h('td', { class: messages ? 'cell--error' : '', title: messages?.join('; ') }, String(row[c] ?? ''));
        }),
      ))),
    ));

    clear(report).append(h('div', { class: 'card' },
      h('div', { class: 'card__head' },
        h('h2', {}, pending.fileName),
        h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Тип данных:'), typeSelect),
      ),
      status,
      issueList,
      h('div', { class: 'row', style: 'margin-bottom:12px' },
        h('button', { class: 'btn', disabled: Boolean(result.fatal.length) || !validCount, onClick: () => apply(result.rows.filter((_, i) => !result.invalid.has(i))) },
          result.issues.length ? `Импортировать корректные (${validCount})` : `Импортировать (${validCount})`),
        result.issues.length && !result.fatal.length
          ? h('button', { class: 'btn btn--ghost', onClick: () => apply(result.rows) }, `Импортировать всё (${result.rows.length})`)
          : null,
        h('button', { class: 'btn btn--ghost', onClick: cancel }, 'Отмена'),
      ),
      h('p', { class: 'muted' }, result.rows.length > PREVIEW_ROWS ? `Предпросмотр первых ${PREVIEW_ROWS} строк из ${result.rows.length}` : 'Предпросмотр'),
      preview,
    ));
  }

  function cancel() {
    pending = null;
    clear(report);
  }

  function dropzone() {
    const input = h('input', { type: 'file', accept: '.csv,.json,text/csv,application/json' });
    input.addEventListener('change', () => {
      handleFile(input.files[0]);
      input.value = '';
    });
    const zone = h('label', { class: 'dropzone' },
      input,
      h('span', { class: 'dropzone__title' }, 'Перетащите CSV или JSON сюда'),
      h('span', { class: 'muted' }, 'или нажмите, чтобы выбрать файл. Разделитель CSV определяется автоматически (, ; Tab)'),
    );
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dropzone--active');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dropzone--active'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dropzone--active');
      handleFile(e.dataTransfer.files[0]);
    });
    return zone;
  }

  function schemaHelp(type) {
    const schema = SCHEMAS[type];
    return h('div', {},
      h('h3', { style: 'margin:8px 0 6px' }, schema.label),
      h('ul', { class: 'schema-list' }, [...schema.required, ...schema.optional].map((c) => h('li', {},
        h('code', {}, c), ' — ', schema.descriptions[c],
        schema.required.includes(c) ? ' ' : null,
        schema.required.includes(c) ? badge('обязательно', 'neutral') : null,
      ))),
    );
  }

  const exportCard = h('div', { class: 'card' });

  function renderExport() {
    const state = getState();
    clear(exportCard).append(
      h('h2', {}, 'Экспорт'),
      DATASET_TYPES.map((t) => h('div', { class: 'row', style: 'margin-bottom:10px' },
        h('span', { style: 'min-width:90px' }, `${SCHEMAS[t].label} (${state[t].rows.length})`),
        h('button', { class: 'btn btn--ghost btn--small', onClick: () => downloadCSV(t, state[t].columns, state[t].rows) }, 'CSV'),
        h('button', { class: 'btn btn--ghost btn--small', onClick: () => downloadJSON(t, state[t].rows) }, 'JSON'),
      )),
      h('div', { class: 'row', style: 'margin-top:14px' },
        h('button', { class: 'btn', onClick: () => downloadJSON('balance_project', exportProject()) }, 'Весь проект (JSON)'),
        h('button', { class: 'btn btn--danger', onClick: () => {
          if (confirm('Заменить все данные и настройки примерами из задания?')) {
            resetToSamples();
            toast('Загружены примеры', 'ok');
          }
        } }, 'Сбросить к примерам'),
      ),
      h('p', { class: 'hint' }, 'Файл проекта содержит юнитов, лут и все настройки формул. Его можно загрузить обратно через импорт.'),
    );
  }

  return {
    id: 'import',
    title: 'Импорт',
    mount(panel) {
      root = panel;
      root.append(h('div', { class: 'grid grid--sidebar' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h2', {}, 'Формат данных'),
            h('p', { class: 'muted' }, 'Первая строка CSV — заголовок. Лишние колонки сохраняются как есть.'),
            DATASET_TYPES.map(schemaHelp)),
          exportCard,
        ),
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h2', {}, 'Загрузка файла'), dropzone()),
          report,
        ),
      ));
    },
    render() {
      renderExport();
    },
  };
}
