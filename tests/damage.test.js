// Hand-checked damage/TTK examples. Each expected value is computed in the comment above it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseDamage, expectedDamage, hitsToKill, computeTTK, simulateTTK, duel } from '../js/domain/damage.js';

const noCrit = { multiplier: 1, minDamageRatio: 0.1, critChance: 0, critMult: 1.5, attackSpeed: 1 };

const swordsman = { id: 1, name: 'Мечник', hp: 120, attack: 25, defense: 10, cost: 100 };
const archer = { id: 3, name: 'Лучник', hp: 80, attack: 35, defense: 5, cost: 120 };
const knight = { id: 4, name: 'Рыцарь', hp: 180, attack: 20, defense: 20, cost: 200 };
const mage = { id: 5, name: 'Маг', hp: 70, attack: 45, defense: 3, cost: 150 };

test('base damage = attack − defense when it is above the floor', () => {
  // max(35 − 10, 35 × 0.1) × 1 = max(25, 3.5) = 25
  assert.equal(baseDamage(35, 10, noCrit), 25);
});

test('floor A × k kicks in when defense is high', () => {
  // Мечник → Рыцарь: max(25 − 20, 2.5) = 5;  A=10, D=50: max(−40, 1) = 1
  assert.equal(baseDamage(25, 20, noCrit), 5);
  assert.equal(baseDamage(10, 50, noCrit), 1);
});

test('multiplier scales the result', () => {
  // max(25 − 10, 2.5) × 1.2 = 18
  assert.equal(baseDamage(25, 10, { ...noCrit, multiplier: 1.2 }), 18);
});

test('expected crit damage', () => {
  // 25 × (1 + 0.2 × (2 − 1)) = 30
  assert.equal(expectedDamage(25, 0.2, 2), 30);
});

test('hits to kill rounds up, exact division does not add a hit', () => {
  assert.equal(hitsToKill(120, 25), 5); // 4.8 → 5
  assert.equal(hitsToKill(180, 5), 36); // exactly 36
  assert.equal(hitsToKill(100, 0), Infinity);
});

test('Лучник → Мечник without crits: 5 hits, 5 s', () => {
  // damage 35 − 10 = 25, ceil(120 / 25) = 5, TTK = 5 / 1 = 5
  const r = computeTTK(archer, swordsman, noCrit);
  assert.equal(r.base, 25);
  assert.equal(r.hitsExpected, 5);
  assert.equal(r.ttkExpected, 5);
});

test('Лучник → Мечник with crit 20% ×2 and 0.8 attacks/s', () => {
  // expected 25 × 1.2 = 30, ceil(120 / 30) = 4 hits, TTK = 4 / 0.8 = 5 s
  // best case all crits: 50 dmg → 3 hits; worst case no crits → 5 hits
  const unit = { ...archer, crit_chance: 0.2, crit_mult: 2, attack_speed: 0.8 };
  const r = computeTTK(unit, swordsman, noCrit);
  assert.equal(r.expected, 30);
  assert.equal(r.hitsExpected, 4);
  assert.equal(r.ttkExpected, 5);
  assert.equal(r.hitsBest, 3);
  assert.equal(r.hitsWorst, 5);
});

test('Мечник → Рыцарь: floor damage 5, 36 hits', () => {
  const r = computeTTK(swordsman, knight, noCrit);
  assert.equal(r.base, 5);
  assert.equal(r.hitsExpected, 36);
});

test('Рыцарь vs Маг duel: knight kills in 5 s, mage in 8 s', () => {
  // Рыцарь → Маг: 20 − 3 = 17, ceil(70 / 17) = 5;  Маг → Рыцарь: 45 − 20 = 25, ceil(180 / 25) = 8
  const d = duel(knight, mage, noCrit);
  assert.equal(d.aToB.hitsExpected, 5);
  assert.equal(d.bToA.hitsExpected, 8);
  assert.equal(d.winner, 'a');
});

test('simulation mean is close to the analytic estimate', () => {
  const unit = { ...archer, crit_chance: 0.2, crit_mult: 2, attack_speed: 1 };
  const sim = simulateTTK(unit, knight, noCrit, { runs: 20000, seed: 7 });
  const r = computeTTK(unit, knight, noCrit);
  assert.ok(Math.abs(sim.mean - r.ttkExpected) <= 1, `sim ${sim.mean} vs formula ${r.ttkExpected}`);
  assert.ok(sim.p10 >= r.ttkBest && sim.p90 <= r.ttkWorst);
});

test('simulation without crits is deterministic', () => {
  const sim = simulateTTK(archer, swordsman, noCrit, { runs: 100 });
  assert.equal(sim.mean, 5);
});
