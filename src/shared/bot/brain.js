// Solo-mode bot decisions. The bot plays through the same protocol as a human,
// and every choice is checked with the same validators, so it can never cheat
// or send something the room would reject.

import { TOWERS } from "../config/towers.js";
import { CREEP_RAIDS, BOSS_SUMMONS } from "../config/creeps.js";
import { ECO_UPGRADES } from "../config/economy.js";
import { GRID_COLS, GRID_ROWS, PIXEL_PATH } from "../config/map.js";
import { towerRange, upgradeCost } from "../balance.js";
import { nextRandom, randomInt } from "../rng.js";
import * as V from "../rules/validate.js";
import { damageMultiplier } from "../sim/damage.js";

export const DIFFICULTIES = {
  easy: { thinkMs: 3200, buildChance: 0.3, ecoChance: 0.15, raidChance: 0.3, spellChance: 0.1, maxTowers: 7, raidDelayMs: 15_000, smartPlacement: false, bossGold: 600 },
  normal: { thinkMs: 2500, buildChance: 0.4, ecoChance: 0.25, raidChance: 0.45, spellChance: 0.25, maxTowers: 9, raidDelayMs: 8_000, smartPlacement: true, bossGold: 420 },
  hard: { thinkMs: 1600, buildChance: 0.6, ecoChance: 0.3, raidChance: 0.55, spellChance: 0.35, maxTowers: 14, raidDelayMs: 6_000, smartPlacement: true, bossGold: 420 },
};

// Path sample points used to score how much of the path a cell covers.
const PATH_SAMPLES = (() => {
  const pts = [];
  for (let i = 1; i < PIXEL_PATH.length; i++) {
    const a = PIXEL_PATH[i - 1];
    const b = PIXEL_PATH[i];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 13);
    for (let s = 0; s < steps; s++) pts.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
  }
  return pts;
})();

function coverage(gx, gy, range) {
  const cx = gx * 52 + 26;
  const cy = gy * 52 + 26;
  let n = 0;
  for (const p of PATH_SAMPLES) if (Math.hypot(p.x - cx, p.y - cy) <= range) n++;
  return n;
}

function chooseCell(match, me, towerType, rngHolder, smart) {
  const legal = [];
  for (let x = 0; x < GRID_COLS; x++) {
    for (let y = 0; y < GRID_ROWS; y++) {
      if (V.canPlaceAt(me, x, y).ok) legal.push({ x, y });
    }
  }
  if (legal.length === 0) return null;
  if (!smart) return legal[randomInt(rngHolder, legal.length)];
  const range = towerRange(TOWERS[towerType], 1);
  let best = null;
  let bestScore = -1;
  for (const c of legal) {
    const score = coverage(c.x, c.y, range) + nextRandom(rngHolder) * 3; // a little variety
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

// Scores each raid by how badly the enemy's current turrets handle its armor
// (higher = enemy deals less damage to it), with randomness so it isn't predictable.
export function pickCounterRaid(options, enemyTowers, rngHolder) {
  if (enemyTowers.length === 0) return options[randomInt(rngHolder, options.length)];
  let best = options[0];
  let bestScore = -Infinity;
  for (const id of options) {
    const def = CREEP_RAIDS[id] || BOSS_SUMMONS[id];
    let resist = 0;
    for (const t of enemyTowers) resist += 1 / damageMultiplier(TOWERS[t.type]?.damageType, def.armor);
    const score = resist / enemyTowers.length + nextRandom(rngHolder) * 0.35;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

// Returns a list of protocol actions ({ type, ... }) for this thinking step.
// `match` can be the public view: only public fields are read.
export function decideBotActions(match, botId, rngHolder, difficulty = "normal") {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const me = match.players.find((p) => p.id === botId);
  const enemy = match.players.find((p) => p.id !== botId);
  if (!me || !enemy || match.phase !== "playing" || match.pause) return [];

  const actions = [];
  let gold = me.gold;
  const view = { ...match, players: match.players.map((p) => (p.id === botId ? { ...p } : p)) };
  const botView = view.players.find((p) => p.id === botId);
  const canAfford = (cost) => gold >= cost;
  const spend = (cost) => {
    gold -= cost;
    botView.gold = gold;
  };

  // 1. Defense
  if (botView.towers.length < cfg.maxTowers && nextRandom(rngHolder) < cfg.buildChance) {
    const types = Object.keys(TOWERS).filter((t) => t !== "railgun" || match.wave >= 5);
    const affordable = types.filter((t) => canAfford(TOWERS[t].cost));
    if (affordable.length > 0) {
      const type = affordable[randomInt(rngHolder, affordable.length)];
      const cell = chooseCell(match, botView, type, rngHolder, cfg.smartPlacement);
      if (cell && V.canBuild(view, botView, type, cell.x, cell.y).ok) {
        actions.push({ type: "build", towerType: type, gx: cell.x, gy: cell.y });
        spend(TOWERS[type].cost);
        botView.towers = [...botView.towers, { id: "pending", type, gridX: cell.x, gridY: cell.y, level: 1 }];
      }
    }
  }

  // 2. Upgrade the best-placed tower now and then (normal/hard)
  if (cfg.smartPlacement && botView.towers.length >= 4 && nextRandom(rngHolder) < 0.2) {
    const tower = botView.towers.filter((t) => t.id !== "pending").sort((a, b) => a.level - b.level)[0];
    if (tower && V.canUpgrade(view, botView, tower.id).ok) {
      actions.push({ type: "upgrade", towerId: tower.id });
      spend(upgradeCost(TOWERS[tower.type], tower.level));
    }
  }

  // 3. Economy
  if (nextRandom(rngHolder) < cfg.ecoChance) {
    const eco = ECO_UPGRADES.filter((e) => canAfford(e.cost)).at(-1);
    if (eco && gold - eco.cost >= 60) {
      actions.push({ type: "eco", ecoId: eco.id });
      spend(eco.cost);
    }
  }

  // 4. Offense — smarter bots send what the enemy's turrets are worst against
  if (match.matchMs >= cfg.raidDelayMs && nextRandom(rngHolder) < cfg.raidChance) {
    const options = Object.keys(CREEP_RAIDS);
    if (gold >= cfg.bossGold && nextRandom(rngHolder) < 0.3) options.push(...Object.keys(BOSS_SUMMONS));
    const affordable = options.filter((k) => V.canSendRaid(view, botView, k).ok);
    if (affordable.length > 0) {
      const choice = cfg.smartPlacement
        ? pickCounterRaid(affordable, enemy.towers, rngHolder)
        : affordable[randomInt(rngHolder, affordable.length)];
      actions.push({ type: "send-raid", creepType: choice });
      spend((CREEP_RAIDS[choice] || BOSS_SUMMONS[choice]).cost);
    }
  }

  // 5. Sabotage
  if (match.matchMs >= 12_000 && nextRandom(rngHolder) < cfg.spellChance) {
    const spells = ["orbital_nuke", "emp_freeze", "frenzy_rush"].filter((s) => V.canCast(view, botView, s).ok);
    if (spells.length > 0) actions.push({ type: "cast", spellId: spells[randomInt(rngHolder, spells.length)] });
  }

  return actions;
}
