// Runs the simulation for the local player's own lane, fed by server events, and
// reports kills/leaks back. Used by the human client (driven by the canvas frame
// loop) and by the solo bot (driven by a timer). No DOM access.

import {
  createLane,
  addCreeps,
  setTowers,
  removeCreep,
  applyStun,
  applyFrenzy,
  advanceLaneTo,
  drainEvents,
  snapshotLane,
} from "../shared/sim/lane.js";

const REPORT_EVERY_MS = 250;
const MAX_REPORT_BATCH = 60;
const CATCH_UP_LIMIT_MS = 90_000;

export class LaneController {
  constructor({ store, snapshotEveryMs = 200, now = () => performance.now() }) {
    this.store = store;
    this.now = now;
    this.snapshotEveryMs = snapshotEveryMs;
    this.lane = createLane();
    this.killed = [];
    this.leaked = [];
    this.lastReportAt = 0;
    this.lastSnapAt = 0;
    this.sentEmptySnap = true;
    this.phase = null;
    this.unsubs = [
      store.on("state", (view) => this.onState(view)),
      store.on("issued", (msg) => {
        if (msg.laneId === store.getState().playerId) addCreeps(this.lane, msg.entries);
      }),
      store.on("resolved", (msg) => {
        if (msg.laneId !== store.getState().playerId) return;
        // Expired creeps were never reported in time: drop them so they can't be reported twice
        for (const [id, outcome] of msg.items) if (outcome === "x") removeCreep(this.lane, id);
      }),
      store.on("tower", (msg) => {
        if (msg.playerId === store.getState().playerId) this.syncTowers();
      }),
      store.on("spell", (msg) => {
        if (msg.destroyedTower) this.syncTowers();
        if (msg.targetId !== store.getState().playerId) return;
        if (msg.spellId === "emp_freeze") applyStun(this.lane, msg.towerIds, msg.untilMs);
        if (msg.spellId === "frenzy_rush") applyFrenzy(this.lane, msg.untilMs);
      }),
      store.on("gameover", () => {
        this.reset();
      }),
    ];
    const view = store.getState().view;
    if (view) this.onState(view);
  }

  syncTowers() {
    const me = this.store.me();
    if (me) setTowers(this.lane, me.towers);
  }

  reset(t = 0) {
    this.lane = createLane({ t });
    this.killed = [];
    this.leaked = [];
  }

  // Full resync from the server (join, reconnect, room restart).
  onState(view) {
    const myId = this.store.getState().playerId;
    const wasPlaying = this.phase === "playing";
    this.phase = view.phase;
    if (view.phase !== "playing") {
      this.reset();
      return;
    }
    // A fresh match, or our clock is far off: rebuild from the server's open ledger
    if (!wasPlaying || Math.abs(this.lane.t - view.matchMs) > 5000) this.reset(view.matchMs);

    this.syncTowers();
    const open = view.lanes?.[myId] || [];
    const openIds = new Set(open.map((e) => e.id));
    for (const c of [...this.lane.creeps]) if (!openIds.has(c.id)) removeCreep(this.lane, c.id);
    this.lane.pending = this.lane.pending.filter((e) => openIds.has(e.id));
    addCreeps(this.lane, open);

    const fx = view.effects?.[myId];
    if (fx) {
      applyFrenzy(this.lane, fx.frenzyUntil || 0);
      for (const [towerId, until] of Object.entries(fx.stuns || {})) applyStun(this.lane, [towerId], until);
    }
  }

  // Advance to the server clock. Returns visual events (empty while catching up).
  update() {
    const view = this.store.getState().view;
    if (!view || view.phase !== "playing") return [];
    const target = this.store.matchNow();
    const behind = target - this.lane.t;
    let events;
    if (behind > 2000) {
      // Hidden tab / reconnect: catch up silently, keeping only the reports
      advanceLaneTo(this.lane, Math.min(target, this.lane.t + CATCH_UP_LIMIT_MS));
      events = drainEvents(this.lane);
      this.collectReports(events);
      events = [];
    } else {
      advanceLaneTo(this.lane, target, 8);
      events = drainEvents(this.lane);
      this.collectReports(events);
    }
    this.flush();
    return events;
  }

  collectReports(events) {
    for (const e of events) {
      if (e.type === "killed") this.killed.push(e.id);
      else if (e.type === "leaked") this.leaked.push(e.id);
    }
  }

  flush(force = false) {
    const t = this.now();
    if (this.killed.length || this.leaked.length) {
      if (force || t - this.lastReportAt >= REPORT_EVERY_MS || this.killed.length + this.leaked.length >= MAX_REPORT_BATCH) {
        while (this.killed.length || this.leaked.length) {
          this.store.reportLane(this.killed.splice(0, MAX_REPORT_BATCH), this.leaked.splice(0, MAX_REPORT_BATCH));
        }
        this.lastReportAt = t;
      }
    }
    if (this.snapshotEveryMs && t - this.lastSnapAt >= this.snapshotEveryMs) {
      const hasCreeps = this.lane.creeps.length > 0;
      if (hasCreeps || !this.sentEmptySnap) {
        this.store.sendSnap(snapshotLane(this.lane));
        this.sentEmptySnap = !hasCreeps;
      }
      this.lastSnapAt = t;
    }
  }

  destroy() {
    this.flush(true);
    for (const off of this.unsubs) off();
  }
}
