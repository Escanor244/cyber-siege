// The opponent's lane as seen on this screen: built from their relayed snapshots
// (positions/hp) plus the server's creep issue/resolve events (type, level, kills),
// interpolated ~150ms in the past so movement stays smooth.

import { findCreepDefinition } from "../shared/config/creeps.js";
import { getTowerDefinition } from "../shared/config/towers.js";
import { cellCenter } from "../shared/config/map.js";
import { towerRange } from "../shared/balance.js";

const INTERP_DELAY_MS = 150;
const MAX_BUFFER = 6;

export class RemoteLaneView {
  constructor({ store, now = () => performance.now() }) {
    this.store = store;
    this.now = now;
    this.buffer = []; // [{ at, creeps: Map(id -> {x,y,hp,slowed}) }]
    this.meta = new Map(); // creep id -> issued entry
    this.events = []; // visual events (kills, leaks) for the effects layer
    this.angles = new Map();
    this.unsubs = [
      store.on("snap", (msg) => {
        if (msg.laneId !== this.laneId()) return;
        const creeps = new Map();
        for (let i = 0; i < msg.c.length; i += 5) {
          creeps.set(msg.c[i], { x: msg.c[i + 1], y: msg.c[i + 2], hp: msg.c[i + 3], slowed: msg.c[i + 4] & 1 });
        }
        this.buffer.push({ at: this.now(), creeps });
        if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
      }),
      store.on("issued", (msg) => {
        if (msg.laneId !== this.laneId()) return;
        for (const e of msg.entries) this.meta.set(e.id, e);
      }),
      store.on("resolved", (msg) => {
        if (msg.laneId !== this.laneId()) return;
        for (const [id, outcome] of msg.items) {
          const pos = this.lastPosition(id);
          const entry = this.meta.get(id);
          if (pos && entry) {
            const def = findCreepDefinition(entry.type);
            this.events.push(
              outcome === "k"
                ? { type: "killed", x: pos.x, y: pos.y, color: def?.color, isBoss: !!def?.isBoss, bounty: entry.bounty }
                : { type: "leaked", x: pos.x, y: pos.y, isBoss: !!def?.isBoss }
            );
          }
          this.meta.delete(id);
          for (const frame of this.buffer) frame.creeps.delete(id);
        }
      }),
      store.on("state", (view) => {
        const id = this.laneId();
        if (view.phase !== "playing") {
          this.buffer = [];
          this.meta.clear();
        }
        for (const e of view.lanes?.[id] || []) this.meta.set(e.id, e);
      }),
    ];
  }

  laneId() {
    return this.store.opponent()?.id;
  }

  lastPosition(id) {
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const c = this.buffer[i].creeps.get(id);
      if (c) return c;
    }
    return null;
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  // Scene for the renderer at the current time.
  scene(matchMs) {
    const opponent = this.store.opponent();
    const view = this.store.getState().view;
    const renderAt = this.now() - INTERP_DELAY_MS;

    // Pick the two snapshots around renderAt
    let a = null;
    let b = null;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].at <= renderAt) {
        a = this.buffer[i];
        b = this.buffer[i + 1] || null;
        break;
      }
    }
    if (!a && this.buffer.length) a = this.buffer[0];
    const f = a && b ? Math.min(1, Math.max(0, (renderAt - a.at) / (b.at - a.at || 1))) : 0;

    const creeps = [];
    if (a) {
      for (const [id, ca] of a.creeps) {
        const entry = this.meta.get(id);
        if (!entry) continue;
        const def = findCreepDefinition(entry.type);
        if (!def) continue;
        const cb = b?.creeps.get(id);
        const x = cb ? ca.x + (cb.x - ca.x) * f : ca.x;
        const y = cb ? ca.y + (cb.y - ca.y) * f : ca.y;
        const hpPct = cb ? cb.hp : ca.hp;
        const angle = cb && (cb.x !== ca.x || cb.y !== ca.y) ? Math.atan2(cb.y - ca.y, cb.x - ca.x) : 0;
        creeps.push({
          id,
          type: entry.type,
          level: entry.level,
          x,
          y,
          angle,
          hp: Math.round((entry.hp * hpPct) / 100),
          maxHp: entry.hp,
          radius: def.size || 14,
          isBoss: !!def.isBoss,
          color: def.color,
          slowed: !!(cb || ca).slowed,
          flash: false,
        });
      }
    }

    const stuns = view?.effects?.[opponent?.id]?.stuns || {};
    const towers = (opponent?.towers || []).map((t) => {
      const def = getTowerDefinition(t.type);
      const { x, y } = cellCenter(t.gridX, t.gridY);
      // Aim at the nearest creep in range so the enemy's turrets visibly track
      let angle = this.angles.get(t.id) ?? -Math.PI / 2;
      if (def) {
        const range = towerRange(def, t.level);
        let best = null;
        let bestD = range;
        for (const c of creeps) {
          const d = Math.hypot(c.x - x, c.y - y);
          if (d <= bestD) {
            bestD = d;
            best = c;
          }
        }
        if (best) angle = Math.atan2(best.y - y, best.x - x);
      }
      this.angles.set(t.id, angle);
      return { ...t, targetAngle: angle, stunned: (stuns[t.id] || 0) > matchMs };
    });

    const frenzyUntil = view?.effects?.[opponent?.id]?.frenzyUntil || 0;
    return { creeps, towers, projectiles: [], beams: [], frenzy: frenzyUntil > matchMs, coreHp: opponent?.hp ?? 100 };
  }

  destroy() {
    for (const off of this.unsubs) off();
  }
}
