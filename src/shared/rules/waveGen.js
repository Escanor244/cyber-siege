// Natural wave composition. Waves 1-8 are hand-authored; after that an endless
// generator keeps the threat rising instead of falling back to a tiny wave.

import { NATURAL_WAVES } from "../config/waves.js";
import { findCreepDefinition } from "../config/creeps.js";
import { scaleCreep } from "../balance.js";

const GROWTH_PER_WAVE = 1.07; // on top of the per-level hp scaling
const MAX_INDIVIDUALS = 110; // keeps lanes playable on phones
const THEMES = [
  { name: "Swarm Surge", pool: ["scout_rush", "drone_swarm"] },
  { name: "Iron Column", pool: ["armored_squad", "aegis_vanguard", "armored_squad"] },
  { name: "Combined Assault", pool: ["scout_rush", "armored_squad", "drone_swarm", "aegis_vanguard"] },
];

// Effective threat of a wave: total scaled hp, weighted by speed.
export function waveThreat(wave, waveNumber = wave.wave) {
  let total = 0;
  for (const entry of wave.creeps) {
    const def = findCreepDefinition(entry.type);
    const per = scaleCreep(def, waveNumber).hp * Math.sqrt(def.speed);
    total += per * entry.count * (def.count || 1);
  }
  return total;
}

function countIndividuals(creeps) {
  return creeps.reduce((n, e) => n + e.count * (findCreepDefinition(e.type).count || 1), 0);
}

function addGroup(creeps, type) {
  const existing = creeps.find((e) => e.type === type);
  if (existing) existing.count += 1;
  else creeps.push({ type, count: 1 });
}

const LAST_AUTHORED = NATURAL_WAVES[NATURAL_WAVES.length - 1];
const BASE_THREAT = waveThreat(LAST_AUTHORED, LAST_AUTHORED.wave);

function generateWave(n) {
  const tier = n - LAST_AUTHORED.wave;
  const prevThreat = waveThreat(getWave(n - 1), n - 1);
  const budget = Math.max(BASE_THREAT * 1.15 * GROWTH_PER_WAVE ** (tier - 1), prevThreat * 1.03);
  const isBossWave = n % 4 === 0;
  const theme = THEMES[n % THEMES.length];
  const creeps = [];

  if (isBossWave) {
    // Bosses take up to ~75% of the budget; escorts fill the rest.
    creeps.push({ type: "void_reaver", count: 1 });
    const bossShare = budget * 0.75;
    while (waveThreat({ creeps }, n) < bossShare) {
      const reavers = creeps[0].count;
      const behemoths = creeps.find((e) => e.type === "cyber_behemoth")?.count || 0;
      addGroup(creeps, behemoths < reavers * 2 ? "cyber_behemoth" : "void_reaver");
      if (waveThreat({ creeps }, n) > budget) {
        // Undo an overshoot so the rest of the budget goes to escorts
        const last = creeps.find((e) => e.type === (behemoths < reavers * 2 ? "cyber_behemoth" : "void_reaver"));
        last.count -= 1;
        if (last.count === 0) creeps.splice(creeps.indexOf(last), 1);
        break;
      }
    }
  }

  // Fill with themed groups until the budget is met; when the lane would get too
  // crowded, pad with void reavers (highest threat per unit).
  let i = 0;
  let threat = waveThreat({ creeps }, n);
  while (threat < budget) {
    const type = theme.pool[i % theme.pool.length];
    const def = findCreepDefinition(type);
    if (countIndividuals(creeps) + (def.count || 1) > MAX_INDIVIDUALS) {
      addGroup(creeps, "void_reaver");
    } else {
      addGroup(creeps, type);
    }
    i++;
    threat = waveThreat({ creeps }, n);
  }

  return {
    wave: n,
    name: isBossWave ? `⚠️ BOSS SIEGE Lv.${n}` : `${theme.name} Lv.${n}`,
    creeps,
    isBossWave,
  };
}

const cache = new Map();

export function getWave(n) {
  if (n >= 1 && n <= NATURAL_WAVES.length) return NATURAL_WAVES[n - 1];
  if (!cache.has(n)) cache.set(n, generateWave(n));
  return cache.get(n);
}
