import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLootTables, normalizeTable, expectedPerOpens } from '../js/domain/loot.js';

const rows = [
  { table: 'goblin', item: 'Ничего', chance: 40 },
  { table: 'goblin', item: 'Золото', chance: 45, min_qty: 5, max_qty: 15 },
  { table: 'goblin', item: 'Зелье', chance: 15 },
  { table: 'chest', item: 'Меч', chance: 30 },
  { table: 'chest', item: 'Щит', chance: 30 },
];

test('sums per table', () => {
  const { groups, ok } = checkLootTables(rows);
  assert.equal(ok, false);
  assert.deepEqual(groups.map((g) => [g.table, g.sum, g.ok]), [['goblin', 100, true], ['chest', 60, false]]);
});

test('floating point sums like 33.33 + 33.33 + 33.34 are accepted', () => {
  const { ok } = checkLootTables([
    { table: 't', item: 'a', chance: 33.33 },
    { table: 't', item: 'b', chance: 33.33 },
    { table: 't', item: 'c', chance: 33.34 },
  ]);
  assert.equal(ok, true);
});

test('non-numeric chance makes the table invalid', () => {
  const { groups } = checkLootTables([{ table: 't', item: 'a', chance: 100 }, { table: 't', item: 'b', chance: 'abc' }]);
  assert.equal(groups[0].ok, false);
});

test('normalize scales a table to exactly 100', () => {
  // 30 / 60 × 100 = 50 each
  const next = normalizeTable(rows, 'chest');
  assert.deepEqual(next.slice(3).map((r) => r.chance), [50, 50]);
  assert.equal(next[0].chance, 40, 'other tables untouched');

  const thirds = normalizeTable([1, 1, 1].map((c, i) => ({ table: 't', item: i, chance: c })), 't');
  assert.equal(thirds.reduce((s, r) => s + r.chance, 0), 100);
});

test('expected amount per 100 opens', () => {
  // 45% × avg(5, 15) = 0.45 × 10 × 100 = 450 gold
  assert.equal(expectedPerOpens(rows[1], 100), 450);
  // no qty columns → 1 item: 0.15 × 100 = 15
  assert.equal(expectedPerOpens(rows[2], 100), 15);
});
