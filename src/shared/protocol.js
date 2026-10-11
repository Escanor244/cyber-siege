// Wire protocol v2. Client -> server messages are validated here before any game
// logic sees them, so malformed or hostile input is dropped at the door.
//
// Client -> server
//   hello      { v, intent: 'create'|'join', name, token? }
//   sync       {}                                  -> server replies with full `state`
//   start | restart | leave
//   build      { reqId, towerType, gx, gy }
//   upgrade    { reqId, towerId }      sell { reqId, towerId }
//   set-target { reqId, towerId, mode }
//   send-raid  { reqId, creepType }    eco  { reqId, ecoId }    cast { reqId, spellId }
//   lane-report{ killed: [id], leaked: [id] }
//   lane-snap  { t, c: [id, x, y, hpPct, flags, ...] }
//   ping       { t }
//
// Server -> client
//   welcome { playerId, token, slot, isHost }   reject { code, reason }
//   state { seq, view }    tick    wave    creeps-issued    creeps-resolved
//   tower    eco    spell    game-over    room-closed    lane-snap { laneId, t, c }
//   ack { reqId }   nack { reqId, reason }   pong { t, matchMs }
// Every broadcast carries an increasing `seq`; a gap tells the client to `sync`.

import { PROTOCOL_VERSION } from "./config/rules.js";

export { PROTOCOL_VERSION };

export const MAX_MESSAGE_BYTES = 6000;
export const MAX_REPORT_IDS = 64;
export const MAX_SNAPSHOT_CREEPS = 160;
export const SNAPSHOT_FIELDS = 5;

const isInt = (v) => Number.isInteger(v);
const isStr = (v, max = 64) => typeof v === "string" && v.length > 0 && v.length <= max;
const isReqId = (v) => v === undefined || (isInt(v) && v >= 0);

function intArray(v, max) {
  return Array.isArray(v) && v.length <= max && v.every((x) => isInt(x) && x > 0);
}

const VALIDATORS = {
  hello: (m) =>
    isInt(m.v) && (m.intent === "create" || m.intent === "join") && typeof m.name === "string" && m.name.length <= 40 &&
    (m.token === undefined || m.token === null || isStr(m.token, 80)) &&
    (m.bot === undefined || typeof m.bot === "boolean"),
  sync: () => true,
  start: () => true,
  restart: () => true,
  leave: () => true,
  build: (m) => isReqId(m.reqId) && isStr(m.towerType) && isInt(m.gx) && isInt(m.gy),
  upgrade: (m) => isReqId(m.reqId) && isStr(m.towerId),
  sell: (m) => isReqId(m.reqId) && isStr(m.towerId),
  "set-target": (m) => isReqId(m.reqId) && isStr(m.towerId) && isStr(m.mode, 16),
  "send-raid": (m) => isReqId(m.reqId) && isStr(m.creepType),
  eco: (m) => isReqId(m.reqId) && isStr(m.ecoId),
  cast: (m) => isReqId(m.reqId) && isStr(m.spellId),
  "lane-report": (m) =>
    (m.killed === undefined || intArray(m.killed, MAX_REPORT_IDS)) &&
    (m.leaked === undefined || intArray(m.leaked, MAX_REPORT_IDS)),
  "lane-snap": (m) =>
    isInt(m.t) &&
    Array.isArray(m.c) &&
    m.c.length <= MAX_SNAPSHOT_CREEPS * SNAPSHOT_FIELDS &&
    m.c.length % SNAPSHOT_FIELDS === 0 &&
    m.c.every((x) => isInt(x) && x >= -1000 && x <= 1_000_000),
  ping: (m) => typeof m.t === "number" && Number.isFinite(m.t),
};

// Returns the parsed message, or null if it must be ignored.
export function parseClientMessage(raw) {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return null;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return null;
  const validate = Object.hasOwn(VALIDATORS, msg.type) ? VALIDATORS[msg.type] : null;
  if (!validate || !validate(msg)) return null;
  return msg;
}

export const ACTION_TYPES = new Set(["build", "upgrade", "sell", "set-target", "send-raid", "eco", "cast"]);

export function sanitizeName(name, fallback) {
  const clean = Array.from(String(name || ""))
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch !== "<" && ch !== ">")
    .join("")
    .trim()
    .slice(0, 16);
  return clean || fallback;
}
