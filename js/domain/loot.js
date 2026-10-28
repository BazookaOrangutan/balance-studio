// Loot table checks. One roll of a table drops exactly one row, so chances in a table must sum to 100%.
// Pure functions, covered by tests/loot.test.js.

import { hasNumber } from '../core/validate.js';

export const SUM_TOLERANCE = 0.01;

/** Groups rows by table and checks that each sum equals 100% (± tolerance). */
export function checkLootTables(rows, tolerance = SUM_TOLERANCE) {
  const groups = new Map();
  rows.forEach((row, index) => {
    const name = String(row.table ?? '').trim() || '(без имени)';
    if (!groups.has(name)) groups.set(name, { table: name, sum: 0, indexes: [], invalidChance: false });
    const group = groups.get(name);
    group.indexes.push(index);
    if (hasNumber(row, 'chance')) group.sum += row.chance;
    else group.invalidChance = true;
  });

  const result = [...groups.values()].map((g) => {
    const sum = round(g.sum, 6);
    const diff = round(sum - 100, 6);
    const ok = !g.invalidChance && Math.abs(diff) <= tolerance;
    return { ...g, sum, diff, ok, count: g.indexes.length };
  });
  return { groups: result, ok: result.every((g) => g.ok) };
}

/** Average quantity of one drop: (min + max) / 2, or 1 if no quantity columns. */
export function averageQty(row) {
  const min = hasNumber(row, 'min_qty') ? row.min_qty : null;
  const max = hasNumber(row, 'max_qty') ? row.max_qty : null;
  if (min == null && max == null) return 1;
  return ((min ?? max) + (max ?? min)) / 2;
}

/** Expected amount of the item per `opens` rolls. */
export function expectedPerOpens(row, opens = 100) {
  if (!hasNumber(row, 'chance')) return NaN;
  return (row.chance / 100) * averageQty(row) * opens;
}

/**
 * Scales chances of one table so they sum to exactly 100.
 * Values are rounded to `decimals`; the rounding remainder goes to the largest row.
 */
export function normalizeTable(rows, table, decimals = 2) {
  const indexes = rows.map((r, i) => (String(r.table).trim() === table && hasNumber(r, 'chance') ? i : -1)).filter((i) => i >= 0);
  const sum = indexes.reduce((s, i) => s + rows[i].chance, 0);
  if (!(sum > 0)) return rows;

  const next = rows.map((r) => ({ ...r }));
  for (const i of indexes) next[i].chance = round((rows[i].chance / sum) * 100, decimals);

  const newSum = indexes.reduce((s, i) => s + next[i].chance, 0);
  const remainder = round(100 - newSum, decimals);
  if (remainder !== 0) {
    const largest = indexes.reduce((best, i) => (next[i].chance > next[best].chance ? i : best), indexes[0]);
    next[largest].chance = round(next[largest].chance + remainder, decimals);
  }
  return next;
}

function round(value, decimals) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
