import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpToNext, buildLevelTable, statAtLevel } from '../js/domain/progression.js';

const power = { formula: 'power', a: 100, b: 1.5, c: 0, maxLevel: 5, xpPerMinute: 50, statGrowth: 0.1 };
const exponential = { formula: 'exponential', a: 100, r: 1.2, maxLevel: 4, xpPerMinute: 0, statGrowth: 0 };

test('power formula by hand', () => {
  // 100 × 1^1.5 = 100; 100 × 2^1.5 = 282.84 → 283; 100 × 3^1.5 = 519.6 → 520; 100 × 4^1.5 = 800
  assert.deepEqual([1, 2, 3, 4].map((l) => xpToNext(l, power)), [100, 283, 520, 800]);
});

test('linear term c × L is added', () => {
  // 100 × 2^1.5 + 10 × 2 = 282.84 + 20 = 302.84 → 303
  assert.equal(xpToNext(2, { ...power, c: 10 }), 303);
});

test('exponential formula by hand', () => {
  // 100, 100 × 1.2 = 120, 100 × 1.44 = 144
  assert.deepEqual([1, 2, 3].map((l) => xpToNext(l, exponential)), [100, 120, 144]);
});

test('level table: cumulative XP, time and cap', () => {
  const rows = buildLevelTable(power);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.totalXp), [0, 100, 383, 903, 1703]);
  assert.equal(rows[4].xpToNext, null);
  // 283 / 50 = 5.66 min for level 2 → 3
  assert.equal(rows[1].minutes, 283 / 50);
  // growth from 100 to 283 = +183%
  assert.equal(Math.round(rows[1].growthPct), 183);
});

test('stat growth is compound', () => {
  // 120 × 1.1^2 = 145.2 → 145
  assert.equal(statAtLevel(120, 3, 0.1), 145);
  const rows = buildLevelTable(power, { hp: 120, attack: 25 });
  assert.equal(rows[0].hp, 120);
  assert.equal(rows[2].hp, 145);
});
