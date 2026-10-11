import { describe, expect, it } from "vitest";
import {
  creepLevel,
  scaleCreep,
  towerDamage,
  towerRange,
  upgradeCost,
  sellRefund,
  waveClearBonus,
} from "../../src/shared/balance.js";
import { TOWERS, CREEP_RAIDS, BOSS_SUMMONS } from "../../src/shared/config/index.js";

// Characterization tests: these pin the formulas the original game used,
// so the refactor cannot silently change balance.
describe("creep scaling", () => {
  it("levels regular creeps every 2 waves and bosses every 4", () => {
    expect([1, 2, 3, 4, 5].map((w) => creepLevel(w, false))).toEqual([1, 1, 2, 2, 3]);
    expect([1, 4, 5, 8, 9].map((w) => creepLevel(w, true))).toEqual([1, 1, 2, 2, 3]);
  });

  it("treats wave 0 as wave 1 and caps at level 100", () => {
    expect(creepLevel(0, false)).toBe(1);
    expect(creepLevel(10_000, false)).toBe(100);
  });

  it("scales hp +25% per level and bounty +20% per level", () => {
    const scout = scaleCreep(CREEP_RAIDS.scout_rush, 5); // level 3
    expect(scout).toEqual({ level: 3, hp: 90, bounty: 14, leakDamage: 4 });
  });

  it("scales bosses +35% hp per level and keeps their leak damage", () => {
    const boss = scaleCreep(BOSS_SUMMONS.cyber_behemoth, 8); // level 2
    expect(boss).toEqual({ level: 2, hp: 3240, bounty: 216, leakDamage: 25 });
  });
});

describe("tower formulas", () => {
  const gatling = TOWERS.gatling;

  it("matches the original damage and range scaling", () => {
    expect(towerDamage(gatling, 1)).toBe(16);
    expect(towerDamage(gatling, 3)).toBe(27);
    expect(towerRange(gatling, 1)).toBe(125);
    expect(towerRange(gatling, 2)).toBeCloseTo(140);
  });

  it("matches the original upgrade cost and sell refund", () => {
    expect(upgradeCost(gatling, 1)).toBe(80);
    expect(upgradeCost(gatling, 4)).toBe(320);
    expect(sellRefund(gatling, 1)).toBe(70);
    expect(sellRefund(TOWERS.railgun, 2)).toBe(560);
  });

  it("can never be sold for more than was spent on it", () => {
    for (const def of Object.values(TOWERS)) {
      let spent = def.cost;
      for (let level = 1; level < 100; level++) {
        expect(sellRefund(def, level)).toBeLessThanOrEqual(spent);
        spent += upgradeCost(def, level);
      }
    }
  });
});

describe("economy", () => {
  it("pays 50 + 10 per wave as the wave bonus", () => {
    expect(waveClearBonus(1)).toBe(60);
    expect(waveClearBonus(8)).toBe(130);
  });
});
