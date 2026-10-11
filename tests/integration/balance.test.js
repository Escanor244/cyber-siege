import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalRoom } from "../../src/net/localRoom.js";
import { createClientStore } from "../../src/net/clientStore.js";
import { LaneController } from "../../src/game/LaneController.js";
import { TOWERS } from "../../src/shared/config/towers.js";
import { useFakeClock, advance, until, timers, now } from "../helpers/clients.js";

// A fixed, reasonable human strategy: fill good tiles near the path with a
// mix of turrets, buy income early, send a raid when rich.
const BUILD_ORDER = [
  ["gatling", 1, 0], ["gatling", 3, 2], ["cryo", 5, 2], ["plasma", 3, 4],
  ["gatling", 1, 5], ["tesla", 4, 5], ["railgun", 6, 4], ["gatling", 8, 5],
  ["plasma", 6, 2], ["tesla", 1, 2], ["railgun", 8, 7], ["cryo", 4, 7],
];

const LIMIT_MS = 15 * 60_000;

async function survivalTime(difficulty, seed) {
  const local = createLocalRoom({ difficulty, seed, timers, now });
  const store = createClientStore({ transport: local.humanTransport, intent: "create", name: "Baseline", now });
  const lane = new LaneController({ store, now, snapshotEveryMs: 0 });
  const laneLoop = setInterval(() => lane.update(), 50);
  await until(() => store.getState().status === "online");
  local.startBot();
  await until(() => store.getState().view?.players.length === 2);
  store.start();
  await until(() => store.getState().view?.phase === "playing");

  let step = 0;
  let ecoBought = 0;
  const brain = setInterval(() => {
    const me = store.me();
    if (!me || store.getState().view.phase !== "playing") return;
    const next = BUILD_ORDER[step];
    if (next && me.gold >= TOWERS[next[0]].cost) {
      store.build(next[0], next[1], next[2]);
      step++;
    } else if (ecoBought < 2 && me.gold >= 80 && step >= 2) {
      store.buyEco("solar_core");
      ecoBought++;
    } else if (!next && me.gold >= 300) {
      // out of build slots: upgrade the cheapest turret
      const t = [...me.towers].sort((a, b) => a.level - b.level)[0];
      if (t) store.upgrade(t.id);
    }
  }, 1500);

  let elapsed = 0;
  while (store.getState().view.phase === "playing" && elapsed < LIMIT_MS) {
    await advance(10_000);
    elapsed += 10_000;
  }
  const view = store.getState().view;
  const hp = view.players.find((p) => p.id === store.getState().playerId)?.hp ?? 0;
  const result = { matchMs: view.matchMs, hp, humanWon: view.winnerId === store.getState().playerId, ended: view.phase === "game_over" };
  clearInterval(brain);
  clearInterval(laneLoop);
  lane.destroy();
  local.destroy();
  return result;
}

beforeEach(() => useFakeClock());
afterEach(() => vi.useRealTimers());

describe("AI difficulty is ordered", () => {
  it("a fixed player is pressured least by Easy and most by Hard", async () => {
    const seeds = [11, 22, 33];
    const score = {};
    const results = [];
    for (const difficulty of ["easy", "normal", "hard"]) {
      let total = 0;
      for (const seed of seeds) {
        const r = await survivalTime(difficulty, seed);
        // Pressure the bot put on the player: core damage taken if the player won,
        // otherwise 100 plus how quickly the bot broke through.
        total += r.humanWon ? 100 - r.hp : 100 + (100 * (LIMIT_MS - r.matchMs)) / LIMIT_MS;
        results.push(`${difficulty}#${seed}: ${r.humanWon ? "player won" : "bot won"} at ${Math.round(r.matchMs / 1000)}s, player hp ${r.hp}`);
      }
      score[difficulty] = total / seeds.length;
    }
    console.log(results.join("\n"));
    console.log("average pressure (0-100 = player won, damage taken; >100 = bot won):", score);
    expect(score.normal).toBeGreaterThan(score.easy);
    expect(score.hard).toBeGreaterThan(score.normal);
  }, 240_000);
});
