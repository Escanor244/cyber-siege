import { describe, expect, it } from "vitest";
import { damageMultiplier, matchups } from "../../src/shared/sim/damage.js";
import { createLane, addCreeps, setTowers, stepLane, drainEvents } from "../../src/shared/sim/lane.js";
import { decideBotActions, pickCounterRaid, DIFFICULTIES } from "../../src/shared/bot/brain.js";
import { createLedger, issueCreeps } from "../../src/shared/rules/ledger.js";
import { applyAction } from "../../src/shared/rules/reducer.js";
import { publicView } from "../../src/shared/rules/state.js";
import { createRng } from "../../src/shared/rng.js";
import { TOWERS, CREEP_RAIDS, BOSS_SUMMONS } from "../../src/shared/config/index.js";
import { playingMatch } from "../helpers/match.js";

describe("damage types", () => {
  it("makes every tower description true", () => {
    expect(damageMultiplier("kinetic", "light")).toBeGreaterThan(1); // gatling: anti-light
    expect(damageMultiplier("kinetic", "heavy")).toBeLessThan(1); // mechs soak bullets
    expect(damageMultiplier("energy", "shielded")).toBeGreaterThan(1); // tesla breaks shields
    expect(damageMultiplier("pierce", "boss")).toBeGreaterThan(1); // railgun: boss destroyer
    expect(damageMultiplier("unknown", "light")).toBe(1);
  });

  it("gives every tower a strength and every armor a counter", () => {
    for (const t of Object.values(TOWERS)) expect(TOWERS[t.id].damageType).toBeTruthy();
    const armors = new Set([...Object.values(CREEP_RAIDS), ...Object.values(BOSS_SUMMONS)].map((c) => c.armor));
    for (const armor of armors) {
      const counters = Object.values(TOWERS).filter((t) => matchups(t.damageType).strong.includes(armor));
      expect(counters.length, armor).toBeGreaterThan(0);
    }
  });
});

describe("aegis shield aura", () => {
  function hitAmounts(withAegis) {
    const lane = createLane();
    setTowers(lane, [{ id: "g", type: "gatling", gridX: 1, gridY: 0, level: 1 }]);
    const ledger = createLedger();
    const groups = [{ type: "armored_squad", count: 1 }];
    if (withAegis) groups.push({ type: "aegis_vanguard", count: 1 });
    const entries = issueCreeps(ledger, { laneId: "L", groups, waveNumber: 1, source: "wave", nowMs: 0 }).map((e) => ({ ...e, spawnAt: 0 }));
    addCreeps(lane, entries);
    const mech = entries[0].id;
    const hits = [];
    for (let i = 0; i < 400 && hits.length < 3; i++) {
      stepLane(lane);
      for (const e of drainEvents(lane)) if (e.type === "hit" && e.creepId === mech) hits.push(e.amount);
    }
    return hits;
  }

  it("reduces damage to creeps near an Aegis Vanguard by 30%", () => {
    const plain = hitAmounts(false)[0]; // 16 * 0.7 (kinetic vs heavy) = 11
    const shielded = hitAmounts(true)[0]; // 11 * 0.7 = 8
    expect(plain).toBe(11);
    expect(shielded).toBe(8);
  });
});

describe("bot", () => {
  it("counter-picks raids against the enemy's turret types", () => {
    const rng = createRng(1).holder;
    const gatlings = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, type: "gatling" }));
    const picks = Array.from({ length: 40 }, () => pickCounterRaid(Object.keys(CREEP_RAIDS), gatlings, rng));
    const heavy = picks.filter((p) => CREEP_RAIDS[p].armor === "heavy").length;
    expect(heavy).toBeGreaterThan(24); // heavy armor (mechs, jammers) resists kinetic
  });

  it("never sends an action the room would reject (randomised states)", () => {
    const rng = createRng(2024).holder;
    for (let i = 0; i < 1500; i++) {
      const { match, b } = playingMatch({ seed: i, gold: Math.floor(Math.random() * 3000) });
      match.matchMs = Math.floor(Math.random() * 400_000);
      match.wave = Math.floor(match.matchMs / 22_000);
      // random existing defenses
      for (let t = 0; t < Math.floor(Math.random() * 10); t++) {
        applyAction(match, b.id, { type: "build", towerType: "gatling", gx: Math.floor(Math.random() * 10), gy: Math.floor(Math.random() * 8) });
      }
      b.gold = Math.floor(Math.random() * 3000);
      const difficulty = ["easy", "normal", "hard"][i % 3];
      const actions = decideBotActions(publicView(match), b.id, rng, difficulty);
      for (const action of actions) {
        const result = applyAction(match, b.id, action);
        expect(result.ok, `${difficulty} ${JSON.stringify(action)} -> ${result.reason}`).toBe(true);
      }
    }
  });

  it("hard bots think faster and build more than easy bots", () => {
    expect(DIFFICULTIES.hard.thinkMs).toBeLessThan(DIFFICULTIES.normal.thinkMs);
    expect(DIFFICULTIES.normal.thinkMs).toBeLessThan(DIFFICULTIES.easy.thinkMs);
    expect(DIFFICULTIES.hard.maxTowers).toBeGreaterThan(DIFFICULTIES.easy.maxTowers);
  });
});
