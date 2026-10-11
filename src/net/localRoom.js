// Solo mode: the real RoomCore running in the browser, with the human and the
// bot as two in-memory connections. The UI talks to `humanTransport` exactly as
// it talks to the Cloudflare socket in multiplayer.

import { createMemoryRoom, defaultTimers } from "./memoryRoom.js";
import { createBotClient } from "./botClient.js";

export function createLocalRoom({
  difficulty = "normal",
  seed = (Math.random() * 2 ** 32) >>> 0,
  timers = defaultTimers,
  now = () => performance.now(),
} = {}) {
  const room = createMemoryRoom({ roomId: "SOLO", mode: "solo", seed, timers, now });
  const humanTransport = room.connect("human");
  const suspendReasons = new Set();
  let bot = null;

  return {
    get core() {
      return room.core;
    },
    humanTransport,
    // The bot joins once the human has created the room.
    startBot() {
      if (bot) return bot;
      bot = createBotClient({ transport: room.connect("bot"), difficulty, seed: seed ^ 0x5bd1e995, timers, now });
      return bot;
    },
    get bot() {
      return bot;
    },
    // Several things can pause solo (hidden tab, open menu); run only when none do.
    setSuspended(reason, on) {
      if (on) suspendReasons.add(reason);
      else suspendReasons.delete(reason);
      room.core.setSuspended(suspendReasons.size > 0);
    },
    destroy() {
      bot?.destroy();
      room.stop();
    },
  };
}
