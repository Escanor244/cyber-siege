// Client-side match store. Turns server messages into an immutable view for React
// (via useSyncExternalStore) and an event bus for one-off effects (sounds, alerts,
// lane simulation). Gold/hp/towers only ever come from the server.
//
// Works with any transport exposing: send(obj), close(), and the callbacks
// onOpen / onMessage / onClose (see socketTransport.js and localRoom.js).

import { PROTOCOL_VERSION } from "../shared/protocol.js";

let nextReqId = 1;
const NOTIFY_MS = 80; // max ~12 React updates per second

export function createClientStore({
  transport,
  intent,
  name,
  isBot = false,
  loadToken = () => null,
  saveToken = () => {},
  now = () => performance.now(),
}) {
  let state = {
    status: "connecting", // connecting | online | reconnecting | rejected | closed
    reject: null,
    closedReason: null,
    playerId: null,
    slot: null,
    isHost: intent === "create",
    roomId: null,
    view: null,
    clock: { matchMs: 0, receivedAt: now() },
    lastSeq: -1,
    epoch: null,
  };
  const listeners = new Set();
  const handlers = new Map();
  const pending = new Map(); // reqId -> action type
  let hadWelcome = false;

  // State changes apply immediately (anything reading getState() sees them), but
  // React is told at most every NOTIFY_MS. A busy fight produces dozens of server
  // messages per second; re-rendering the HUD for each one was the main cost on phones.
  let notifyTimer = null;
  function notify() {
    notifyTimer = null;
    for (const l of listeners) l();
  }
  function set(patch) {
    state = { ...state, ...patch };
    if (notifyTimer === null) notifyTimer = setTimeout(notify, NOTIFY_MS);
  }

  function emit(type, payload) {
    const set = handlers.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }

  function updatePlayers(fn) {
    if (!state.view) return;
    set({ view: { ...state.view, players: state.view.players.map((p) => fn(p) || p) } });
  }

  function patchPlayer(id, patch) {
    updatePlayers((p) => (p.id === id ? { ...p, ...patch } : null));
  }

  function send(msg) {
    transport.send(msg);
  }

  function hello() {
    send({ type: "hello", v: PROTOCOL_VERSION, intent, name, token: loadToken() || undefined, bot: isBot || undefined });
  }

  function requestSync() {
    send({ type: "sync" });
  }

  function setClock(matchMs) {
    set({ clock: { matchMs, receivedAt: now() } });
  }

  // Sequence check for broadcasts. Returns false if the message should be dropped.
  function acceptSequenced(msg) {
    if (msg.seq === undefined) return true;
    // Broadcasts that arrive before we've joined are not for us yet; the full
    // state that follows our welcome covers them.
    if (!hadWelcome || state.epoch === null) return false;
    if (msg.epoch !== state.epoch) {
      requestSync();
      return false;
    }
    if (msg.seq <= state.lastSeq) return false; // duplicate
    if (msg.seq > state.lastSeq + 1) requestSync(); // missed something: resync, still apply
    state = { ...state, lastSeq: msg.seq };
    return true;
  }

  function handle(msg) {
    if (msg.type === "state") {
      set({ view: msg.view, lastSeq: msg.seq, epoch: msg.epoch });
      setClock(msg.view.matchMs);
      emit("state", msg.view);
      return;
    }
    if (!acceptSequenced(msg)) return;

    switch (msg.type) {
      case "welcome":
        hadWelcome = true;
        saveToken(msg.token);
        set({ status: "online", playerId: msg.playerId, slot: msg.slot, isHost: msg.isHost, roomId: msg.roomId, reject: null });
        emit("welcome", msg);
        break;

      case "reject":
        set({ status: "rejected", reject: { code: msg.code, reason: msg.reason } });
        emit("reject", msg);
        transport.close();
        break;

      case "room-closed":
        set({ status: "closed", closedReason: msg.reason });
        emit("closed", msg);
        transport.close();
        break;

      case "rehello":
        // The room restarted and forgot this connection; resume with our token.
        if (hadWelcome) hello();
        break;

      case "ack":
        pending.delete(msg.reqId);
        break;

      case "nack":
        pending.delete(msg.reqId);
        emit("toast", { text: msg.reason, kind: "warn" });
        break;

      case "tick":
        if (!state.view) break;
        set({
          view: {
            ...state.view,
            matchMs: msg.matchMs,
            wave: msg.wave,
            nextWaveAtMs: msg.nextWaveAtMs,
            pause: msg.pause,
            frozen: !!msg.frozen,
            players: state.view.players.map((p) => {
              const u = msg.players.find((x) => x.id === p.id);
              return u ? { ...p, gold: u.gold, income: u.income, hp: u.hp } : p;
            }),
          },
        });
        setClock(msg.matchMs);
        break;

      case "wave":
        if (state.view) set({ view: { ...state.view, wave: msg.wave, nextWaveAtMs: msg.nextWaveAtMs } });
        emit("wave", msg);
        break;

      case "creeps-issued":
        if (msg.senderId) patchPlayer(msg.senderId, { gold: msg.senderGold, income: msg.senderIncome });
        emit("issued", msg);
        break;

      case "creeps-resolved":
        patchPlayer(msg.laneId, { hp: msg.hp, gold: msg.gold });
        emit("resolved", msg);
        break;

      case "tower":
        updatePlayers((p) => {
          if (p.id !== msg.playerId) return null;
          let towers = p.towers;
          if (msg.op === "built") towers = [...towers, msg.tower];
          else if (msg.op === "sold") towers = towers.filter((t) => t.id !== msg.towerId);
          else towers = towers.map((t) => (t.id === msg.tower.id ? msg.tower : t));
          return { ...p, towers, gold: msg.gold };
        });
        emit("tower", msg);
        break;

      case "eco":
        patchPlayer(msg.playerId, { income: msg.income, gold: msg.gold, ecoOwned: msg.ecoOwned || {} });
        emit("eco", msg);
        break;

      case "spell": {
        updatePlayers((p) => {
          if (p.id === msg.casterId) return { ...p, gold: msg.casterGold, cooldowns: { ...p.cooldowns, [msg.spellId]: msg.cooldownUntilMs } };
          if (p.id === msg.targetId && msg.destroyedTower) {
            return { ...p, towers: p.towers.filter((t) => t.id !== msg.destroyedTower.id) };
          }
          return null;
        });
        if (state.view) {
          const fx = { ...(state.view.effects?.[msg.targetId] || { frenzyUntil: 0, stuns: {} }) };
          if (msg.spellId === "frenzy_rush") fx.frenzyUntil = msg.untilMs;
          if (msg.spellId === "emp_freeze") {
            fx.stuns = { ...fx.stuns };
            for (const id of msg.towerIds) fx.stuns[id] = msg.untilMs;
          }
          set({ view: { ...state.view, effects: { ...state.view.effects, [msg.targetId]: fx } } });
        }
        emit("spell", msg);
        break;
      }

      case "game-over":
        if (state.view) {
          set({
            view: {
              ...state.view,
              phase: "game_over",
              winnerId: msg.winnerId,
              loserId: msg.loserId,
              endReason: msg.reason,
              players: state.view.players.map((p) => {
                const r = msg.players.find((x) => x.id === p.id);
                return r ? { ...p, hp: r.hp, income: r.income, stats: r.stats } : p;
              }),
            },
          });
        }
        emit("gameover", msg);
        break;

      case "lane-snap":
        emit("snap", msg);
        break;

      default:
        break;
    }
  }

  transport.onOpen = () => {
    set({ status: hadWelcome ? "reconnecting" : "connecting" });
    hello();
  };
  transport.onMessage = (msg) => {
    try {
      handle(msg);
    } catch (err) {
      console.error("[cyber-siege] failed to handle", msg?.type, err);
    }
  };
  transport.onClose = () => {
    if (state.status === "online" || state.status === "connecting") set({ status: "reconnecting" });
  };

  function action(type, payload) {
    const reqId = nextReqId++;
    pending.set(reqId, type);
    send({ type, reqId, ...payload });
  }

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      // Safe to call after destroy(): React may unsubscribe after the store is gone
      return () => handlers.get(type)?.delete(fn);
    },
    // Best estimate of the server's match clock right now.
    matchNow() {
      const v = state.view;
      if (!v || v.phase !== "playing" || v.pause || v.frozen) return state.clock.matchMs;
      return state.clock.matchMs + Math.min(1500, now() - state.clock.receivedAt);
    },
    me() {
      return state.view?.players.find((p) => p.id === state.playerId) || null;
    },
    opponent() {
      return state.view?.players.find((p) => p.id !== state.playerId) || null;
    },
    requestSync,
    start: () => send({ type: "start" }),
    restart: () => send({ type: "restart" }),
    leave: () => send({ type: "leave" }),
    build: (towerType, gx, gy) => action("build", { towerType, gx, gy }),
    upgrade: (towerId) => action("upgrade", { towerId }),
    sell: (towerId) => action("sell", { towerId }),
    setTarget: (towerId, mode) => action("set-target", { towerId, mode }),
    sendRaid: (creepType) => action("send-raid", { creepType }),
    buyEco: (ecoId) => action("eco", { ecoId }),
    cast: (spellId) => action("cast", { spellId }),
    reportLane: (killed, leaked) => send({ type: "lane-report", killed, leaked }),
    sendSnap: (snap) => send({ type: "lane-snap", t: snap.t, c: snap.c }),
    ping: () => send({ type: "ping", t: now() }),
    destroy() {
      if (notifyTimer !== null) clearTimeout(notifyTimer);
      listeners.clear();
      handlers.clear();
      transport.close();
    },
  };
}
