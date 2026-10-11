// The match rules. Every change to gold, towers, hp, the clock or the phase goes
// through here — on the Cloudflare server for multiplayer and in the browser for
// solo — so both modes behave identically.
//
// Functions mutate the match and return a list of public event messages to broadcast.

import { getTowerDefinition } from "../config/towers.js";
import { findCreepDefinition } from "../config/creeps.js";
import { getSpellDefinition } from "../config/spells.js";
import { getEcoUpgrade, INCOME_INTERVAL_SEC, NATURAL_WAVE_INTERVAL_SEC } from "../config/economy.js";
import {
  EMP_TOWER_COUNT,
  RAID_INCOME_BONUS_ENABLED,
  RAID_INCOME_BONUS_PER_GOLD,
  DEFAULT_TARGET_MODE,
} from "../config/rules.js";
import { upgradeCost, sellRefund, waveClearBonus, ecoPrice } from "../balance.js";
import { randomInt, sampleDistinct } from "../rng.js";
import { issueCreeps, resolveReport, expireOverdue, clearLedger, publicEntry } from "./ledger.js";
import { getWave } from "./waveGen.js";
import { getPlayer, getOpponent, resetPlayerForMatch } from "./state.js";
import * as V from "./validate.js";

const INCOME_MS = INCOME_INTERVAL_SEC * 1000;
const WAVE_MS = NATURAL_WAVE_INTERVAL_SEC * 1000;

function effectsFor(match, playerId) {
  if (!match.effects[playerId]) match.effects[playerId] = { frenzyUntil: 0, stuns: {} };
  return match.effects[playerId];
}

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

export function startMatch(match) {
  match.phase = "playing";
  match.matchMs = 0;
  match.nextIncomeAtMs = INCOME_MS;
  match.wave = 0;
  match.nextWaveAtMs = WAVE_MS;
  match.pause = null;
  match.winnerId = null;
  match.loserId = null;
  match.endReason = null;
  match.effects = {};
  clearLedger(match.ledger);
  for (const p of match.players) resetPlayerForMatch(p);
}

export function returnToLobby(match) {
  match.phase = "lobby";
  match.matchMs = 0;
  match.wave = 0;
  match.nextWaveAtMs = WAVE_MS;
  match.pause = null;
  match.winnerId = null;
  match.loserId = null;
  match.endReason = null;
  match.effects = {};
  clearLedger(match.ledger);
  for (const p of match.players) resetPlayerForMatch(p);
}

function gameOverEvent(match) {
  return {
    type: "game-over",
    winnerId: match.winnerId,
    loserId: match.loserId,
    reason: match.endReason,
    matchMs: match.matchMs,
    players: match.players.map((p) => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      isBot: p.isBot,
      hp: p.hp,
      income: p.income,
      stats: { ...p.stats },
    })),
  };
}

// Ends the match. Idempotent: a finished match can never be re-decided.
export function endMatch(match, { winnerId, loserId, reason }) {
  if (match.phase !== "playing") return [];
  match.phase = "game_over";
  match.winnerId = winnerId || null;
  match.loserId = loserId || null;
  match.endReason = reason;
  match.pause = null;
  clearLedger(match.ledger);
  return [gameOverEvent(match)];
}

export function forfeit(match, loserId, reason = "forfeit") {
  const winner = getOpponent(match, loserId);
  return endMatch(match, { winnerId: winner?.id, loserId, reason });
}

function checkCoreDestroyed(match) {
  const dead = match.players.filter((p) => p.hp <= 0);
  if (dead.length === 0) return [];
  if (dead.length >= 2) {
    return endMatch(match, { winnerId: null, loserId: null, reason: "draw" });
  }
  const loser = dead[0];
  return endMatch(match, { winnerId: getOpponent(match, loser.id)?.id, loserId: loser.id, reason: "core" });
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

function issueWave(match, waveNumber) {
  const wave = getWave(waveNumber);
  const events = [];
  for (const p of match.players) {
    const entries = issueCreeps(match.ledger, {
      laneId: p.id,
      groups: wave.creeps,
      waveNumber,
      source: "wave",
      nowMs: match.matchMs,
    });
    events.push({
      type: "creeps-issued",
      laneId: p.id,
      source: "wave",
      senderId: null,
      wave: waveNumber,
      entries: entries.map(publicEntry),
    });
  }
  return events;
}

function applyLeaks(match, laneOwner, entries, outcome) {
  if (entries.length === 0) return [];
  const items = [];
  for (const e of entries) {
    laneOwner.hp = Math.max(0, laneOwner.hp - e.leak);
    laneOwner.stats.leaksTaken += 1;
    const sender = e.senderId ? getPlayer(match, e.senderId) : null;
    if (sender) sender.stats.damageDealt += e.leak;
    items.push([e.id, outcome, e.leak]);
  }
  return [{ type: "creeps-resolved", laneId: laneOwner.id, items, hp: laneOwner.hp, gold: laneOwner.gold }];
}

// Advances the match clock by deltaMs. Returns events (income is folded into ticks).
export function advanceClock(match, deltaMs) {
  if (match.phase !== "playing" || match.pause || deltaMs <= 0) return [];
  const events = [];
  match.matchMs += deltaMs;

  while (match.matchMs >= match.nextIncomeAtMs) {
    for (const p of match.players) {
      p.gold += p.income;
      p.stats.goldEarned += p.income;
    }
    match.nextIncomeAtMs += INCOME_MS;
  }

  while (match.matchMs >= match.nextWaveAtMs) {
    match.wave += 1;
    match.nextWaveAtMs += WAVE_MS;
    const bonus = waveClearBonus(match.wave);
    for (const p of match.players) {
      p.gold += bonus;
      p.stats.goldEarned += bonus;
    }
    const wave = getWave(match.wave);
    events.push({
      type: "wave",
      wave: match.wave,
      name: wave.name,
      isBossWave: !!wave.isBossWave,
      bonus,
      nextWaveAtMs: match.nextWaveAtMs,
    });
    events.push(...issueWave(match, match.wave));
  }

  // Creeps never reported in time count as leaks
  const expired = expireOverdue(match.ledger, match.matchMs);
  if (expired.length > 0) {
    for (const p of match.players) {
      events.push(...applyLeaks(match, p, expired.filter((e) => e.laneId === p.id), "x"));
    }
    events.push(...checkCoreDestroyed(match));
  }

  // Drop finished effects
  for (const fx of Object.values(match.effects)) {
    if (fx.frenzyUntil <= match.matchMs) fx.frenzyUntil = 0;
    for (const [towerId, until] of Object.entries(fx.stuns)) {
      if (until <= match.matchMs) delete fx.stuns[towerId];
    }
  }

  return events;
}

export function tickEvent(match, nowWallMs = 0) {
  return {
    type: "tick",
    matchMs: match.matchMs,
    wave: match.wave,
    nextWaveAtMs: match.nextWaveAtMs,
    players: match.players.map((p) => ({ id: p.id, gold: p.gold, income: p.income, hp: p.hp })),
    pause: match.pause
      ? { byPlayerId: match.pause.byPlayerId, byName: match.pause.byName, remainingMs: Math.max(0, match.pause.forfeitAt - nowWallMs) }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

function spend(player, amount) {
  player.gold -= amount;
  player.stats.goldSpent += amount;
}

const rejected = (reason) => ({ ok: false, reason, events: [] });

export function applyAction(match, playerId, action) {
  const player = getPlayer(match, playerId);
  switch (action.type) {
    case "build": {
      const check = V.canBuild(match, player, action.towerType, action.gx, action.gy);
      if (!check.ok) return rejected(check.reason);
      const def = getTowerDefinition(action.towerType);
      spend(player, def.cost);
      const tower = {
        id: `t${match.nextTowerId++}`,
        type: def.id,
        gridX: action.gx,
        gridY: action.gy,
        level: 1,
        targetMode: DEFAULT_TARGET_MODE,
      };
      player.towers.push(tower);
      player.stats.towersBuilt += 1;
      return { ok: true, events: [{ type: "tower", op: "built", playerId, tower: { ...tower }, gold: player.gold }] };
    }

    case "upgrade": {
      const check = V.canUpgrade(match, player, action.towerId);
      if (!check.ok) return rejected(check.reason);
      const tower = player.towers.find((t) => t.id === action.towerId);
      spend(player, upgradeCost(getTowerDefinition(tower.type), tower.level));
      tower.level += 1;
      return { ok: true, events: [{ type: "tower", op: "upgraded", playerId, tower: { ...tower }, gold: player.gold }] };
    }

    case "sell": {
      const check = V.canSell(match, player, action.towerId);
      if (!check.ok) return rejected(check.reason);
      const tower = player.towers.find((t) => t.id === action.towerId);
      const refund = sellRefund(getTowerDefinition(tower.type), tower.level);
      player.gold += refund;
      player.towers = player.towers.filter((t) => t.id !== tower.id);
      delete effectsFor(match, playerId).stuns[tower.id];
      return { ok: true, events: [{ type: "tower", op: "sold", playerId, towerId: tower.id, refund, gold: player.gold }] };
    }

    case "set-target": {
      const check = V.canSetTarget(match, player, action.towerId, action.mode);
      if (!check.ok) return rejected(check.reason);
      const tower = player.towers.find((t) => t.id === action.towerId);
      tower.targetMode = action.mode;
      return { ok: true, events: [{ type: "tower", op: "target", playerId, tower: { ...tower }, gold: player.gold }] };
    }

    case "send-raid": {
      const check = V.canSendRaid(match, player, action.creepType);
      if (!check.ok) return rejected(check.reason);
      const def = findCreepDefinition(action.creepType);
      const target = getOpponent(match, playerId);
      spend(player, def.cost);
      if (def.isBoss) player.stats.bossesSent += 1;
      else player.stats.creepsSent += def.count || 1;
      if (RAID_INCOME_BONUS_ENABLED) player.income += Math.floor(def.cost * RAID_INCOME_BONUS_PER_GOLD);
      const entries = issueCreeps(match.ledger, {
        laneId: target.id,
        groups: [{ type: def.id, count: 1 }],
        waveNumber: Math.max(1, match.wave),
        source: "raid",
        senderId: playerId,
        nowMs: match.matchMs,
      });
      return {
        ok: true,
        events: [
          {
            type: "creeps-issued",
            laneId: target.id,
            source: "raid",
            senderId: playerId,
            senderGold: player.gold,
            senderIncome: player.income,
            creepType: def.id,
            isBoss: !!def.isBoss,
            wave: match.wave,
            entries: entries.map(publicEntry),
          },
        ],
      };
    }

    case "eco": {
      const check = V.canBuyEco(match, player, action.ecoId);
      if (!check.ok) return rejected(check.reason);
      const eco = getEcoUpgrade(action.ecoId);
      spend(player, ecoPrice(eco, player.ecoOwned));
      player.income += eco.incomeBoost;
      player.stats.ecoBought += 1;
      player.ecoOwned = { ...(player.ecoOwned || {}), [eco.id]: (player.ecoOwned?.[eco.id] || 0) + 1 };
      return {
        ok: true,
        events: [{ type: "eco", playerId, ecoId: eco.id, income: player.income, gold: player.gold, ecoOwned: { ...player.ecoOwned } }],
      };
    }

    case "cast": {
      const check = V.canCast(match, player, action.spellId);
      if (!check.ok) return rejected(check.reason);
      const spell = getSpellDefinition(action.spellId);
      const target = getOpponent(match, playerId);
      spend(player, spell.cost);
      player.stats.spellsCast += 1;
      player.cooldowns[spell.id] = match.matchMs + spell.cooldown * 1000;

      const event = {
        type: "spell",
        spellId: spell.id,
        casterId: playerId,
        targetId: target.id,
        untilMs: 0,
        towerIds: [],
        destroyedTower: null,
        casterGold: player.gold,
        cooldownUntilMs: player.cooldowns[spell.id],
      };
      const fx = effectsFor(match, target.id);

      if (spell.id === "emp_freeze") {
        event.untilMs = match.matchMs + spell.duration * 1000;
        const picked = sampleDistinct(match, target.towers.map((t) => t.id), EMP_TOWER_COUNT);
        for (const id of picked) fx.stuns[id] = Math.max(event.untilMs, fx.stuns[id] || 0);
        event.towerIds = picked;
      } else if (spell.id === "frenzy_rush") {
        event.untilMs = match.matchMs + spell.duration * 1000;
        fx.frenzyUntil = Math.max(fx.frenzyUntil, event.untilMs);
      } else if (spell.destroysTower) {
        const victim = target.towers[randomInt(match, target.towers.length)];
        target.towers = target.towers.filter((t) => t.id !== victim.id);
        delete fx.stuns[victim.id];
        event.destroyedTower = { ...victim };
      }
      return { ok: true, events: [event] };
    }

    default:
      return rejected("Unknown action");
  }
}

// ---------------------------------------------------------------------------
// Lane reports from the lane owner's client
// ---------------------------------------------------------------------------

export function applyLaneReports(match, playerId, { killed = [], leaked = [] }) {
  const owner = getPlayer(match, playerId);
  if (!owner || match.phase !== "playing") return [];

  const items = [];
  const leakedEntries = [];
  for (const id of killed) {
    const entry = resolveReport(match.ledger, { laneId: playerId, id, nowMs: match.matchMs });
    if (!entry) continue;
    owner.gold += entry.bounty;
    owner.stats.goldEarned += entry.bounty;
    owner.stats.kills += 1;
    items.push([entry.id, "k", entry.bounty]);
  }
  for (const id of leaked) {
    const entry = resolveReport(match.ledger, { laneId: playerId, id, nowMs: match.matchMs });
    if (entry) leakedEntries.push(entry);
  }

  const events = [];
  if (items.length > 0) {
    events.push({ type: "creeps-resolved", laneId: playerId, items, hp: owner.hp, gold: owner.gold });
  }
  events.push(...applyLeaks(match, owner, leakedEntries, "l"));
  if (leakedEntries.length > 0) events.push(...checkCoreDestroyed(match));
  return events;
}
