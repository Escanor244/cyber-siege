import { describe, expect, it } from "vitest";
import {
  applyAction,
  applyLaneReports,
  advanceClock,
  endMatch,
  forfeit,
  returnToLobby,
} from "../../src/shared/rules/reducer.js";
import { publicView } from "../../src/shared/rules/state.js";
import { STARTING_GOLD, STARTING_INCOME, waveClearBonus } from "../../src/shared/index.js";
import { playingMatch } from "../helpers/match.js";

describe("actions", () => {
  it("builds, upgrades and sells a tower with correct gold", () => {
    const { match, a } = playingMatch({ gold: 1000 });
    const built = applyAction(match, "pA", { type: "build", towerType: "gatling", gx: 0, gy: 0 });
    expect(built.ok).toBe(true);
    expect(a.gold).toBe(900);
    const id = a.towers[0].id;

    expect(applyAction(match, "pA", { type: "upgrade", towerId: id }).ok).toBe(true);
    expect(a.gold).toBe(820);
    expect(a.towers[0].level).toBe(2);

    const sold = applyAction(match, "pA", { type: "sell", towerId: id });
    expect(sold.events[0]).toMatchObject({ op: "sold", refund: 140 });
    expect(a.gold).toBe(960);
    expect(a.towers).toHaveLength(0);
  });

  it("rejects building on the path or on an occupied cell", () => {
    const { match, a } = playingMatch({ gold: 1000 });
    expect(applyAction(match, "pA", { type: "build", towerType: "gatling", gx: 3, gy: 1 })).toMatchObject({ ok: false });
    applyAction(match, "pA", { type: "build", towerType: "gatling", gx: 0, gy: 0 });
    expect(applyAction(match, "pA", { type: "build", towerType: "cryo", gx: 0, gy: 0 }).reason).toBe("Cell occupied");
    expect(a.towers).toHaveLength(1);
    expect(a.gold).toBe(900);
  });

  it("sending a raid issues creeps onto the opponent's lane", () => {
    const { match, a, b } = playingMatch({ gold: 1000 });
    const res = applyAction(match, "pA", { type: "send-raid", creepType: "scout_rush" });
    expect(res.ok).toBe(true);
    const ev = res.events[0];
    expect(ev).toMatchObject({ type: "creeps-issued", laneId: b.id, senderId: a.id, source: "raid", senderGold: 950 });
    expect(ev.entries).toHaveLength(3);
    expect(a.stats.creepsSent).toBe(3);
  });

  it("EMP stuns at most 2 enemy towers, chosen by the seeded rng", () => {
    const run = (seed) => {
      const { match, b } = playingMatch({ gold: 1000, seed });
      b.towers = [0, 2, 4, 6].map((x, i) => ({ id: `t${i}`, type: "gatling", gridX: x, gridY: 0, level: 1 }));
      return applyAction(match, "pA", { type: "cast", spellId: "emp_freeze" }).events[0];
    };
    const ev = run(7);
    expect(ev.towerIds).toHaveLength(2);
    expect(new Set(ev.towerIds).size).toBe(2);
    expect(run(7).towerIds).toEqual(ev.towerIds); // deterministic
  });

  it("enforces spell cooldowns on the server", () => {
    const { match } = playingMatch({ gold: 5000 });
    expect(applyAction(match, "pA", { type: "cast", spellId: "frenzy_rush" }).ok).toBe(true);
    expect(applyAction(match, "pA", { type: "cast", spellId: "frenzy_rush" }).ok).toBe(false);
    advanceClock(match, 40_000);
    expect(applyAction(match, "pA", { type: "cast", spellId: "frenzy_rush" }).ok).toBe(true);
  });

  it("orbital strike removes exactly one enemy tower", () => {
    const { match, b } = playingMatch({ gold: 1000 });
    b.towers = [{ id: "t9", type: "railgun", gridX: 0, gridY: 0, level: 3 }];
    const ev = applyAction(match, "pA", { type: "cast", spellId: "orbital_nuke" }).events[0];
    expect(ev.destroyedTower.id).toBe("t9");
    expect(b.towers).toHaveLength(0);
  });

  it("gold never goes negative", () => {
    const { match, a } = playingMatch({ gold: 120 });
    for (let i = 0; i < 5; i++) applyAction(match, "pA", { type: "build", towerType: "gatling", gx: i, gy: 0 });
    expect(a.gold).toBe(20);
    expect(a.towers).toHaveLength(1);
  });
});

describe("clock", () => {
  it("pays income every 2s and a wave bonus with each wave", () => {
    const { match, a } = playingMatch();
    advanceClock(match, 22_000);
    expect(match.wave).toBe(1);
    expect(a.gold).toBe(STARTING_GOLD + 11 * STARTING_INCOME + waveClearBonus(1));
  });

  it("issues each natural wave onto both lanes", () => {
    const { match } = playingMatch();
    const events = advanceClock(match, 22_000);
    const issued = events.filter((e) => e.type === "creeps-issued");
    expect(issued.map((e) => e.laneId).sort()).toEqual(["pA", "pB"]);
    expect(issued[0].entries).toHaveLength(3);
  });

  it("does nothing while paused or after the match", () => {
    const { match, a } = playingMatch();
    match.pause = { byPlayerId: "pB", forfeitAt: 0 };
    advanceClock(match, 10_000);
    expect(match.matchMs).toBe(0);
    match.pause = null;
    forfeit(match, "pB");
    advanceClock(match, 10_000);
    expect(match.matchMs).toBe(0);
    expect(a.gold).toBe(STARTING_GOLD);
  });

  it("auto-leaks creeps the owner never reports (background-tab exploit)", () => {
    const { match, a } = playingMatch();
    advanceClock(match, 22_000); // wave 1: 3 scouts on each lane
    const events = advanceClock(match, 60_000);
    const resolved = events.filter((e) => e.type === "creeps-resolved" && e.laneId === "pA");
    expect(resolved.flatMap((e) => e.items).every(([, outcome]) => outcome === "x")).toBe(true);
    expect(a.hp).toBe(100 - 3 * 4);
  });
});

describe("lane reports", () => {
  function waveOne() {
    const ctx = playingMatch();
    const events = advanceClock(ctx.match, 22_000);
    const mine = events.find((e) => e.type === "creeps-issued" && e.laneId === "pA").entries;
    advanceClock(ctx.match, 5_000);
    return { ...ctx, mine };
  }

  it("pays the bounty exactly once per creep", () => {
    const { match, a, mine } = waveOne();
    const before = a.gold;
    applyLaneReports(match, "pA", { killed: [mine[0].id, mine[0].id] });
    applyLaneReports(match, "pA", { killed: [mine[0].id] });
    expect(a.gold).toBe(before + mine[0].bounty);
    expect(a.stats.kills).toBe(1);
  });

  it("ignores reports for the other lane and unknown ids", () => {
    const { match, b, mine } = waveOne();
    const before = b.gold;
    applyLaneReports(match, "pB", { killed: [mine[0].id, 99999] });
    expect(b.gold).toBe(before);
  });

  it("applies leak damage from the ledger, once", () => {
    const { match, a, mine } = waveOne();
    applyLaneReports(match, "pA", { leaked: [mine[1].id, mine[1].id] });
    expect(a.hp).toBe(96);
    expect(a.stats.leaksTaken).toBe(1);
  });

  it("ends the match when a core reaches 0 and the result is final", () => {
    const { match, a, b, mine } = waveOne();
    a.hp = 4;
    const events = applyLaneReports(match, "pA", { leaked: [mine[0].id] });
    expect(events.at(-1)).toMatchObject({ type: "game-over", winnerId: "pB", loserId: "pA", reason: "core" });
    // Later leaks on the winner's lane cannot flip the result
    b.hp = 1;
    applyLaneReports(match, "pB", { leaked: [1, 2, 3, 4, 5, 6] });
    expect(endMatch(match, { winnerId: "pA", loserId: "pB", reason: "core" })).toEqual([]);
    expect(match.winnerId).toBe("pB");
  });
});

describe("views and lobby", () => {
  it("never exposes resume tokens or connection ids", () => {
    const { match, a } = playingMatch();
    a.token = "secret-token";
    a.connId = "conn-1";
    const json = JSON.stringify(publicView(match));
    expect(json).not.toContain("secret-token");
    expect(json).not.toContain("conn-1");
    expect(json).not.toContain("rngState");
  });

  it("returnToLobby resets players and clears the board", () => {
    const { match, a } = playingMatch({ gold: 999 });
    applyAction(match, "pA", { type: "build", towerType: "gatling", gx: 0, gy: 0 });
    forfeit(match, "pB");
    returnToLobby(match);
    expect(match.phase).toBe("lobby");
    expect(a.towers).toEqual([]);
    expect(a.gold).toBe(STARTING_GOLD);
  });
});
