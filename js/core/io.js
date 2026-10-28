// Reading files (CSV/JSON) and downloading exports.

import { parseCSV, toCSV, CsvError } from './csv.js';
import { canonicalizeColumns, detectDatasetType } from './schema.js';
import { PROJECT_FORMAT } from './store.js';

export class ImportError extends Error {}

/** Reads a file as text; falls back to Windows-1251 for CSVs saved by Excel in RU locale. */
export async function readFileText(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1251').decode(buffer);
  } catch {
    return utf8;
  }
}

function columnsFromObjects(rows) {
  const columns = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  }
  return columns;
}

function parseJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ImportError(`Некорректный JSON: ${error.message}`);
  }
  if (data && data.format === PROJECT_FORMAT) return { kind: 'project', project: data };

  const rows = Array.isArray(data) ? data
    : Array.isArray(data?.rows) ? data.rows
    : Array.isArray(data?.units) ? data.units
    : Array.isArray(data?.loot) ? data.loot
    : null;
  if (!rows) throw new ImportError('JSON должен быть массивом объектов или объектом с полем rows / units / loot');
  if (!rows.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    throw new ImportError('Каждый элемент JSON-массива должен быть объектом { "колонка": значение }');
  }
  const flat = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v) : v])));
  return { kind: 'dataset', columns: columnsFromObjects(flat), rows: flat, structural: [] };
}

/**
 * Parses file contents into a dataset or a whole project.
 * @returns {{kind:'dataset', columns, rows, structural, detectedType} | {kind:'project', project}}
 */
export function parseDataText(fileName, text) {
  const isJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(text);
  let parsed;
  if (isJson) {
    parsed = parseJSON(text);
  } else {
    try {
      parsed = { kind: 'dataset', ...parseCSV(text) };
    } catch (error) {
      if (error instanceof CsvError) throw new ImportError(error.message);
      throw error;
    }
  }
  if (parsed.kind === 'dataset') parsed.detectedType = detectDatasetType(parsed.columns);
  return parsed;
}

/** Renames columns to schema names ("HP" → "hp") for the chosen dataset type. */
export function canonicalizeDataset(parsed, type) {
  const columns = canonicalizeColumns(parsed.columns, type);
  const rows = parsed.rows.map((row) => Object.fromEntries(parsed.columns.map((c, i) => [columns[i], row[c]])));
  return { ...parsed, columns, rows };
}

export function download(filename, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** BOM makes Excel open UTF-8 CSV with Cyrillic correctly. */
export function downloadCSV(name, columns, rows) {
  download(`${name}_${stamp()}.csv`, '﻿' + toCSV(columns, rows), 'text/csv');
}

export function downloadJSON(name, data) {
  download(`${name}_${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}
