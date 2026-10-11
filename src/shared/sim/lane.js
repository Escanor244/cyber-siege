// Deterministic simulation of one player's lane: creeps walking the path (or
// flying straight at the core), towers firing, projectiles, damage and creep
// abilities. Pure: no DOM, no wall clock, no randomness.
//
// Time is "lane ms" and follows the server's match clock, so a creep issued with
// spawnAt = 12_600 appears when the lane clock reaches 12_600.
//
// Visual/audio consumers read `lane.events` (drain it every frame) and the
// `creeps`, `projectiles` and `beams` arrays; nothing here draws or plays sound.

import { PIXEL_PATH, AIR_PATH, cellCenter } from "../config/map.js";
import { getTowerDefinition } from "../config/towers.js";
import { findCreepDefinition } from "../config/creeps.js";
import { FRENZY_SPEED_MULT, DEFAULT_TARGET_MODE } from "../config/rules.js";
import { towerDamage, towerRange } from "../balance.js";
import { damageMultiplier, AEGIS_DAMAGE_FACTOR } from "./damage.js";
import { pickTarget } from "./targeting.js";

export const STEP_MS = 1000 / 60;
const BULLET_SPEED = 450; // px/s
const FLAK_SPEED = 380; // px/s
const BULLET_LIFE_MS = 1200;
const MORTAR_FLIGHT_PER_SEC = 1.8; // progress units per second (~0.55s flight)
const CHAIN_JUMP_RANGE = 95;
const SLOW_DURATION_MS = 1200;
const HEAL_FX_EVERY_MS = 600;
const MAX_EVENTS = 600;

// --------------------------------------------------------------------- routes

function makeRoute(points) {
  const segments = [];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, start: acc, len, angle: Math.atan2(b.y - a.y, b.x - a.x) });
    acc += len;
  }
  return {
    length: acc,
    positionAt(progress) {
      const p = Math.max(0, Math.min(acc, progress));
      for (const seg of segments) {
        if (p <= seg.start + seg.len) {
          const f = seg.len === 0 ? 0 : (p - seg.start) / seg.len;
          return { x: seg.a.x + (seg.b.x - seg.a.x) * f, y: seg.a.y + (seg.b.y - seg.a.y) * f, angle: seg.angle };
        }
      }
      const last = segments[segments.length - 1];
      return { x: last.b.x, y: last.b.y, angle: last.angle };
    },
  };
}

export const GROUND_ROUTE = makeRoute(PIXEL_PATH);
export const AIR_ROUTE = makeRoute(AIR_PATH);

// Ground path position (kept for callers that only care about the corridor)
export function pathPosition(progress) {
  return GROUND_ROUTE.positionAt(progress);
}

const routeOf = (c) => (c.flying ? AIR_ROUTE : GROUND_ROUTE);

// ---------------------------------------------------------------------- state

export function createLane({ t = 0 } = {}) {
  return {
    t,
    creeps: [], // live, spawned creeps
    pending: [], // issued but not yet spawned, sorted by spawnAt
    knownIds: new Set(),
    projectiles: [],
    beams: [], // short-lived visual lines (cryo, tesla, railgun)
    towers: [],
    nextFireAt: new Map(), // towerId -> lane ms
    stuns: new Map(), // towerId -> stunned until (lane ms)
    frenzyUntil: 0,
    events: [],
  };
}

function emit(lane, event) {
  if (lane.events.length >= MAX_EVENTS) lane.events.shift();
  lane.events.push(event);
}

export function drainEvents(lane) {
  const out = lane.events;
  lane.events = [];
  return out;
}

// Replace the tower list (towers are authoritative on the server).
export function setTowers(lane, towers) {
  const prevAngles = new Map(lane.towers.map((t) => [t.id, t.angle]));
  lane.towers = towers
    .filter((t) => getTowerDefinition(t.type))
    .map((t) => {
      const { x, y } = cellCenter(t.gridX, t.gridY);
      return {
        id: t.id,
        type: t.type,
        level: t.level,
        targetMode: t.targetMode || DEFAULT_TARGET_MODE,
        gridX: t.gridX,
        gridY: t.gridY,
        x,
        y,
        angle: prevAngles.get(t.id) ?? -Math.PI / 2,
        jammed: false,
      };
    });
  const ids = new Set(lane.towers.map((t) => t.id));
  for (const id of lane.nextFireAt.keys()) if (!ids.has(id)) lane.nextFireAt.delete(id);
  for (const id of lane.stuns.keys()) if (!ids.has(id)) lane.stuns.delete(id);
}

// Queue creeps issued by the server: [{id, type, level, hp, bounty, leak, spawnAt}]
export function addCreeps(lane, entries) {
  let added = false;
  for (const e of entries) {
    if (lane.knownIds.has(e.id)) continue;
    if (!findCreepDefinition(e.type)) continue;
    lane.knownIds.add(e.id);
    lane.pending.push(e);
    added = true;
  }
  if (added) lane.pending.sort((a, b) => a.spawnAt - b.spawnAt || a.id - b.id);
}

// The server resolved a creep (e.g. deadline expiry) — drop it silently.
export function removeCreep(lane, id) {
  lane.pending = lane.pending.filter((e) => e.id !== id);
  const c = lane.creeps.find((cr) => cr.id === id);
  if (c) c.dead = true;
  lane.creeps = lane.creeps.filter((cr) => cr.id !== id);
}

export function applyStun(lane, towerIds, untilMs) {
  for (const id of towerIds) lane.stuns.set(id, Math.max(untilMs, lane.stuns.get(id) || 0));
}

export function applyFrenzy(lane, untilMs) {
  lane.frenzyUntil = Math.max(lane.frenzyUntil, untilMs);
}

export function isTowerStunned(lane, towerId) {
  return (lane.stuns.get(towerId) || 0) > lane.t;
}

function spawnCreep(lane, entry) {
  const def = findCreepDefinition(entry.type);
  const flying = !!def.flying;
  const route = flying ? AIR_ROUTE : GROUND_ROUTE;
  const pxPerMs = (def.speed * 60) / 1000;
  // If the lane clock is already past spawnAt (reconnect/catch-up), start further along.
  const progress = Math.max(0, (lane.t - entry.spawnAt) * pxPerMs);
  const pos = route.positionAt(progress);
  // Level scaling for abilities follows the same multiplier as the creep's hp
  const levelScale = def.hp > 0 ? entry.hp / def.hp : 1;
  lane.creeps.push({
    id: entry.id,
    type: entry.type,
    level: entry.level || 1,
    hp: entry.hp,
    maxHp: entry.hp,
    bounty: entry.bounty,
    leak: entry.leak,
    armor: def.armor || "light",
    speed: def.speed,
    radius: def.size || 14,
    flying,
    auraRadius: def.shieldAuraRadius || 0,
    heal: def.healAura ? { radius: def.healAura.radius, hpPerSec: def.healAura.hpPerSec * levelScale, nextFxAt: 0 } : null,
    jam: def.jamAura || null,
    pulse: def.empPulse ? { ...def.empPulse, nextAt: Math.max(lane.t, entry.spawnAt) + def.empPulse.everyMs } : null,
    isBoss: !!def.isBoss,
    color: def.color,
    progress,
    x: pos.x,
    y: pos.y,
    angle: pos.angle,
    slowUntil: 0,
    slowFactor: 1,
    spawned: true,
    dead: false,
    hitFlashUntil: 0,
  });
}

// ------------------------------------------------------------------- damage

// Is this creep inside a living Aegis Vanguard's shield aura?
function isShielded(lane, creep) {
  for (const c of lane.creeps) {
    if (c.dead || !c.auraRadius) continue;
    if (Math.hypot(c.x - creep.x, c.y - creep.y) <= c.auraRadius) return true;
  }
  return false;
}

function applyDamage(lane, creep, base, damageType, color) {
  if (creep.dead) return;
  const shield = isShielded(lane, creep) ? AEGIS_DAMAGE_FACTOR : 1;
  const amount = Math.max(1, Math.round(base * damageMultiplier(damageType, creep.armor) * shield));
  creep.hp -= amount;
  creep.hitFlashUntil = lane.t + 90;
  emit(lane, { type: "hit", creepId: creep.id, x: creep.x, y: creep.y, amount, color, shielded: shield < 1 });
  if (creep.hp <= 0) {
    creep.dead = true;
    emit(lane, {
      type: "killed",
      id: creep.id,
      x: creep.x,
      y: creep.y,
      bounty: creep.bounty,
      color: creep.color,
      isBoss: creep.isBoss,
      flying: creep.flying,
    });
  }
}

function creepPxPerMs(lane, c, atMs = lane.t) {
  const slow = c.slowUntil > atMs ? c.slowFactor : 1;
  const frenzy = atMs < lane.frenzyUntil ? FRENZY_SPEED_MULT : 1;
  return (c.speed * 60 * slow * frenzy) / 1000;
}

function predictPosition(lane, c, inMs) {
  return routeOf(c).positionAt(c.progress + creepPxPerMs(lane, c) * inMs);
}

function findCreep(lane, id) {
  for (const c of lane.creeps) if (c.id === id) return c;
  return null;
}

function slow(lane, creep, def) {
  // slowFactor resets to 1 when a slow expires (see stepLane), so min() never stacks stale slows
  creep.slowFactor = Math.min(creep.slowFactor, 1 - (def.slowPct || 0));
  creep.slowUntil = lane.t + SLOW_DURATION_MS;
}

// Distance from point p to segment a-b
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function canHit(def, creep) {
  return !creep.dead && (!creep.flying || def.canHitAir);
}

function fireTower(lane, tower, def, target) {
  const dmg = towerDamage(def, tower.level);
  const dtype = def.damageType;
  emit(lane, { type: "fire", towerId: tower.id, towerType: tower.type, x: tower.x, y: tower.y, tx: target.x, ty: target.y });

  switch (def.projectileType) {
    case "bullet":
      lane.projectiles.push({ kind: "bullet", x: tower.x, y: tower.y, targetId: target.id, damage: dmg, damageType: dtype, color: def.color, life: BULLET_LIFE_MS });
      break;

    case "flak":
      lane.projectiles.push({
        kind: "flak",
        x: tower.x,
        y: tower.y,
        targetId: target.id,
        damage: dmg,
        damageType: dtype,
        airMultiplier: def.airMultiplier || 1,
        groundMultiplier: def.groundMultiplier || 1,
        splash: def.airSplashRadius || 0,
        color: def.color,
        life: BULLET_LIFE_MS,
      });
      break;

    case "mortar": {
      // Lead the target: aim where it will be when the shell lands
      const impact = predictPosition(lane, target, 1000 / MORTAR_FLIGHT_PER_SEC);
      lane.projectiles.push({
        kind: "mortar",
        sx: tower.x,
        sy: tower.y,
        tx: impact.x,
        ty: impact.y,
        progress: 0,
        damage: dmg,
        damageType: dtype,
        radius: def.splashRadius || 60,
        color: def.color,
      });
      break;
    }

    case "beam": {
      // Frost burst: slows the target and every ground creep close to it
      for (const c of lane.creeps) {
        if (c === target || (!c.dead && !c.flying && Math.hypot(c.x - target.x, c.y - target.y) <= (def.slowRadius || 0))) {
          slow(lane, c, def);
        }
      }
      applyDamage(lane, target, dmg, dtype, def.color);
      lane.beams.push({ kind: "beam", x1: tower.x, y1: tower.y, x2: target.x, y2: target.y, color: def.color, life: 120, radius: def.slowRadius || 0 });
      break;
    }

    case "chain": {
      const chained = [target];
      const others = lane.creeps
        .filter((c) => canHit(def, c) && c !== target)
        .map((c) => ({ c, d: Math.hypot(c.x - target.x, c.y - target.y) }))
        .filter((o) => o.d <= CHAIN_JUMP_RANGE)
        .sort((a, b) => a.d - b.d || a.c.id - b.c.id);
      for (const o of others) {
        if (chained.length >= (def.chainTargets || 1)) break;
        chained.push(o.c);
      }
      let fromX = tower.x;
      let fromY = tower.y;
      for (const c of chained) {
        lane.beams.push({ kind: "chain", x1: fromX, y1: fromY, x2: c.x, y2: c.y, color: def.color, life: 150 });
        fromX = c.x;
        fromY = c.y;
        applyDamage(lane, c, dmg, dtype, def.color);
      }
      break;
    }

    case "laser": {
      // Piercing slug: travels the full range along the aim line, hitting everything on it
      const range = towerRange(def, tower.level);
      const dir = Math.atan2(target.y - tower.y, target.x - tower.x);
      const ex = tower.x + Math.cos(dir) * range;
      const ey = tower.y + Math.sin(dir) * range;
      const width = def.pierceWidth || 0;
      const victims = lane.creeps.filter((c) => canHit(def, c) && (c === target || distToSegment(c.x, c.y, tower.x, tower.y, ex, ey) <= width + c.radius));
      for (const c of victims) applyDamage(lane, c, dmg, dtype, def.color);
      lane.beams.push({ kind: "laser", x1: tower.x, y1: tower.y, x2: ex, y2: ey, color: def.color, life: 200, hits: victims.length });
      break;
    }

    default:
      applyDamage(lane, target, dmg, dtype, def.color);
  }
}

// ------------------------------------------------------------------- abilities

function runCreepAbilities(lane) {
  for (const c of lane.creeps) {
    if (c.dead) continue;

    // Nanite Mender: repairs creeps around it
    if (c.heal) {
      const amount = (c.heal.hpPerSec * STEP_MS) / 1000;
      let healed = false;
      for (const other of lane.creeps) {
        if (other.dead || other.hp >= other.maxHp) continue;
        if (Math.hypot(other.x - c.x, other.y - c.y) <= c.heal.radius) {
          other.hp = Math.min(other.maxHp, other.hp + amount);
          healed = true;
        }
      }
      if (healed && lane.t >= c.heal.nextFxAt) {
        c.heal.nextFxAt = lane.t + HEAL_FX_EVERY_MS;
        emit(lane, { type: "heal", x: c.x, y: c.y, radius: c.heal.radius });
      }
    }

    // Warden Titan: periodic EMP pulse stuns nearby towers
    if (c.pulse && lane.t >= c.pulse.nextAt) {
      c.pulse.nextAt += c.pulse.everyMs;
      const hit = lane.towers.filter((t) => Math.hypot(t.x - c.x, t.y - c.y) <= c.pulse.radius).map((t) => t.id);
      applyStun(lane, hit, lane.t + c.pulse.stunMs);
      emit(lane, { type: "pulse", x: c.x, y: c.y, radius: c.pulse.radius, towerIds: hit });
    }
  }
}

// Signal Jammer: towers inside a jam aura fire slower. Returns the fire-rate factor.
function jamFactor(lane, tower) {
  let factor = 1;
  for (const c of lane.creeps) {
    if (c.dead || !c.jam) continue;
    if (Math.hypot(c.x - tower.x, c.y - tower.y) <= c.jam.radius) factor = Math.min(factor, c.jam.fireRateMultiplier);
  }
  return factor;
}

// ------------------------------------------------------------------- stepping

// Advance exactly one fixed step.
export function stepLane(lane) {
  const dt = STEP_MS;
  lane.t += dt;

  // 1. Spawn creeps whose time has come
  while (lane.pending.length > 0 && lane.pending[0].spawnAt <= lane.t) {
    spawnCreep(lane, lane.pending.shift());
  }

  // 2. Move creeps; leaks
  for (const c of lane.creeps) {
    if (c.dead) continue;
    if (c.slowUntil <= lane.t) c.slowFactor = 1;
    c.progress += creepPxPerMs(lane, c) * dt;
    const route = routeOf(c);
    if (c.progress >= route.length) {
      c.dead = true;
      c.leaked = true;
      const end = PIXEL_PATH[PIXEL_PATH.length - 1];
      emit(lane, { type: "leaked", id: c.id, x: end.x, y: end.y, isBoss: c.isBoss, leak: c.leak });
      continue;
    }
    const pos = route.positionAt(c.progress);
    c.x = pos.x;
    c.y = pos.y;
    c.angle = pos.angle;
  }

  // 3. Creep abilities (healing, EMP pulses)
  runCreepAbilities(lane);

  // 4. Towers acquire targets and fire
  for (const tower of lane.towers) {
    const factor = jamFactor(lane, tower);
    tower.jammed = factor < 1;
    if (isTowerStunned(lane, tower.id)) continue;
    const def = getTowerDefinition(tower.type);
    const target = pickTarget(lane.creeps, tower.x, tower.y, towerRange(def, tower.level), tower.targetMode, def.canHitAir);
    if (!target) continue;
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    const readyAt = lane.nextFireAt.get(tower.id) ?? 0;
    if (lane.t >= readyAt) {
      lane.nextFireAt.set(tower.id, lane.t + 1000 / (def.fireRate * factor));
      fireTower(lane, tower, def, target);
    }
  }

  // 5. Projectiles
  const keep = [];
  for (const p of lane.projectiles) {
    if (p.kind === "bullet" || p.kind === "flak") {
      const target = findCreep(lane, p.targetId);
      if (!target || target.dead) continue; // fizzle: never damage a dead creep
      p.life -= dt;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.hypot(dx, dy);
      const stepPx = ((p.kind === "flak" ? FLAK_SPEED : BULLET_SPEED) * dt) / 1000;
      if (dist <= stepPx || p.life <= 0) {
        if (p.kind === "flak") {
          const mult = target.flying ? p.airMultiplier : p.groundMultiplier;
          applyDamage(lane, target, p.damage * mult, p.damageType, p.color);
          if (target.flying && p.splash) {
            emit(lane, { type: "airburst", x: target.x, y: target.y, radius: p.splash, color: p.color });
            const near = lane.creeps.filter((c) => c !== target && c.flying && !c.dead && Math.hypot(c.x - target.x, c.y - target.y) <= p.splash);
            for (const c of near) applyDamage(lane, c, p.damage * mult * 0.5, p.damageType, p.color);
          }
        } else {
          applyDamage(lane, target, p.damage, p.damageType, p.color);
        }
        continue;
      }
      p.dirX = dx / dist; // heading, used by the renderer for tracers
      p.dirY = dy / dist;
      p.x += (dx / dist) * stepPx;
      p.y += (dy / dist) * stepPx;
      keep.push(p);
    } else if (p.kind === "mortar") {
      p.progress += (MORTAR_FLIGHT_PER_SEC * dt) / 1000;
      if (p.progress >= 1) {
        emit(lane, { type: "explode", x: p.tx, y: p.ty, radius: p.radius, color: p.color });
        // Collect first, then damage: killing a creep never skips its neighbour.
        // Shells burst on the ground, so flyers are never hit.
        const victims = lane.creeps.filter((c) => !c.dead && !c.flying && Math.hypot(c.x - p.tx, c.y - p.ty) <= p.radius);
        for (const c of victims) applyDamage(lane, c, p.damage, p.damageType, p.color);
        continue;
      }
      keep.push(p);
    }
  }
  lane.projectiles = keep;

  // 6. Visual beams fade
  for (const b of lane.beams) b.life -= dt;
  lane.beams = lane.beams.filter((b) => b.life > 0);

  // 7. Remove dead/leaked creeps
  if (lane.creeps.some((c) => c.dead)) lane.creeps = lane.creeps.filter((c) => !c.dead);
}

// Step until the lane clock reaches `targetMs`. Returns steps taken.
export function advanceLaneTo(lane, targetMs, maxSteps = Infinity) {
  let steps = 0;
  while (lane.t + STEP_MS <= targetMs && steps < maxSteps) {
    stepLane(lane);
    steps++;
  }
  return steps;
}

// Compact snapshot for the opponent's view:
// { t, c: [id, x, y, hpPct, flags, ...] } flags: 1 = slowed
export function snapshotLane(lane) {
  const c = [];
  for (const cr of lane.creeps) {
    if (cr.dead) continue;
    c.push(
      cr.id,
      Math.round(cr.x),
      Math.round(cr.y),
      Math.max(0, Math.min(100, Math.round((cr.hp / cr.maxHp) * 100))),
      cr.slowUntil > lane.t ? 1 : 0
    );
  }
  return { t: Math.round(lane.t), c };
}
