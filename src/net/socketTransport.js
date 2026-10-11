// Multiplayer transport: a reconnecting WebSocket to the Cloudflare Durable Object
// (partyserver). Same shape as the in-memory transport used for solo.

import PartySocket from "partysocket";

const DEFAULT_HOST = "localhost:1999";

export function resolvePartyHost() {
  const host = import.meta.env.VITE_PARTYKIT_HOST || DEFAULT_HOST;
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function createSocketTransport({ roomId, host = resolvePartyHost() }) {
  const t = {
    onOpen: null,
    onMessage: null,
    onClose: null,
    closed: false,
    send(obj) {
      // PartySocket queues messages while reconnecting
      socket.send(JSON.stringify(obj));
    },
    close() {
      if (t.closed) return;
      t.closed = true;
      socket.close();
    },
  };

  const socket = new PartySocket({ host, room: roomId });
  socket.addEventListener("open", () => t.onOpen?.());
  socket.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    t.onMessage?.(msg);
  });
  socket.addEventListener("close", () => {
    if (!t.closed) t.onClose?.();
  });
  return t;
}
