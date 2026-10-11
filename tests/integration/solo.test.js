import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalRoom } from "../../src/net/localRoom.js";
import { createClientStore } from "../../src/net/clientStore.js";
import { LaneController } from "../../src/game/LaneController.js";
import { useFakeClock, advance, timers, now } from "../helpers/clients.js";

let local;

beforeEach(() => useFakeClock());
afterEach(() => {
  local?.destroy();
  vi.useRealTimers();
});

async function soloMatch(difficulty = "normal") {
  local = createLocalRoom({ difficulty, seed: 777, timers, now });
  const store = createClientStore({ transport: local.humanTransport, intent: "create", name: "Viper", now });
  const lane = new LaneController({ store, now, snapshotEveryMs: 0 });
  const loop = setInterval(() => lane.update(), 50);
  await advance(100);
  local.startBot();
  await advance(300);
  store.start();
  await advance(300);
  return { store, lane, stop: () => clearInterval(loop) };
}

describe("solo mode runs on the same room engine", () => {
  it("the bot joins, builds, attacks and the human sees its lane via snapshots", async () => {
    const { store } = await soloMatch();
    let snaps = 0;
    store.on("snap", () => snaps++);
    const issuedToMe = [];
    store.on("issued", (m) => m.laneId === store.getState().playerId && m.source === "raid" && issuedToMe.push(m));

    expect(store.getState().view.phase).toBe("playing");
    expect(store.opponent().isBot).toBe(true);

    await advance(90_000);
    const bot = store.opponent();
    expect(bot.towers.length).toBeGreaterThan(0);
    expect(issuedToMe.length).toBeGreaterThan(0);
    expect(snaps).toBeGreaterThan(10);
  });

  it("an undefended human eventually loses, and the result cannot flip afterwards", async () => {
    const { store } = await soloMatch("hard");
    for (let i = 0; i < 30 && store.getState().view.phase === "playing"; i++) await advance(30_000);
    const v = store.getState().view;
    expect(v.phase).toBe("game_over");
    expect(v.winnerId).toBe(store.opponent().id);
    const decided = v.winnerId;
    await advance(60_000);
    expect(store.getState().view.winnerId).toBe(decided);
    expect(store.me().stats.leaksTaken).toBeGreaterThan(0);
  }, 30_000);

  it("solo rematch starts a fresh match immediately", async () => {
    const { store } = await soloMatch();
    local.core.match.players[0].hp = 1;
    for (let i = 0; i < 10 && store.getState().view.phase === "playing"; i++) await advance(15_000);
    expect(store.getState().view.phase).toBe("game_over");
    store.restart();
    await advance(500);
    expect(store.getState().view.phase).toBe("playing");
    expect(store.me().hp).toBe(100);
    expect(store.me().towers).toEqual([]);
  });

  it("pausing for a hidden tab freezes the solo clock", async () => {
    await soloMatch();
    await advance(5_000);
    local.setSuspended("hidden", true);
    const t = local.core.match.matchMs;
    await advance(60_000);
    expect(local.core.match.matchMs).toBe(t);
    local.setSuspended("hidden", false);
    await advance(2_000);
    expect(local.core.match.matchMs).toBeGreaterThan(t);
  });
});
