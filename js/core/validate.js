// Dataset validation: required columns, numeric types, ranges, duplicate keys.
// Pure functions without DOM access, covered by tests/validate.test.js.

import { SCHEMAS } from './schema.js';

const NUMBER_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

/** Parses "12", "1.5", "1,5", "1 000" or a number; returns NaN for anything else. */
export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const s = value.trim().replace(/[\s ]/g, '').replace(',', '.');
  return NUMBER_RE.test(s) ? Number(s) : NaN;
}

/**
 * Converts canonical numeric strings to numbers ("12" → 12) and leaves the rest as is
 * ("007" stays a string), so CSV → JSON → CSV round-trips without losing data.
 */
export function autoType(value) {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t !== '' && String(Number(t)) === t ? Number(t) : value;
}

const isBlank = (value) => value == null || String(value).trim() === '';

/** True when the row's value is a usable number (empty optional cells are not). */
export const hasNumber = (row, column) => typeof row[column] === 'number' && Number.isFinite(row[column]);

/**
 * Validates and normalizes rows of a dataset.
 * @returns {{ fatal: string[], issues: {index:number, column:string|null, message:string}[],
 *            rows: object[], invalid: Set<number>, ok: boolean }}
 */
export function validateDataset(type, columns, rows, structural = []) {
  const schema = SCHEMAS[type];
  const fatal = [];
  const issues = [...structural];

  const missing = schema.required.filter((c) => !columns.includes(c));
  if (missing.length) fatal.push(`Нет обязательных колонок: ${missing.join(', ')}`);
  if (!rows.length) fatal.push('Нет ни одной строки данных');

  const seenKeys = new Map();
  const normalized = rows.map((raw, index) => {
    const row = {};
    const report = (column, message) => issues.push({ index, column, message });

    for (const column of columns) {
      const value = raw[column];
      const required = schema.required.includes(column);

      if (isBlank(value)) {
        if (required) report(column, 'пустое значение');
        row[column] = '';
        continue;
      }
      if (!schema.numeric.includes(column)) {
        row[column] = autoType(value);
        continue;
      }
      const num = parseNumber(value);
      if (Number.isNaN(num)) {
        report(column, `«${value}» — не число`);
        row[column] = String(value);
        continue;
      }
      const range = schema.ranges[column];
      if (range?.min != null && num < range.min) report(column, `${num} меньше допустимого ${range.min}`);
      if (range?.max != null && num > range.max) report(column, `${num} больше допустимого ${range.max}`);
      row[column] = num;
    }

    if (schema.key.every((k) => !isBlank(row[k]))) {
      const key = schema.key.map((k) => String(row[k]).trim()).join(' / ');
      if (seenKeys.has(key)) {
        report(schema.key[schema.key.length - 1], `дубликат ${schema.keyLabel} «${key}» (уже в строке ${seenKeys.get(key) + 1})`);
      } else {
        seenKeys.set(key, index);
      }
    }
    return row;
  });

  if (type === 'loot') {
    normalized.forEach((row, index) => {
      if (hasNumber(row, 'min_qty') && hasNumber(row, 'max_qty') && row.min_qty > row.max_qty) {
        issues.push({ index, column: 'max_qty', message: 'max_qty меньше min_qty' });
      }
    });
  }

  issues.sort((a, b) => a.index - b.index);
  const invalid = new Set(issues.map((i) => i.index));
  return { fatal, issues, rows: normalized, invalid, ok: fatal.length === 0 && issues.length === 0 };
}

/** Rows without validation issues — what calculators are allowed to use. */
export function validRows(type, dataset) {
  const result = validateDataset(type, dataset.columns, dataset.rows);
  return result.rows.filter((_, i) => !result.invalid.has(i));
}

/** Index of issues by "row:column" for highlighting cells. */
export function issuesByCell(issues) {
  const map = new Map();
  for (const issue of issues) {
    const key = `${issue.index}:${issue.column ?? ''}`;
    map.set(key, [...(map.get(key) ?? []), issue.message]);
  }
  return map;
}
