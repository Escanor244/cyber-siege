import { describe, expect, it } from "vitest";
import {
  createLedger,
  issueCreeps,
  resolveReport,
  expireOverdue,
  creepDeadline,
  worstCaseTravelMs,
  openCount,
} from "../../src/shared/rules/ledger.js";
import { CREEP_RAIDS, BOSS_SUMMONS, SPAWN_LEAD_MS, SPAWN_STAGGER_MS, SLOW_FLOOR } from "../../src/shared/config/index.js";

describe("ledger", () => {
  it("issues one entry per individual creep with staggered spawn times", () => {
    const ledger = createLedger();
    const entries = issueCreeps(ledger, {
      laneId: "pA",
      groups: [{ type: "scout_rush", count: 2 }],
      waveNumber: 1,
      source: "wave",
      nowMs: 10_000,
    });
    expect(entries).toHaveLength(6);
    expect(entries.map((e) => e.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(entries[0].spawnAt).toBe(10_000 + SPAWN_LEAD_MS);
    expect(entries[5].spawnAt).toBe(10_000 + SPAWN_LEAD_MS + 5 * SPAWN_STAGGER_MS);
    expect(openCount(ledger, "pA")).toBe(6);
  });

  it("skips unknown creep types", () => {
    const ledger = createLedger();
    const entries = issueCreeps(ledger, { laneId: "pA", groups: [{ type: "bogus", count: 3 }], waveNumber: 1, source: "wave", nowMs: 0 });
    expect(entries).toEqual([]);
  });

  it("resolves an id exactly once, only for its own lane, never before it spawns", () => {
    const ledger = createLedger();
    const [e] = issueCreeps(ledger, { laneId: "pA", groups: [{ type: "armored_squad", count: 1 }], waveNumber: 1, source: "raid", senderId: "pB", nowMs: 20_000 });
    expect(resolveReport(ledger, { laneId: "pB", id: e.id, nowMs: 30_000 })).toBeNull(); // wrong lane
    expect(resolveReport(ledger, { laneId: "pA", id: e.id, nowMs: 10_000 })).toBeNull(); // far too early
    expect(resolveReport(ledger, { laneId: "pA", id: e.id, nowMs: 30_000 })).toBe(e);
    expect(resolveReport(ledger, { laneId: "pA", id: e.id, nowMs: 30_000 })).toBeNull(); // duplicate
    expect(resolveReport(ledger, { laneId: "pA", id: 999, nowMs: 30_000 })).toBeNull(); // unknown
  });

  it("expires creeps once their deadline passes", () => {
    const ledger = createLedger();
    const [e] = issueCreeps(ledger, { laneId: "pA", groups: [{ type: "cyber_behemoth", count: 1 }], waveNumber: 1, source: "wave", nowMs: 0 });
    expect(expireOverdue(ledger, e.deadline - 1)).toEqual([]);
    expect(expireOverdue(ledger, e.deadline)).toEqual([e]);
    expect(openCount(ledger, "pA")).toBe(0);
  });

  it("gives every creep enough time to cross the path at maximum slow", () => {
    for (const def of [...Object.values(CREEP_RAIDS), ...Object.values(BOSS_SUMMONS)]) {
      const travel = worstCaseTravelMs(def);
      expect(creepDeadline(def, 0)).toBeGreaterThan(travel + 2000);
    }
    expect(SLOW_FLOOR).toBeCloseTo(0.55);
    // Behemoth: 1248px at 39px/s * 0.55 = ~58.2s worst case
    expect(worstCaseTravelMs(BOSS_SUMMONS.cyber_behemoth) / 1000).toBeCloseTo(58.18, 1);
  });
});
