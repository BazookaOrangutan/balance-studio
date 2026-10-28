// CSV parsing and serialization (RFC 4180: quoted fields, "" escapes, CRLF/LF).

export class CsvError extends Error {}

const DELIMITERS = [',', ';', '\t'];

function countOutsideQuotes(line, char) {
  let count = 0;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === char && !inQuotes) count++;
  }
  return count;
}

/** Picks the delimiter that occurs most often in the header line (Excel in RU locale writes ";"). */
export function detectDelimiter(text) {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  let best = ',';
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    const count = countOutsideQuotes(firstLine, delimiter);
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** Splits CSV text into records (arrays of strings). */
export function parseRecords(text, delimiter = detectDelimiter(text)) {
  const source = text.replace(/^﻿/, '');
  const records = [];
  let record = [];
  let fieldValue = '';
  let inQuotes = false;
  let fieldStarted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch !== '"') fieldValue += ch;
      else if (source[i + 1] === '"') {
        fieldValue += '"';
        i++;
      } else inQuotes = false;
    } else if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === delimiter) {
      record.push(fieldValue);
      fieldValue = '';
      fieldStarted = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      record.push(fieldValue);
      records.push(record);
      record = [];
      fieldValue = '';
      fieldStarted = false;
    } else {
      fieldValue += ch;
      if (ch !== ' ') fieldStarted = true;
    }
  }
  if (inQuotes) throw new CsvError('Незакрытая кавычка: файл обрывается внутри значения в кавычках');
  if (fieldValue !== '' || record.length) {
    record.push(fieldValue);
    records.push(record);
  }
  return records;
}

/**
 * Parses CSV with a header row into objects.
 * Returns { columns, rows, structural } where structural lists rows whose field count differs from the header.
 */
export function parseCSV(text, delimiter = detectDelimiter(text)) {
  const records = parseRecords(text, delimiter).filter((r) => r.some((cell) => cell.trim() !== ''));
  if (!records.length) throw new CsvError('Файл пустой');

  const columns = records[0].map((c) => c.trim());
  if (columns.some((c) => c === '')) throw new CsvError('В заголовке есть колонка без имени');
  const duplicates = columns.filter((c, i) => columns.indexOf(c) !== i);
  if (duplicates.length) throw new CsvError(`Колонки повторяются в заголовке: ${[...new Set(duplicates)].join(', ')}`);

  const structural = [];
  const rows = records.slice(1).map((record, index) => {
    if (record.length !== columns.length) {
      structural.push({ index, column: null, message: `ожидалось полей: ${columns.length}, получено: ${record.length}` });
    }
    return Object.fromEntries(columns.map((column, c) => [column, record[c] ?? '']));
  });
  return { columns, rows, structural, delimiter };
}

function escapeField(value, delimiter) {
  const s = value == null ? '' : String(value);
  const needsQuotes = s.includes('"') || s.includes(delimiter) || /[\r\n]/.test(s) || s !== s.trim();
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serializes rows (objects) to CSV using the given column order. */
export function toCSV(columns, rows, delimiter = ',') {
  const lines = [columns.map((c) => escapeField(c, delimiter)).join(delimiter)];
  for (const row of rows) lines.push(columns.map((c) => escapeField(row[c], delimiter)).join(delimiter));
  return lines.join('\r\n') + '\r\n';
}
