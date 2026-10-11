// The solo-mode opponent: a virtual client that joins the local room like a
// second player, runs its own lane simulation and acts through the protocol.

import { createClientStore } from "./clientStore.js";
import { LaneController } from "../game/LaneController.js";
import { decideBotActions, DIFFICULTIES } from "../shared/bot/brain.js";

const SEND = {
  build: (s, a) => s.build(a.towerType, a.gx, a.gy),
  upgrade: (s, a) => s.upgrade(a.towerId),
  eco: (s, a) => s.buyEco(a.ecoId),
  "send-raid": (s, a) => s.sendRaid(a.creepType),
  cast: (s, a) => s.cast(a.spellId),
};

export function createBotClient({ transport, difficulty = "normal", seed = 99, timers, now }) {
  const store = createClientStore({ transport, intent: "join", name: "Vanguard AI", isBot: true, now });
  const lane = new LaneController({ store, snapshotEveryMs: 100, now });
  const rng = { rngState: seed >>> 0 };
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  let lastThink = 0;

  const loop = timers.setInterval(() => {
    lane.update();
    const state = store.getState();
    const view = state.view;
    if (!view || view.phase !== "playing" || view.pause) return;
    const t = now();
    if (t - lastThink < cfg.thinkMs) return;
    lastThink = t;
    for (const action of decideBotActions(view, state.playerId, rng, difficulty)) {
      SEND[action.type]?.(store, action);
    }
  }, 50);

  return {
    store,
    lane,
    destroy() {
      timers.clearInterval(loop);
      lane.destroy();
      store.destroy();
    },
  };
}
