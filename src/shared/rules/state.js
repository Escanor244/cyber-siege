// Match state shape. Everything here is plain data so the server can persist it
// and rebuild the room after a Durable Object restart.

import { STARTING_GOLD, STARTING_HP, STARTING_INCOME, NATURAL_WAVE_INTERVAL_SEC, INCOME_INTERVAL_SEC } from "../config/economy.js";
import { createLedger, openEntriesForLane, publicEntry } from "./ledger.js";

export function emptyStats() {
  return {
    creepsSent: 0,
    bossesSent: 0,
    kills: 0,
    leaksTaken: 0,
    damageDealt: 0,
    goldEarned: 0,
    goldSpent: 0,
    towersBuilt: 0,
    spellsCast: 0,
    ecoBought: 0,
  };
}

export function createMatch({ roomId = "", mode = "multi", seed = 1 } = {}) {
  return {
    roomId,
    mode, // 'multi' | 'solo'
    phase: "lobby", // 'lobby' | 'playing' | 'game_over' | 'closed'
    rngState: seed >>> 0,
    hostId: null,
    players: [],
    matchMs: 0,
    nextIncomeAtMs: INCOME_INTERVAL_SEC * 1000,
    wave: 0,
    nextWaveAtMs: NATURAL_WAVE_INTERVAL_SEC * 1000,
    pause: null, // { byPlayerId, byName, forfeitAt (wall ms) }
    ledger: createLedger(),
    effects: {}, // playerId -> { frenzyUntil, stuns: { towerId: untilMs } }
    winnerId: null,
    loserId: null,
    endReason: null,
    nextTowerId: 1,
  };
}

export function createPlayer({ id, name, slot, isHost = false, isBot = false, token = null }) {
  return {
    id,
    name,
    slot,
    isHost,
    isBot,
    token, // secret resume token, never sent to other players
    connId: null,
    connected: isBot,
    gold: STARTING_GOLD,
    income: STARTING_INCOME,
    hp: STARTING_HP,
    towers: [],
    cooldowns: {}, // spellId -> matchMs when ready again
    stats: emptyStats(),
  };
}

export function resetPlayerForMatch(p) {
  p.gold = STARTING_GOLD;
  p.income = STARTING_INCOME;
  p.hp = STARTING_HP;
  p.towers = [];
  p.cooldowns = {};
  p.stats = emptyStats();
}

export function getPlayer(match, playerId) {
  return match.players.find((p) => p.id === playerId) || null;
}

export function getOpponent(match, playerId) {
  return match.players.find((p) => p.id !== playerId) || null;
}

export function humanPlayers(match) {
  return match.players.filter((p) => !p.isBot);
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    slot: p.slot,
    isHost: p.isHost,
    isBot: p.isBot,
    connected: p.connected,
    gold: p.gold,
    income: p.income,
    hp: p.hp,
    towers: p.towers.map((t) => ({ ...t })),
    cooldowns: { ...p.cooldowns },
    stats: { ...p.stats },
  };
}

// What clients see. Secrets (tokens, connection ids, rng state) are stripped.
export function publicView(match, nowWallMs = 0) {
  return {
    roomId: match.roomId,
    mode: match.mode,
    phase: match.phase,
    hostId: match.hostId,
    players: match.players.map(publicPlayer),
    matchMs: match.matchMs,
    wave: match.wave,
    nextWaveAtMs: match.nextWaveAtMs,
    pause: match.pause
      ? {
          byPlayerId: match.pause.byPlayerId,
          byName: match.pause.byName,
          remainingMs: Math.max(0, match.pause.forfeitAt - nowWallMs),
        }
      : null,
    lanes: Object.fromEntries(
      match.players.map((p) => [p.id, openEntriesForLane(match.ledger, p.id).map(publicEntry)])
    ),
    effects: structuredCloneSafe(match.effects),
    winnerId: match.winnerId,
    loserId: match.loserId,
    endReason: match.endReason,
  };
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}
