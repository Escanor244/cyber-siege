// Match-rule tuning shared by the server and clients.

import { TOWERS } from "./towers.js";

export const PROTOCOL_VERSION = 4; // v4: escalating power grid prices

export const TICK_MS = 250; // server clock resolution
export const MAX_TICK_ADVANCE_MS = 1000; // a stalled server never fast-forwards more than this per tick

// Creep issuing
export const SPAWN_LEAD_MS = 600; // absorbs network delay before the first creep appears
export const SPAWN_STAGGER_MS = 380; // gap between creeps of the same batch
export const MAX_OUTSTANDING_RAID_CREEPS = 150; // anti-flood: unresolved sent creeps per lane

// Ledger deadline = spawnAt + worst-case travel time * slack + latency allowance.
// SLOW_FLOOR is the slowest speed multiplier any creep can be held at.
export const SLOW_FLOOR = Math.min(
  1,
  ...Object.values(TOWERS).map((t) => 1 - (t.slowPct || 0))
);
export const DEADLINE_SLACK = 1.15;
export const DEADLINE_LATENCY_MS = 2500;
export const KILL_EARLY_TOLERANCE_MS = 1500; // client clocks may run slightly ahead of the server

// Spells
export const EMP_TOWER_COUNT = 2;
export const FRENZY_SPEED_MULT = 1.5;

// Optional classic line-wars rule: sending raids raises your income.
export const RAID_INCOME_BONUS_ENABLED = false;
export const RAID_INCOME_BONUS_PER_GOLD = 1 / 25;

// Room lifecycle (wall-clock)
export const PAUSE_FORFEIT_MS = 30_000;
export const IDLE_DISPOSE_MS = 15 * 60_000;

// Tower targeting
export const TARGET_MODES = ["first", "last", "strongest", "closest"];
export const DEFAULT_TARGET_MODE = "first";
