// Cyber Siege multiplayer server: a Cloudflare Durable Object (via partyserver).
// This file is only the adapter between Cloudflare and RoomCore — all room and
// game rules live in src/shared so solo mode runs exactly the same code.
import { routePartykitRequest, Server } from "partyserver";
import { RoomCore } from "../src/shared/room/RoomCore.js";
import { TICK_MS } from "../src/shared/config/rules.js";
import { hashString } from "../src/shared/rng.js";

const STORAGE_KEY = "room";

export class CyberSiegeServer extends Server {
  // Hibernation lets idle lobbies sleep for free; RoomCore persists everything it
  // needs and rebuilds itself from storage when the room wakes up.
  static options = { hibernate: true };

  ticker = null;
  core = null;

  async onStart() {
    const snapshot = (await this.ctx.storage.get(STORAGE_KEY)) || null;
    const roomId = this.name;
    this.core = new RoomCore({
      roomId,
      mode: "multi",
      io: this.createIo(),
      now: () => Date.now(),
      seed: (hashString(roomId) ^ (Math.random() * 2 ** 32)) >>> 0,
      snapshot,
    });
    // Sockets that did not survive a restart count as disconnected
    this.core.reconcileConnections([...this.getConnections()].map((c) => c.id));
  }

  createIo() {
    return {
      send: (connId, msg) => {
        try {
          this.getConnection(connId)?.send(JSON.stringify(msg));
        } catch (err) {
          console.warn("[cyber-siege] send failed", err);
        }
      },
      broadcast: (msg) => this.broadcast(JSON.stringify(msg)),
      close: (connId, code, reason) => {
        try {
          this.getConnection(connId)?.close(code, reason);
        } catch {
          /* already closed */
        }
      },
      closeAll: (code, reason) => {
        for (const conn of this.getConnections()) {
          try {
            conn.close(code, reason);
          } catch {
            /* already closed */
          }
        }
      },
      bind: (connId, playerId) => this.getConnection(connId)?.setState({ playerId }),
      persist: (snapshot) => {
        if (snapshot) this.ctx.storage.put(STORAGE_KEY, snapshot);
        else this.ctx.storage.delete(STORAGE_KEY);
      },
      setAlarm: (at) => {
        if (at) this.ctx.storage.setAlarm(at);
        else this.ctx.storage.deleteAlarm();
      },
      setTicker: (on) => {
        if (on && !this.ticker) {
          this.ticker = setInterval(() => this.core.tick(Date.now()), TICK_MS);
        } else if (!on && this.ticker) {
          clearInterval(this.ticker);
          this.ticker = null;
        }
      },
      newToken: () => crypto.randomUUID(),
      newId: () => `p${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
    };
  }

  onConnect(conn) {
    this.core.handleOpen(conn.id);
  }

  onMessage(conn, message) {
    if (typeof message !== "string") return;
    this.core.handleMessage(conn.id, message);
  }

  onClose(conn) {
    this.core.handleClose(conn.id);
  }

  onError(conn) {
    this.core.handleClose(conn.id);
  }

  onAlarm() {
    this.core.alarm(Date.now());
  }
}

export default {
  async fetch(request, env) {
    const routed = await routePartykitRequest(request, env);
    if (routed) return routed;
    if (new URL(request.url).pathname === "/") {
      return new Response("Cyber Siege server is running.", { headers: { "content-type": "text/plain" } });
    }
    return new Response("Not Found", { status: 404 });
  },
};
