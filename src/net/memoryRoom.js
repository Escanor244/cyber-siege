// An in-memory "server + network" around RoomCore. Solo mode uses it in the
// browser; the integration tests use it to run full multiplayer matches with
// simulated latency.

import { RoomCore } from "../shared/room/RoomCore.js";
import { TICK_MS } from "../shared/config/rules.js";

export const defaultTimers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

let idCounter = 0;
export function uniqueId(prefix) {
  idCounter += 1;
  return `${prefix}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createMemoryRoom({
  roomId = "MEM",
  mode = "multi",
  seed = 1,
  timers = defaultTimers,
  now = () => performance.now(),
  latencyMs = 0, // per direction; a function () => ms adds jitter
  snapshot = null,
  onPersist = () => {},
}) {
  const endpoints = new Map();
  let ticker = null;
  const delay = typeof latencyMs === "function" ? latencyMs : () => latencyMs;
  // Like TCP, each direction of a connection delivers in order: jitter can delay
  // a message but never lets a later one overtake it.
  const makeChannel = () => {
    let lastAt = 0;
    return (fn) => {
      const ms = delay();
      if (ms <= 0 && lastAt <= now()) {
        queueMicrotask(fn);
        return;
      }
      const at = Math.max(now() + ms, lastAt);
      lastAt = at;
      timers.setTimeout(fn, at - now());
    };
  };

  const io = {
    send: (connId, msg) => endpoints.get(connId)?.receive(msg),
    broadcast: (msg) => {
      for (const ep of endpoints.values()) ep.receive(msg);
    },
    close: (connId) => endpoints.get(connId)?.serverClose(),
    closeAll: () => {
      for (const ep of endpoints.values()) ep.serverClose();
    },
    bind: () => {},
    persist: (snap) => onPersist(snap),
    setAlarm: () => {},
    setTicker: (on) => {
      if (on && !ticker) ticker = timers.setInterval(() => room.core.tick(now()), TICK_MS);
      if (!on && ticker) {
        timers.clearInterval(ticker);
        ticker = null;
      }
    },
    newToken: () => uniqueId("tok"),
    newId: () => uniqueId("p"),
  };

  const room = {
    core: new RoomCore({ roomId, mode, io, now, seed, snapshot }),
    endpoints,

    // Opens a client connection. Returns a transport for createClientStore.
    connect(connId = uniqueId("c")) {
      const toServer = makeChannel();
      const toClient = makeChannel();
      const ep = {
        connId,
        open: true, // client side can still send
        delivering: true, // server side can still deliver to the client
        onOpen: null,
        onMessage: null,
        onClose: null,
        send(obj) {
          if (!ep.open) return;
          const raw = JSON.stringify(obj);
          toServer(() => {
            if (endpoints.get(connId) === ep) room.core.handleMessage(connId, raw);
          });
        },
        receive(obj) {
          if (!ep.delivering) return;
          const copy = JSON.parse(JSON.stringify(obj));
          toClient(() => ep.open && ep.onMessage?.(copy));
        },
        // Client closes (tab closed, network lost): the server learns about it after the
        // messages already in flight.
        close() {
          if (!ep.open) return;
          ep.open = false;
          ep.delivering = false;
          toServer(() => {
            endpoints.delete(connId);
            room.core.handleClose(connId);
          });
          ep.onClose?.();
        },
        // Server closes: messages already sent (e.g. a reject reason) still arrive first.
        serverClose() {
          if (!ep.delivering) return;
          ep.delivering = false;
          endpoints.delete(connId);
          toClient(() => {
            if (!ep.open) return;
            ep.open = false;
            ep.onClose?.();
          });
        },
      };
      endpoints.set(connId, ep);
      toClient(() => ep.onOpen?.());
      return ep;
    },

    // Simulates a Durable Object restart: a brand-new RoomCore from the last snapshot.
    restart(snap) {
      io.setTicker(false);
      room.core = new RoomCore({ roomId, mode, io, now, seed, snapshot: snap });
      room.core.reconcileConnections([...endpoints.keys()]);
      return room.core;
    },

    stop() {
      io.setTicker(false);
      for (const ep of [...endpoints.values()]) ep.serverClose();
    },
  };
  return room;
}
