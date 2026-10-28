// Balance audit: finds units that are too strong or too weak for their cost.
//
// For every pair (i, j) we compare how long i survives against j with how long i needs to kill j:
//   edge(i, j) = TTK(j → i) / TTK(i → j)      (> 1 means i wins the duel)
// combat(i)  = geometric mean of edge(i, j) over all opponents
// value(i)   = combat(i) / cost(i), normalized by the median value
// value > 1 + threshold → "доминирует", value < 1 − threshold → "бесполезен".

import { computeTTK } from './damage.js';

export const DEFAULT_AUDIT = { threshold: 0.25 };

const MAX_EDGE = 100;

function edge(unitA, unitB, settings) {
  const killB = computeTTK(unitA, unitB, settings).ttkExpected;
  const killA = computeTTK(unitB, unitA, settings).ttkExpected;
  if (killB === Infinity && killA === Infinity) return 1;
  if (killB === Infinity) return 1 / MAX_EDGE;
  if (killA === Infinity) return MAX_EDGE;
  return Math.min(MAX_EDGE, Math.max(1 / MAX_EDGE, killA / killB));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param units validated unit rows
 * @returns Map<unit row, { combat, value, verdict: 'dominant'|'weak'|'ok' }>
 *          keyed by the row object itself: ids are not guaranteed unique in data being edited
 */
export function auditUnits(units, settings, { threshold = DEFAULT_AUDIT.threshold } = {}) {
  const result = new Map();
  if (units.length < 3) return result;

  const raw = units.map((unit) => {
    const opponents = units.filter((other) => other !== unit);
    const logSum = opponents.reduce((sum, other) => sum + Math.log(edge(unit, other, settings)), 0);
    const combat = Math.exp(logSum / opponents.length);
    return { unit, combat, perCost: unit.cost > 0 ? combat / unit.cost : Infinity };
  });

  const finite = raw.map((r) => r.perCost).filter(Number.isFinite);
  const mid = finite.length ? median(finite) : 1;

  for (const { unit, combat, perCost } of raw) {
    const value = perCost / mid;
    let verdict = 'ok';
    if (value > 1 + threshold) verdict = 'dominant';
    else if (value < 1 - threshold) verdict = 'weak';
    result.set(unit, { combat, value, verdict });
  }
  return result;
}
