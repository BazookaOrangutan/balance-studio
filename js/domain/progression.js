// Experience curve and per-level table. Pure functions, covered by tests/progression.test.js.
//
// XP needed to go from level L to L+1:
//   power:       xp(L) = round(a × L^b + c × L)
//   exponential: xp(L) = round(a × r^(L−1))
// Total XP to reach level L = sum of xp(1 … L−1).

export const FORMULAS = {
  power: { label: 'Степенная: a·L^b + c·L', params: ['a', 'b', 'c'] },
  exponential: { label: 'Экспоненциальная: a·r^(L−1)', params: ['a', 'r'] },
};

export const DEFAULT_PROGRESSION = {
  formula: 'power',
  a: 100,
  b: 1.5,
  c: 0,
  r: 1.15,
  maxLevel: 30,
  xpPerMinute: 60,
  statGrowth: 0.05,
  unitId: '',
};

export function xpToNext(level, p) {
  const raw = p.formula === 'exponential'
    ? p.a * p.r ** (level - 1)
    : p.a * level ** p.b + p.c * level;
  return Math.max(0, Math.round(raw));
}

/** Stat at a level with compound growth: base × (1 + g)^(L−1). */
export function statAtLevel(base, level, growth) {
  return Math.round(base * (1 + growth) ** (level - 1));
}

/**
 * Builds rows for levels 1…maxLevel.
 * The last level has xpToNext = null: it is the cap.
 */
export function buildLevelTable(p, unit = null) {
  const rows = [];
  let totalXp = 0;
  let previous = null;
  for (let level = 1; level <= p.maxLevel; level++) {
    const isCap = level === p.maxLevel;
    const xp = isCap ? null : xpToNext(level, p);
    rows.push({
      level,
      xpToNext: xp,
      totalXp,
      growthPct: xp != null && previous ? (xp / previous - 1) * 100 : null,
      minutes: xp != null && p.xpPerMinute > 0 ? xp / p.xpPerMinute : null,
      totalMinutes: p.xpPerMinute > 0 ? totalXp / p.xpPerMinute : null,
      hp: unit ? statAtLevel(unit.hp, level, p.statGrowth) : null,
      attack: unit ? statAtLevel(unit.attack, level, p.statGrowth) : null,
    });
    if (xp != null) {
      totalXp += xp;
      previous = xp;
    }
  }
  return rows;
}

/** Returns a human-readable formula with the current coefficients substituted. */
export function describeFormula(p) {
  if (p.formula === 'exponential') return `xp(L) = round(${p.a} × ${p.r}^(L−1))`;
  const linear = p.c ? ` + ${p.c} × L` : '';
  return `xp(L) = round(${p.a} × L^${p.b}${linear})`;
}
