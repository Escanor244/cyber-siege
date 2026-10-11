import { describe, expect, it } from "vitest";
import * as V from "../../src/shared/rules/validate.js";
import { playingMatch } from "../helpers/match.js";

describe("build validation", () => {
  it("accepts a legal build", () => {
    const { match, a } = playingMatch();
    expect(V.canBuild(match, a, "gatling", 0, 0)).toEqual({ ok: true });
  });

  it.each([
    ["outside the grid", "gatling", 10, 0, "Outside the grid"],
    ["negative", "gatling", -1, 2, "Outside the grid"],
    ["fractional", "gatling", 1.5, 2, "Outside the grid"],
    ["on the path", "gatling", 3, 1, "Can't build on the path"],
    ["unknown tower", "nuke", 0, 0, "Unknown tower"],
    ["prototype key", "constructor", 0, 0, "Unknown tower"],
  ])("rejects %s", (_label, type, gx, gy, reason) => {
    const { match, a } = playingMatch();
    expect(V.canBuild(match, a, type, gx, gy)).toEqual({ ok: false, reason });
  });

  it("rejects occupied cells and insufficient gold", () => {
    const { match, a } = playingMatch();
    a.towers.push({ id: "t1", type: "gatling", gridX: 0, gridY: 0, level: 1 });
    expect(V.canBuild(match, a, "gatling", 0, 0).reason).toBe("Cell occupied");
    a.gold = 99;
    expect(V.canBuild(match, a, "gatling", 1, 0).reason).toBe("Not enough gold");
  });

  it("rejects everything outside a running match", () => {
    const { match, a } = playingMatch();
    match.phase = "game_over";
    expect(V.canBuild(match, a, "gatling", 0, 0).reason).toBe("Match is not running");
    match.phase = "playing";
    match.pause = { byPlayerId: "pB" };
    expect(V.canBuild(match, a, "gatling", 0, 0).reason).toBe("Match is paused");
    expect(V.canBuild(match, null, "gatling", 0, 0).reason).toBe("Not in this match");
  });
});

describe("tower, raid, eco and spell validation", () => {
  it("caps upgrades at max level", () => {
    const { match, a } = playingMatch({ gold: 1e9 });
    a.towers.push({ id: "t1", type: "gatling", gridX: 0, gridY: 0, level: 100 });
    expect(V.canUpgrade(match, a, "t1").reason).toBe("Max level");
    expect(V.canUpgrade(match, a, "nope").reason).toBe("Tower not found");
  });

  it("rejects unknown raids and empty spell targets", () => {
    const { match, a } = playingMatch({ gold: 5000 });
    expect(V.canSendRaid(match, a, "bogus").reason).toBe("Unknown unit");
    expect(V.canSendRaid(match, a, "scout_rush").ok).toBe(true);
    expect(V.canCast(match, a, "orbital_nuke").reason).toBe("Enemy has no turrets");
    expect(V.canCast(match, a, "frenzy_rush").ok).toBe(true);
    expect(V.canBuyEco(match, a, "solar_core").ok).toBe(true);
    expect(V.canBuyEco(match, a, "free_money").reason).toBe("Unknown upgrade");
  });

  it("enforces spell cooldowns from match time", () => {
    const { match, a } = playingMatch({ gold: 5000 });
    a.cooldowns.frenzy_rush = 40_000;
    match.matchMs = 30_000;
    expect(V.canCast(match, a, "frenzy_rush").reason).toBe("On cooldown (10s)");
    match.matchMs = 40_000;
    expect(V.canCast(match, a, "frenzy_rush").ok).toBe(true);
  });

  it("validates targeting modes", () => {
    const { match, a } = playingMatch();
    a.towers.push({ id: "t1", type: "gatling", gridX: 0, gridY: 0, level: 1 });
    expect(V.canSetTarget(match, a, "t1", "strongest").ok).toBe(true);
    expect(V.canSetTarget(match, a, "t1", "random").reason).toBe("Unknown targeting mode");
  });
});
