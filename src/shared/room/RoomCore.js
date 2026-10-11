// Transport-agnostic match server. The Cloudflare Durable Object (party/index.js)
// and the in-browser solo room (src/net/localRoom.js) both wrap this class, so
// multiplayer and solo run identical room logic.
//
// The host environment provides `io`:
//   send(connId, msg)            send one message to one connection
//   broadcast(msg)               send to every open connection
//   close(connId, code, reason)  close one connection
//   closeAll(code, reason)
//   bind(connId, playerId)       remember which player a connection belongs to
//                                (survives Durable Object hibernation)
//   persist(snapshot | null)     save (or delete) the room snapshot
//   setAlarm(atWallMs | null)    wake the room at a wall-clock time
//   setTicker(on)                call core.tick(now) every TICK_MS while on
//   newToken()                   unguessable resume token
//   newId()                      unique player id

import {
  PROTOCOL_VERSION,
  TICK_MS,
  MAX_TICK_ADVANCE_MS,
  PAUSE_FORFEIT_MS,
  IDLE_DISPOSE_MS,
} from "../config/rules.js";
import { parseClientMessage, ACTION_TYPES, sanitizeName } from "../protocol.js";
import { createMatch, createPlayer, getPlayer, getOpponent, humanPlayers, publicView } from "../rules/state.js";
import {
  startMatch,
  returnToLobby,
  advanceClock,
  tickEvent,
  applyAction,
  applyLaneReports,
  forfeit,
  endMatch,
} from "../rules/reducer.js";

const SNAPSHOT_VERSION = 1;

export const OUTDATED_CLIENT_MESSAGE =
  "Cyber Siege was updated! Please refresh this page (Ctrl+Shift+R, or pull down to reload on mobile) to play.";

// Messages from the v1 client (before the overhaul) carry a sessionId and old type names.
function isLegacyClientMessage(text) {
  try {
    const m = JSON.parse(text);
    return !!m && typeof m === "object" && (m.type === "join" || "sessionId" in m);
  } catch {
    return false;
  }
}
const PERSIST_EVERY_MS = 5000;
const MIN_SNAP_INTERVAL_MS = 90;

export class RoomCore {
  constructor({ roomId, mode = "multi", io, now, seed = 1, snapshot = null }) {
    this.io = io;
    this.now = now;
    this.mode = mode;
    this.roomId = roomId;
    this.seed = seed;
    // A new epoch per instance: after a restart or hibernation wake, clients see the
    // change and request a full resync instead of trusting their old sequence numbers.
    this.epoch = io.newId();
    this.lastTickAt = null;
    this.tickCount = 0;
    this.lastPersistAt = 0;
    this.lastSnapAt = new Map();
    this.suspended = false;

    if (snapshot && snapshot.v === SNAPSHOT_VERSION) {
      this.match = snapshot.match;
      this.seq = snapshot.seq || 0;
      this.idleDisposeAt = snapshot.idleDisposeAt || null;
      // Connections did not survive a restart unless the host re-binds them
      if (this.match.phase === "playing") io.setTicker(true);
    } else {
      this.match = createMatch({ roomId, mode, seed });
      this.seq = 0;
      this.idleDisposeAt = null;
    }
  }

  // ------------------------------------------------------------------ helpers

  snapshot() {
    return { v: SNAPSHOT_VERSION, match: this.match, seq: this.seq, idleDisposeAt: this.idleDisposeAt };
  }

  persist() {
    this.lastPersistAt = this.now();
    this.io.persist(this.match.phase === "closed" ? null : this.snapshot());
  }

  broadcast(msg) {
    this.seq += 1;
    this.io.broadcast({ ...msg, seq: this.seq, epoch: this.epoch });
  }

  broadcastAll(events) {
    for (const e of events) this.broadcast(e);
  }

  stateMessage() {
    return { type: "state", seq: this.seq, epoch: this.epoch, view: publicView(this.match, this.now()) };
  }

  sendState(connId) {
    this.io.send(connId, this.stateMessage());
  }

  broadcastState() {
    this.seq += 1;
    this.io.broadcast(this.stateMessage());
  }

  playerByConn(connId) {
    return this.match.players.find((p) => p.connId === connId) || null;
  }

  reject(connId, code, reason) {
    this.io.send(connId, { type: "reject", code, reason });
    this.io.close(connId, 4000, code);
  }

  updateAlarm() {
    const times = [];
    if (this.match.pause) times.push(this.match.pause.forfeitAt);
    if (this.idleDisposeAt) times.push(this.idleDisposeAt);
    this.io.setAlarm(times.length ? Math.min(...times) : null);
  }

  refreshIdleTimer() {
    const anyoneHere = humanPlayers(this.match).some((p) => p.connected);
    if (anyoneHere || this.match.phase === "closed") {
      this.idleDisposeAt = null;
    } else if (!this.idleDisposeAt) {
      this.idleDisposeAt = this.now() + IDLE_DISPOSE_MS;
    }
    this.updateAlarm();
  }

  // -------------------------------------------------------------- connections

  // A socket opened. We don't know who it is until `hello`.
  handleOpen() {}

  // After a restart, players whose sockets did not survive are marked disconnected.
  reconcileConnections(liveConnIds) {
    const live = new Set(liveConnIds);
    for (const p of this.match.players) {
      if (!p.isBot && p.connId && !live.has(p.connId)) this.handleClose(p.connId);
    }
  }

  handleClose(connId) {
    const player = this.playerByConn(connId);
    if (!player) return;
    player.connected = false;
    player.connId = null;

    if (this.match.phase === "playing" && this.mode === "multi" && !this.match.pause) {
      this.match.pause = { byPlayerId: player.id, byName: player.name, forfeitAt: this.now() + PAUSE_FORFEIT_MS };
    }
    this.refreshIdleTimer();
    this.broadcastState();
    this.persist();
  }

  handleMessage(connId, raw) {
    const text = typeof raw === "string" ? raw : String(raw);
    const msg = parseClientMessage(text);
    if (!msg) {
      // A browser still running the previous version of the game (cached page)
      // speaks the old protocol. Tell it to refresh instead of leaving it hanging;
      // old clients show the `room-closed` reason and return to their menu.
      if (isLegacyClientMessage(text)) {
        this.io.send(connId, { type: "room-closed", reason: OUTDATED_CLIENT_MESSAGE });
        this.io.close(connId, 4000, "outdated client");
      }
      return;
    }

    if (msg.type === "hello") return this.onHello(connId, msg);
    if (msg.type === "ping") {
      this.io.send(connId, { type: "pong", t: msg.t, matchMs: this.match.matchMs });
      return;
    }

    const player = this.playerByConn(connId);
    if (!player) {
      // Unknown connection (e.g. room restarted): ask the client to say hello again
      this.io.send(connId, { type: "rehello" });
      return;
    }

    switch (msg.type) {
      case "sync":
        return this.sendState(connId);
      case "start":
        return this.onStart(player);
      case "restart":
        return this.onRestart(player);
      case "leave":
        return this.onLeave(player);
      case "lane-report":
        return this.onLaneReport(player, msg);
      case "lane-snap":
        return this.onLaneSnap(player, msg);
      default:
        if (ACTION_TYPES.has(msg.type)) return this.onAction(connId, player, msg);
    }
  }

  onHello(connId, msg) {
    if (msg.v !== PROTOCOL_VERSION) {
      return this.reject(connId, "version", "A newer version of Cyber Siege is available. Please refresh.");
    }
    const match = this.match;

    if (match.phase === "closed") {
      if (msg.intent !== "create") return this.reject(connId, "room_closed", "This battle room has ended.");
      this.match = createMatch({ roomId: this.roomId, mode: this.mode, seed: (this.seed = (this.seed * 31 + 7) >>> 0) });
      this.idleDisposeAt = null;
    }

    let player = msg.token ? this.match.players.find((p) => p.token && p.token === msg.token) : null;

    if (player) {
      // Resume: same player, new connection. An older tab for the same player is replaced.
      if (player.connId && player.connId !== connId) {
        this.io.send(player.connId, { type: "reject", code: "replaced", reason: "Opened in another tab." });
        this.io.close(player.connId, 4001, "replaced");
      }
    } else if (msg.intent === "create") {
      if (this.match.players.length > 0) {
        return this.reject(connId, "room_exists", "That room code is already in use.");
      }
      player = createPlayer({
        id: this.io.newId(),
        name: sanitizeName(msg.name, "Commander Alpha"),
        slot: "p1",
        isHost: true,
        token: this.io.newToken(),
      });
      this.match.players.push(player);
      this.match.hostId = player.id;
    } else {
      // join
      if (!this.match.hostId) return this.reject(connId, "not_found", "No battle room with that code.");
      if (this.match.phase !== "lobby") return this.reject(connId, "in_progress", "That match has already started.");
      const isBot = !!msg.bot && this.mode === "solo";
      if (this.match.players.length >= 2) return this.reject(connId, "room_full", "Battle room is full (2/2 commanders).");
      player = createPlayer({
        id: this.io.newId(),
        name: sanitizeName(msg.name, isBot ? "Vanguard AI" : "Commander Omega"),
        slot: "p2",
        isBot,
        token: this.io.newToken(),
      });
      this.match.players.push(player);
    }

    player.connId = connId;
    player.connected = true;
    this.io.bind(connId, player.id);
    this.io.send(connId, {
      type: "welcome",
      playerId: player.id,
      token: player.token,
      slot: player.slot,
      isHost: player.isHost,
      roomId: this.roomId,
    });

    // Everyone back? Resume a paused match. If the other player is now the one
    // missing, the pause (and its forfeit timer) moves to them.
    if (this.match.pause) {
      const missing = humanPlayers(this.match).find((p) => !p.connected);
      if (!missing) {
        this.match.pause = null;
        this.lastTickAt = this.now();
      } else if (this.match.pause.byPlayerId === player.id) {
        this.match.pause.byPlayerId = missing.id;
        this.match.pause.byName = missing.name;
      }
    }

    this.refreshIdleTimer();
    this.persist();
    // Full state straight to the newcomer, then a broadcast so the other side updates too.
    this.sendState(connId);
    this.broadcastState();
  }

  onStart(player) {
    const match = this.match;
    if (!player.isHost || match.phase !== "lobby") return;
    if (match.players.length < 2 || !match.players.every((p) => p.connected)) return;
    if (this.mode === "multi" && humanPlayers(match).length < 2) return;
    startMatch(match);
    this.lastTickAt = this.now();
    this.io.setTicker(true);
    this.broadcastState();
    this.persist();
  }

  onRestart(player) {
    if (!player.isHost || this.match.phase !== "game_over") return;
    if (this.mode === "solo") {
      startMatch(this.match);
      this.lastTickAt = this.now();
      this.io.setTicker(true);
    } else {
      returnToLobby(this.match);
    }
    this.broadcastState();
    this.persist();
  }

  onLeave(player) {
    const match = this.match;
    if (player.isHost) {
      if (match.phase === "playing") this.broadcastAll(forfeit(match, player.id, "left"));
      return this.dispose("The room creator has left. The room has been closed.");
    }
    if (match.phase === "playing") {
      this.broadcastAll(forfeit(match, player.id, "left"));
      this.io.setTicker(false);
    }
    const leavingConn = player.connId;
    match.players = match.players.filter((p) => p.id !== player.id);
    if (leavingConn) this.io.close(leavingConn, 1000, "left");
    this.refreshIdleTimer();
    this.broadcastState();
    this.persist();
  }

  dispose(reason) {
    this.broadcast({ type: "room-closed", reason });
    this.match.phase = "closed";
    this.match.players = [];
    this.match.hostId = null;
    this.idleDisposeAt = null;
    this.io.setTicker(false);
    this.io.setAlarm(null);
    this.io.closeAll(1000, "room closed");
    this.persist();
  }

  // ------------------------------------------------------------------ gameplay

  onAction(connId, player, msg) {
    const result = applyAction(this.match, player.id, msg);
    if (msg.reqId !== undefined) {
      this.io.send(connId, result.ok ? { type: "ack", reqId: msg.reqId } : { type: "nack", reqId: msg.reqId, reason: result.reason });
    }
    this.broadcastAll(result.events);
  }

  onLaneReport(player, msg) {
    const events = applyLaneReports(this.match, player.id, { killed: msg.killed, leaked: msg.leaked });
    this.broadcastAll(events);
    if (this.match.phase === "game_over") this.onGameOver();
  }

  onLaneSnap(player, msg) {
    if (this.match.phase !== "playing") return;
    const now = this.now();
    if (now - (this.lastSnapAt.get(player.id) || 0) < MIN_SNAP_INTERVAL_MS) return;
    this.lastSnapAt.set(player.id, now);
    const opponent = getOpponent(this.match, player.id);
    if (opponent?.connId) {
      this.io.send(opponent.connId, { type: "lane-snap", laneId: player.id, t: msg.t, c: msg.c });
    }
  }

  onGameOver() {
    this.io.setTicker(false);
    this.broadcastState();
    this.persist();
  }

  // Solo only: freeze the clock while the tab is hidden.
  setSuspended(suspended) {
    if (this.mode !== "solo") return;
    this.suspended = suspended;
    this.lastTickAt = this.now();
  }

  tick(now = this.now()) {
    const match = this.match;
    if (match.phase !== "playing") {
      this.io.setTicker(false);
      return;
    }
    const delta = this.lastTickAt === null ? 0 : Math.max(0, Math.min(MAX_TICK_ADVANCE_MS, now - this.lastTickAt));
    this.lastTickAt = now;

    if (match.pause && now >= match.pause.forfeitAt) {
      this.resolvePauseTimeout();
      return;
    }

    if (!this.suspended) {
      const events = advanceClock(match, delta);
      this.broadcastAll(events);
      if (match.phase === "game_over") return this.onGameOver();
    }

    this.tickCount += 1;
    if (this.tickCount % Math.max(1, Math.round(500 / TICK_MS)) === 0) {
      this.broadcast({ ...tickEvent(match, now), frozen: this.suspended });
    }
    if (now - this.lastPersistAt >= PERSIST_EVERY_MS) this.persist();
  }

  resolvePauseTimeout() {
    const match = this.match;
    const absent = getPlayer(match, match.pause.byPlayerId);
    const present = humanPlayers(match).filter((p) => p.connected);
    match.pause = null;
    if (present.length > 0 && absent && !absent.connected) {
      this.broadcastAll(forfeit(match, absent.id, "timeout"));
    } else {
      this.broadcastAll(endMatch(match, { winnerId: null, loserId: null, reason: "timeout" }));
    }
    this.onGameOver();
    this.refreshIdleTimer();
  }

  // Wall-clock alarm (Durable Object alarm in production)
  alarm(now = this.now()) {
    if (this.match.pause && now >= this.match.pause.forfeitAt && this.match.phase === "playing") {
      this.resolvePauseTimeout();
    }
    if (this.idleDisposeAt && now >= this.idleDisposeAt && !humanPlayers(this.match).some((p) => p.connected)) {
      this.dispose("This room was closed after 15 minutes of inactivity.");
      return;
    }
    this.updateAlarm();
  }
}
