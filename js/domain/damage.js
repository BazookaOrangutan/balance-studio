// Damage and time-to-kill (TTK) formulas. Pure functions, covered by tests/damage.test.js.
//
// Damage per hit:
//   base     = max(A − D, A × minRatio) × M
//   expected = base × (1 + critChance × (critMult − 1))
// Hits to kill = ceil(HP / damage), TTK = hits / attackSpeed (first hit lands after one attack interval).
//
// Why "A − D" with a floor: defense is easy to read (each point blocks one point of damage),
// and the floor A × minRatio keeps a weak unit from dealing 0 damage to a tank.

import { createRng, quantile } from './random.js';

export const DEFAULT_COMBAT = {
  multiplier: 1,
  minDamageRatio: 0.1,
  critChance: 0.1,
  critMult: 1.5,
  attackSpeed: 1,
};

const EPS = 1e-9;

/** Number of hits needed; Infinity when the damage is 0. */
export function hitsToKill(hp, damage) {
  if (!(damage > 0)) return Infinity;
  return Math.max(1, Math.ceil(hp / damage - EPS));
}

export function baseDamage(attack, defense, { multiplier = 1, minDamageRatio = 0 } = {}) {
  return Math.max(attack - defense, attack * minDamageRatio) * multiplier;
}

export function expectedDamage(base, critChance, critMult) {
  return base * (1 + critChance * (critMult - 1));
}

/** Unit stats with per-unit columns overriding global defaults. */
export function combatStats(unit, settings = DEFAULT_COMBAT) {
  const pick = (column, fallback) => (typeof unit[column] === 'number' && Number.isFinite(unit[column]) ? unit[column] : fallback);
  return {
    hp: unit.hp,
    attack: unit.attack,
    defense: unit.defense,
    critChance: pick('crit_chance', settings.critChance),
    critMult: pick('crit_mult', settings.critMult),
    attackSpeed: pick('attack_speed', settings.attackSpeed),
  };
}

/** Full breakdown of one attacker → target matchup. */
export function computeTTK(attacker, target, settings = DEFAULT_COMBAT) {
  const a = combatStats(attacker, settings);
  const t = combatStats(target, settings);

  const base = baseDamage(a.attack, t.defense, settings);
  const crit = base * a.critMult;
  const expected = expectedDamage(base, a.critChance, a.critMult);

  const hitsExpected = hitsToKill(t.hp, expected);
  const hitsBest = hitsToKill(t.hp, a.critChance > 0 ? crit : base);
  const hitsWorst = hitsToKill(t.hp, a.critChance < 1 ? base : crit);

  return {
    attacker: a,
    target: t,
    rawDiff: a.attack - t.defense,
    floor: a.attack * settings.minDamageRatio,
    base,
    crit,
    expected,
    dps: expected * a.attackSpeed,
    hitsExpected,
    hitsBest,
    hitsWorst,
    ttkExpected: hitsExpected / a.attackSpeed,
    ttkBest: hitsBest / a.attackSpeed,
    ttkWorst: hitsWorst / a.attackSpeed,
  };
}

/**
 * Monte Carlo check of the TTK estimate: rolls every crit separately.
 * Returns mean and percentiles of TTK in seconds.
 */
export function simulateTTK(attacker, target, settings = DEFAULT_COMBAT, { runs = 10000, seed = 42, maxHits = 10000 } = {}) {
  const r = computeTTK(attacker, target, settings);
  if (!(r.base > 0)) return { runs, mean: Infinity, p10: Infinity, p50: Infinity, p90: Infinity };

  const rng = createRng(seed);
  const results = new Array(runs);
  let sum = 0;
  for (let run = 0; run < runs; run++) {
    let hp = r.target.hp;
    let hits = 0;
    while (hp > EPS && hits < maxHits) {
      hp -= rng() < r.attacker.critChance ? r.crit : r.base;
      hits++;
    }
    results[run] = hits / r.attacker.attackSpeed;
    sum += results[run];
  }
  results.sort((x, y) => x - y);
  return { runs, mean: sum / runs, p10: quantile(results, 0.1), p50: quantile(results, 0.5), p90: quantile(results, 0.9) };
}

/** Both units attack each other simultaneously; the one with the lower TTK wins. */
export function duel(unitA, unitB, settings = DEFAULT_COMBAT) {
  const aToB = computeTTK(unitA, unitB, settings);
  const bToA = computeTTK(unitB, unitA, settings);
  let winner = null;
  if (aToB.ttkExpected < bToA.ttkExpected) winner = 'a';
  else if (bToA.ttkExpected < aToB.ttkExpected) winner = 'b';
  return { aToB, bToA, winner };
}
