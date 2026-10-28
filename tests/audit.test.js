import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditUnits } from '../js/domain/audit.js';

const settings = { multiplier: 1, minDamageRatio: 0.1, critChance: 0, critMult: 1.5, attackSpeed: 1 };

const unit = (id, hp, attack, cost) => ({ id, name: `u${id}`, hp, attack, defense: 5, cost });

test('a unit with double stats at the same cost dominates, a halved one is weak', () => {
  const units = [unit(1, 100, 20, 100), unit(2, 100, 20, 100), unit(3, 100, 20, 100), unit(4, 200, 40, 100), unit(5, 50, 10, 100)];
  const audit = auditUnits(units, settings);
  assert.equal(audit.get(units[0]).verdict, 'ok');
  assert.equal(audit.get(units[3]).verdict, 'dominant');
  assert.equal(audit.get(units[4]).verdict, 'weak');
});

test('identical units are all "ok" with value 1', () => {
  const units = [unit(1, 100, 20, 100), unit(2, 100, 20, 100), unit(3, 100, 20, 100)];
  for (const result of auditUnits(units, settings).values()) {
    assert.equal(result.verdict, 'ok');
    assert.equal(result.value, 1);
  }
});

test('results are keyed by row, so rows sharing an id do not overwrite each other', () => {
  const a = unit(1, 100, 20, 100);
  const b = unit(1, 300, 60, 100);
  const audit = auditUnits([a, b, unit(2, 100, 20, 100)], settings);
  assert.equal(audit.size, 3);
  assert.notEqual(audit.get(a).verdict, audit.get(b).verdict);
});
