// Creep ledger: the server's record of every creep it put on a lane.
// Each creep is resolved exactly once — killed (bounty to the lane owner),
// leaked (damage to the lane owner) or expired (treated as a leak because the
// owner never reported it in time).
//
// The ledger is a plain object stored inside the match so it persists with it.

import { findCreepDefinition } from "../config/creeps.js";
import { PATH_LENGTH_PX } from "../config/map.js";
import {
  SPAWN_LEAD_MS,
  SPAWN_STAGGER_MS,
  SLOW_FLOOR,
  DEADLINE_SLACK,
  DEADLINE_LATENCY_MS,
  KILL_EARLY_TOLERANCE_MS,
} from "../config/rules.js";
import { scaleCreep } from "../balance.js";

export function createLedger() {
  return { nextId: 1, open: {} };
}

// Worst-case time for a creep of this speed to walk the whole path.
export function worstCaseTravelMs(def) {
  return (PATH_LENGTH_PX / (def.speed * 60 * SLOW_FLOOR)) * 1000;
}

export function creepDeadline(def, spawnAt) {
  return Math.ceil(spawnAt + worstCaseTravelMs(def) * DEADLINE_SLACK + DEADLINE_LATENCY_MS);
}

// Issues a batch of creeps onto `laneId`'s lane.
// groups: [{ type, count }] where count is in "packs" (a scout pack is 3 creeps).
export function issueCreeps(ledger, { laneId, groups, waveNumber, source, senderId, nowMs }) {
  const entries = [];
  let index = 0;
  for (const group of groups) {
    const def = findCreepDefinition(group.type);
    if (!def) continue;
    const scaled = scaleCreep(def, waveNumber);
    const individuals = group.count * (def.count || 1);
    for (let i = 0; i < individuals; i++) {
      const spawnAt = nowMs + SPAWN_LEAD_MS + index * SPAWN_STAGGER_MS;
      const entry = {
        id: ledger.nextId++,
        laneId,
        type: group.type,
        level: scaled.level,
        hp: scaled.hp,
        bounty: scaled.bounty,
        leak: scaled.leakDamage,
        spawnAt,
        deadline: creepDeadline(def, spawnAt),
        source,
        senderId: senderId || null,
      };
      ledger.open[entry.id] = entry;
      entries.push(entry);
      index++;
    }
  }
  return entries;
}

export function openCount(ledger, laneId, source) {
  let n = 0;
  for (const e of Object.values(ledger.open)) {
    if (e.laneId === laneId && (!source || e.source === source)) n++;
  }
  return n;
}

export function openEntriesForLane(ledger, laneId) {
  return Object.values(ledger.open)
    .filter((e) => e.laneId === laneId)
    .sort((a, b) => a.id - b.id);
}

// Resolves one creep reported by the lane owner. Returns the entry, or null if
// the report is invalid (unknown id, wrong lane, already resolved, too early).
export function resolveReport(ledger, { laneId, id, nowMs }) {
  const entry = ledger.open[id];
  if (!entry || entry.laneId !== laneId) return null;
  if (nowMs + KILL_EARLY_TOLERANCE_MS < entry.spawnAt) return null;
  delete ledger.open[id];
  return entry;
}

// Removes and returns every creep whose deadline has passed.
export function expireOverdue(ledger, nowMs) {
  const expired = [];
  for (const entry of Object.values(ledger.open)) {
    if (entry.deadline <= nowMs) {
      delete ledger.open[entry.id];
      expired.push(entry);
    }
  }
  return expired.sort((a, b) => a.id - b.id);
}

export function clearLedger(ledger) {
  ledger.open = {};
}

// What a client needs to simulate/display an issued creep (no server-only fields).
export function publicEntry(e) {
  return {
    id: e.id,
    type: e.type,
    level: e.level,
    hp: e.hp,
    bounty: e.bounty,
    leak: e.leak,
    spawnAt: e.spawnAt,
    deadline: e.deadline,
  };
}
