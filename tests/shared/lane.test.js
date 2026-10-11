import { describe, expect, it } from "vitest";
import {
  createLane,
  addCreeps,
  setTowers,
  stepLane,
  advanceLaneTo,
  drainEvents,
  applyStun,
  applyFrenzy,
  snapshotLane,
  removeCreep,
  pathPosition,
  STEP_MS,
} from "../../src/shared/sim/lane.js";
import { createLedger, issueCreeps } from "../../src/shared/rules/ledger.js";
import { PIXEL_PATH, PATH_LENGTH_PX } from "../../src/shared/config/index.js";

function issue(groups, nowMs = 0, waveNumber = 1) {
  return issueCreeps(createLedger(), { laneId: "L", groups, waveNumber, source: "wave", nowMs });
}

function runUntilEmpty(lane, limitMs = 200_000) {
  const events = [];
  while ((lane.creeps.length || lane.pending.length) && lane.t < limitMs) {
    stepLane(lane);
    events.push(...drainEvents(lane));
  }
  return events;
}

describe("path", () => {
  it("maps progress to positions along the waypoints", () => {
    expect(pathPosition(0)).toMatchObject(PIXEL_PATH[0]);
    expect(pathPosition(PATH_LENGTH_PX)).toMatchObject({ x: PIXEL_PATH.at(-1).x, y: PIXEL_PATH.at(-1).y });
    expect(pathPosition(52)).toMatchObject({ x: 26 + 52, y: PIXEL_PATH[0].y });
  });
});

describe("lane simulation", () => {
  it("spawns creeps at their spawnAt time, never dropping any", () => {
    const lane = createLane();
    const entries = issue([{ type: "drone_swarm", count: 3 }]); // 18 creeps
    addCreeps(lane, entries.slice(0, 6));
    advanceLaneTo(lane, 1000);
    addCreeps(lane, entries.slice(6)); // a new batch mid-stagger must not cancel the old one
    const events = runUntilEmpty(lane);
    const leaked = events.filter((e) => e.type === "leaked").map((e) => e.id).sort((a, b) => a - b);
    expect(leaked).toEqual(entries.map((e) => e.id));
  });

  it("ignores duplicate issue messages", () => {
    const lane = createLane();
    const entries = issue([{ type: "scout_rush", count: 1 }]);
    addCreeps(lane, entries);
    addCreeps(lane, entries);
    expect(lane.pending).toHaveLength(3);
  });

  it("an undefended creep leaks after walking the full path", () => {
    const lane = createLane();
    const [e] = issue([{ type: "armored_squad", count: 1 }]).slice(0, 1);
    addCreeps(lane, [e]);
    const events = runUntilEmpty(lane);
    const leak = events.find((ev) => ev.type === "leaked");
    const expectedMs = e.spawnAt + (PATH_LENGTH_PX / (1.15 * 60)) * 1000;
    expect(leak.id).toBe(e.id);
    expect(lane.t).toBeGreaterThan(expectedMs - 50);
    expect(lane.t).toBeLessThan(expectedMs + 50);
    expect(lane.t).toBeLessThan(e.deadline);
  });

  it("kills each creep at most once, even with several towers firing", () => {
    const lane = createLane();
    setTowers(lane, [
      { id: "t1", type: "gatling", gridX: 1, gridY: 0, level: 5 },
      { id: "t2", type: "gatling", gridX: 2, gridY: 0, level: 5 },
      { id: "t3", type: "railgun", gridX: 3, gridY: 2, level: 3 },
      { id: "t4", type: "tesla", gridX: 4, gridY: 2, level: 3 },
    ]);
    const entries = issue([{ type: "scout_rush", count: 4 }]);
    addCreeps(lane, entries);
    const events = runUntilEmpty(lane);
    const killed = events.filter((e) => e.type === "killed").map((e) => e.id);
    const leaked = events.filter((e) => e.type === "leaked").map((e) => e.id);
    expect(new Set(killed).size).toBe(killed.length);
    expect([...killed, ...leaked].sort((a, b) => a - b)).toEqual(entries.map((e) => e.id));
    expect(killed.length).toBeGreaterThan(0);
  });

  it("mortar splash damages every creep in its radius (no skipped neighbours)", () => {
    const lane = createLane();
    setTowers(lane, [{ id: "m", type: "plasma", gridX: 3, gridY: 2, level: 1 }]);
    // Three weak creeps spawning together so they clump
    const entries = issue([{ type: "drone_swarm", count: 1 }]).slice(0, 3).map((e) => ({ ...e, spawnAt: 0, hp: 10 }));
    addCreeps(lane, entries);
    const events = runUntilEmpty(lane);
    const explode = events.findIndex((e) => e.type === "explode");
    const killsByFirstShell = events.slice(explode).filter((e) => e.type === "killed");
    expect(explode).toBeGreaterThanOrEqual(0);
    expect(killsByFirstShell.length).toBe(3);
  });

  it("stunned towers do not fire; frenzy speeds creeps up", () => {
    const lane = createLane();
    setTowers(lane, [{ id: "t1", type: "gatling", gridX: 1, gridY: 0, level: 1 }]);
    applyStun(lane, ["t1"], 100_000);
    addCreeps(lane, issue([{ type: "scout_rush", count: 1 }]));
    const events = runUntilEmpty(lane);
    expect(events.some((e) => e.type === "fire")).toBe(false);

    const fast = createLane();
    applyFrenzy(fast, 100_000);
    const [e] = issue([{ type: "armored_squad", count: 1 }]);
    addCreeps(fast, [e]);
    runUntilEmpty(fast);
    expect(fast.t).toBeLessThan(e.spawnAt + (PATH_LENGTH_PX / (1.15 * 60 * 1.5)) * 1000 + 50);
  });

  it("is deterministic for the same inputs", () => {
    const run = () => {
      const lane = createLane();
      setTowers(lane, [
        { id: "a", type: "cryo", gridX: 1, gridY: 2, level: 2 },
        { id: "b", type: "plasma", gridX: 5, gridY: 2, level: 2 },
        { id: "c", type: "tesla", gridX: 3, gridY: 5, level: 1 },
      ]);
      addCreeps(lane, issue([{ type: "drone_swarm", count: 2 }, { type: "armored_squad", count: 2 }], 0, 6));
      return runUntilEmpty(lane).map((e) => `${e.type}:${e.id ?? e.creepId ?? ""}:${Math.round(e.x ?? 0)}`).join("|");
    };
    expect(run()).toBe(run());
  });

  it("starts late creeps further along the path on catch-up", () => {
    const lane = createLane({ t: 3_000 });
    const [e] = issue([{ type: "scout_rush", count: 1 }], 0);
    addCreeps(lane, [e]);
    stepLane(lane);
    expect(lane.creeps[0].progress).toBeGreaterThan(300);
  });

  it("removeCreep drops server-resolved creeps; snapshots are compact", () => {
    const lane = createLane();
    const entries = issue([{ type: "scout_rush", count: 1 }]);
    addCreeps(lane, entries);
    advanceLaneTo(lane, 2000);
    removeCreep(lane, entries[0].id);
    const snap = snapshotLane(lane);
    expect(snap.c.length).toBe(2 * 5);
    expect(snap.c[3]).toBe(100);
  });

  it("uses a fixed timestep", () => {
    const lane = createLane();
    const steps = advanceLaneTo(lane, 1000);
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
    expect(lane.t).toBeCloseTo(steps * STEP_MS, 6);
  });
});
