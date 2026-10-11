// Every tower and creep ability promised on its card, proven in the simulation.
import { describe, expect, it } from "vitest";
import { createLane, addCreeps, setTowers, stepLane, drainEvents, isTowerStunned, AIR_ROUTE, GROUND_ROUTE } from "../../src/shared/sim/lane.js";
import { createLedger, issueCreeps, worstCaseTravelMs, creepDeadline } from "../../src/shared/rules/ledger.js";
import { towerRange, MAX_RANGE_BONUS } from "../../src/shared/balance.js";
import { TOWERS, CREEP_RAIDS, BOSS_SUMMONS, AIR_PATH_LENGTH, PATH_LENGTH_PX } from "../../src/shared/config/index.js";

// Issue creeps; optionally override fields (spawnAt, hp) for controlled setups
function creeps(groups, overrides = {}) {
  return issueCreeps(createLedger(), { laneId: "L", groups, waveNumber: 1, source: "wave", nowMs: 0 }).map((e) => ({ ...e, ...overrides }));
}

function run(lane, ms) {
  const events = [];
  const end = lane.t + ms;
  while (lane.t < end) {
    stepLane(lane);
    events.push(...drainEvents(lane));
  }
  return events;
}

// Run until a creep has walked `progress` px along its route
function runUntilProgress(lane, id, progress, limit = 60_000) {
  const events = [];
  while (lane.t < limit) {
    const c = lane.creeps.find((x) => x.id === id);
    if (c && c.progress >= progress) break;
    stepLane(lane);
    events.push(...drainEvents(lane));
  }
  return events;
}

describe("tower abilities", () => {
  it("Cryo slows its target AND nearby ground creeps", () => {
    const lane = createLane();
    setTowers(lane, [{ id: "c", type: "cryo", gridX: 3, gridY: 0, level: 1 }]);
    const [a, b] = creeps([{ type: "armored_squad", count: 1 }], { spawnAt: 0, hp: 100000 }).slice(0, 2);
    addCreeps(lane, [a, { ...b, spawnAt: 120 }]); // second mech ~10px behind
    runUntilProgress(lane, a.id, 140);
    const [ca, cb] = [lane.creeps.find((c) => c.id === a.id), lane.creeps.find((c) => c.id === b.id)];
    expect(ca.slowUntil).toBeGreaterThan(lane.t);
    expect(cb.slowUntil).toBeGreaterThan(lane.t);
    expect(cb.slowFactor).toBeCloseTo(0.55);
  });

  it("Railgun slug pierces every creep on its line", () => {
    const lane = createLane();
    // Railgun left of the first corridor segment, firing along it
    setTowers(lane, [{ id: "r", type: "railgun", gridX: 0, gridY: 0, level: 1 }]);
    const group = creeps([{ type: "scout_rush", count: 1 }], { spawnAt: 0, hp: 100000 });
    addCreeps(lane, group.map((e, i) => ({ ...e, spawnAt: i * 150 })));
    const events = run(lane, 2500);
    const firstShot = events.findIndex((e) => e.type === "fire");
    const hitsOfFirstShot = new Set();
    for (const e of events.slice(firstShot + 1)) {
      if (e.type === "fire") break;
      if (e.type === "hit") hitsOfFirstShot.add(e.creepId);
    }
    expect(hitsOfFirstShot.size).toBeGreaterThanOrEqual(2);
  });

  it("range growth is capped at +60%", () => {
    expect(towerRange(TOWERS.gatling, 1)).toBe(125);
    expect(towerRange(TOWERS.gatling, 6)).toBeCloseTo(125 * 1.6);
    expect(towerRange(TOWERS.gatling, 100)).toBeCloseTo(125 * (1 + MAX_RANGE_BONUS));
  });

  it("Flak does double damage to flyers, half to ground, and splashes other flyers", () => {
    const lane = createLane();
    setTowers(lane, [{ id: "f", type: "flak", gridX: 1, gridY: 0, level: 1 }]);
    addCreeps(lane, creeps([{ type: "sky_skimmer", count: 1 }], { spawnAt: 0, hp: 100000 }));
    const air = run(lane, 1500).filter((e) => e.type === "hit");
    expect(air[0].amount).toBe(TOWERS.flak.damage * 2);
    // splash: more hit events than direct shots
    expect(air.some((e) => e.amount === TOWERS.flak.damage)).toBe(true);

    const ground = createLane();
    setTowers(ground, [{ id: "f", type: "flak", gridX: 1, gridY: 0, level: 1 }]);
    addCreeps(ground, creeps([{ type: "scout_rush", count: 1 }], { spawnAt: 0, hp: 100000 }));
    const g = run(ground, 1500).find((e) => e.type === "hit");
    expect(g.amount).toBe(TOWERS.flak.damage * 0.5);
  });

  it("every tower declares whether it can hit air, matching its description", () => {
    for (const t of Object.values(TOWERS)) {
      expect(typeof t.canHitAir).toBe("boolean");
      expect(t.desc.includes("Ground only")).toBe(!t.canHitAir);
    }
  });
});

describe("flying creeps", () => {
  it("fly a straight line that is much shorter than the corridor", () => {
    expect(AIR_ROUTE.length).toBeCloseTo(AIR_PATH_LENGTH);
    expect(AIR_PATH_LENGTH).toBeLessThan(PATH_LENGTH_PX / 2);
    const lane = createLane();
    const [e] = creeps([{ type: "sky_skimmer", count: 1 }]);
    addCreeps(lane, [e]);
    const events = run(lane, 20_000);
    const leak = events.find((x) => x.type === "leaked");
    expect(leak.id).toBe(e.id);
    expect(e.deadline).toBe(creepDeadline(CREEP_RAIDS.sky_skimmer, e.spawnAt));
    expect(worstCaseTravelMs(CREEP_RAIDS.sky_skimmer)).toBeLessThan(worstCaseTravelMs(CREEP_RAIDS.scout_rush) * 2);
  });

  it("can't be targeted by Mortar or Cryo, but Gatling shoots them", () => {
    for (const [type, expectHit] of [["plasma", false], ["cryo", false], ["gatling", true], ["tesla", true]]) {
      const lane = createLane();
      setTowers(lane, [{ id: "t", type, gridX: 3, gridY: 2, level: 1 }]);
      addCreeps(lane, creeps([{ type: "sky_skimmer", count: 1 }], { hp: 100000 }));
      const hits = run(lane, 9000).filter((e) => e.type === "hit");
      expect(hits.length > 0, type).toBe(expectHit);
    }
  });

  it("mortar splash never hits flyers passing overhead", () => {
    const lane = createLane();
    setTowers(lane, [{ id: "m", type: "plasma", gridX: 1, gridY: 2, level: 1 }]);
    const flyer = creeps([{ type: "sky_skimmer", count: 1 }], { spawnAt: 0, hp: 100000 })[0];
    const walker = creeps([{ type: "armored_squad", count: 1 }], { spawnAt: 0, hp: 100000 })[0];
    addCreeps(lane, [{ ...flyer, id: 1 }, { ...walker, id: 2 }]);
    const hits = run(lane, 4000).filter((e) => e.type === "hit");
    expect(hits.some((h) => h.creepId === 2)).toBe(true);
    expect(hits.some((h) => h.creepId === 1)).toBe(false);
  });

  it("ground creeps still use the corridor", () => {
    expect(GROUND_ROUTE.length).toBe(PATH_LENGTH_PX);
  });
});

describe("creep abilities", () => {
  it("Nanite Mender repairs damaged creeps near it", () => {
    const lane = createLane();
    const [mender] = creeps([{ type: "nanite_mender", count: 1 }], { spawnAt: 0 });
    const [mech] = creeps([{ type: "armored_squad", count: 1 }], { spawnAt: 0 });
    addCreeps(lane, [{ ...mender, id: 1 }, { ...mech, id: 2 }]);
    run(lane, 100);
    const target = lane.creeps.find((c) => c.id === 2);
    target.hp = 100;
    const events = run(lane, 1000);
    expect(target.hp).toBeGreaterThan(100 + CREEP_RAIDS.nanite_mender.healAura.hpPerSec * 0.9);
    expect(target.hp).toBeLessThanOrEqual(target.maxHp);
    expect(events.some((e) => e.type === "heal")).toBe(true);
  });

  it("Signal Jammer makes turrets in range fire 40% slower", () => {
    const shots = (withJammer) => {
      const lane = createLane();
      setTowers(lane, [{ id: "g", type: "gatling", gridX: 1, gridY: 0, level: 1 }]);
      const list = [{ ...creeps([{ type: "armored_squad", count: 1 }], { spawnAt: 0, hp: 1e9 })[0], id: 1 }];
      if (withJammer) list.push({ ...creeps([{ type: "signal_jammer", count: 1 }], { spawnAt: 0, hp: 1e9 })[0], id: 2 });
      addCreeps(lane, list);
      return run(lane, 3000).filter((e) => e.type === "fire").length;
    };
    const normal = shots(false);
    const jammed = shots(true);
    expect(jammed).toBeLessThan(normal * 0.75);
    expect(jammed).toBeGreaterThan(normal * 0.45);
  });

  it("Warden Titan's EMP pulse stuns nearby turrets", () => {
    const lane = createLane();
    setTowers(lane, [
      { id: "near", type: "gatling", gridX: 1, gridY: 0, level: 1 },
      { id: "far", type: "gatling", gridX: 9, gridY: 0, level: 1 },
    ]);
    addCreeps(lane, creeps([{ type: "warden_titan", count: 1 }], { spawnAt: 0, hp: 1e9 }));
    const events = run(lane, BOSS_SUMMONS.warden_titan.empPulse.everyMs + 50);
    const pulse = events.find((e) => e.type === "pulse");
    expect(pulse).toBeDefined();
    expect(pulse.towerIds).toContain("near");
    expect(pulse.towerIds).not.toContain("far");
    expect(isTowerStunned(lane, "near")).toBe(true);
    run(lane, BOSS_SUMMONS.warden_titan.empPulse.stunMs + 50);
    expect(isTowerStunned(lane, "near")).toBe(false);
  });

  it("Storm Leviathan is a flying boss", () => {
    expect(BOSS_SUMMONS.storm_leviathan.flying).toBe(true);
    expect(BOSS_SUMMONS.storm_leviathan.isBoss).toBe(true);
  });
});
