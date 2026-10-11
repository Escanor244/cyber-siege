import { vi } from "vitest";
import { createClientStore } from "../../src/net/clientStore.js";
import { LaneController } from "../../src/game/LaneController.js";

export const timers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

export const now = () => Date.now();

export function useFakeClock() {
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"] });
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
}

export const advance = (ms) => vi.advanceTimersByTimeAsync(ms);

// Advance simulated time until `cond()` holds (fails loudly if it never does).
export async function until(cond, maxMs = 10_000, stepMs = 50) {
  for (let waited = 0; waited <= maxMs; waited += stepMs) {
    if (cond()) return;
    await advance(stepMs);
  }
  throw new Error(`condition not met within ${maxMs}ms`);
}

// A headless player: store + own-lane simulation driven at ~20 fps, like a browser tab.
export function joinAs(room, { intent, name, tokenBox = { token: null }, simulate = true }) {
  const transport = room.connect();
  const store = createClientStore({
    transport,
    intent,
    name,
    loadToken: () => tokenBox.token,
    saveToken: (t) => (tokenBox.token = t),
    now,
  });
  const lane = new LaneController({ store, now, snapshotEveryMs: 200 });
  const seen = { issued: [], resolved: [], toasts: [], snaps: 0 };
  store.on("issued", (m) => seen.issued.push(m));
  store.on("resolved", (m) => seen.resolved.push(m));
  store.on("toast", (m) => seen.toasts.push(m.text));
  store.on("snap", () => seen.snaps++);
  const client = { transport, store, lane, tokenBox, seen, running: simulate };
  client.loop = setInterval(() => {
    if (client.running) lane.update();
  }, 50);
  client.disconnect = () => {
    clearInterval(client.loop);
    lane.destroy();
    transport.close();
  };
  return client;
}

export const view = (client) => client.store.getState().view;
export const me = (client) => client.store.me();
