// Balance formulas. Every place that needs a cost, a scaled stat or a level
// must call these instead of re-deriving the math.

import { MAX_CREEP_LEVEL } from "./config/creeps.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Regular creeps gain a level every 2 waves, bosses every 4 waves.
export function creepLevel(waveNumber, isBoss) {
  const wave = Math.max(1, waveNumber || 1);
  return clamp(Math.ceil(wave / (isBoss ? 4 : 2)), 1, MAX_CREEP_LEVEL);
}

export function creepHpMultiplier(level, isBoss) {
  return 1 + (level - 1) * (isBoss ? 0.35 : 0.25);
}

export function creepBountyMultiplier(level) {
  return 1 + (level - 1) * 0.2;
}

export function creepLeakDamage(def) {
  return def.leakDamage || (def.isBoss ? 25 : 4);
}

// Concrete stats for one creep of `def` spawned during `waveNumber`.
export function scaleCreep(def, waveNumber) {
  const isBoss = !!def.isBoss;
  const level = creepLevel(waveNumber, isBoss);
  return {
    level,
    hp: Math.round(def.hp * creepHpMultiplier(level, isBoss)),
    bounty: Math.round((def.bounty || 10) * creepBountyMultiplier(level)),
    leakDamage: creepLeakDamage(def),
  };
}

export function towerDamage(towerDef, level) {
  return Math.round(towerDef.damage * (1 + (level - 1) * 0.35));
}

// +12% range per level, capped at +60% so a maxed turret can never cover the whole map
export const MAX_RANGE_BONUS = 0.6;
export function towerRange(towerDef, level) {
  return towerDef.range * (1 + Math.min(MAX_RANGE_BONUS, (level - 1) * 0.12));
}

// Cost to go from `level` to `level + 1`
export function upgradeCost(towerDef, level) {
  return Math.floor(towerDef.cost * 0.8 * level);
}

export function sellRefund(towerDef, level) {
  return Math.floor(towerDef.cost * 0.7 * level);
}

// Power grid prices rise with every purchase so income can't simply be spammed:
// the same upgrade costs 50% more each time you buy it, and every purchase of
// any upgrade makes the others 10% pricier (no dodging by rotating tiers).
export const ECO_SAME_GROWTH = 1.5;
export const ECO_OTHER_GROWTH = 1.1;

export function ecoPrice(eco, ecoOwned = {}) {
  const same = ecoOwned[eco.id] || 0;
  let others = 0;
  for (const [id, n] of Object.entries(ecoOwned)) if (id !== eco.id) others += n;
  return Math.round(eco.cost * ECO_SAME_GROWTH ** same * ECO_OTHER_GROWTH ** others);
}

export function waveClearBonus(waveNumber) {
  return 50 + waveNumber * 10;
}
