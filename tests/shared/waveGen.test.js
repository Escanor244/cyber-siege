import { describe, expect, it } from "vitest";
import { getWave, waveThreat } from "../../src/shared/rules/waveGen.js";
import { findCreepDefinition, NATURAL_WAVES } from "../../src/shared/config/index.js";

describe("wave generator", () => {
  it("returns the authored waves for 1-8", () => {
    for (let n = 1; n <= 8; n++) expect(getWave(n)).toBe(NATURAL_WAVES[n - 1]);
  });

  it("makes every wave from 8 to 80 strictly harder than the one before", () => {
    let prev = waveThreat(getWave(8), 8);
    for (let n = 9; n <= 80; n++) {
      const t = waveThreat(getWave(n), n);
      expect(t, `wave ${n}`).toBeGreaterThan(prev);
      prev = t;
    }
  });

  it("only uses known creeps and stays within the lane size budget", () => {
    for (let n = 9; n <= 80; n++) {
      const wave = getWave(n);
      let individuals = 0;
      for (const e of wave.creeps) {
        const def = findCreepDefinition(e.type);
        expect(def).not.toBeNull();
        individuals += e.count * (def.count || 1);
      }
      expect(individuals).toBeLessThanOrEqual(130);
    }
  });

  it("is deterministic and has a boss every 4th generated wave", () => {
    expect(getWave(23)).toEqual(getWave(23));
    expect(getWave(12).isBossWave).toBe(true);
    expect(getWave(13).isBossWave).toBe(false);
  });
});
