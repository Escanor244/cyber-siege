// React binding for a match session. Solo and multiplayer differ only in the
// transport; everything above this hook is identical for both.
//
// session = { mode: 'solo', name, difficulty }
//         | { mode: 'multi', intent: 'create'|'join', roomId, name }

import { useEffect, useState, useSyncExternalStore } from "react";
import { createClientStore } from "./clientStore.js";
import { createSocketTransport } from "./socketTransport.js";
import { createLocalRoom } from "./localRoom.js";
import { LaneController } from "../game/LaneController.js";
import { RemoteLaneView } from "../game/RemoteLaneView.js";

const tokenKey = (roomId) => `cybersiege_token_${roomId}`;

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function forgetRoomToken(roomId) {
  storage()?.removeItem(tokenKey(roomId));
}

function openSession(session) {
  if (session.mode === "solo") {
    const local = createLocalRoom({ difficulty: session.difficulty });
    const store = createClientStore({ transport: local.humanTransport, intent: "create", name: session.name });
    // The bot joins after our welcome, then the match starts automatically.
    let started = false;
    const offWelcome = store.on("welcome", () => local.startBot());
    const offState = store.on("state", (view) => {
      if (!started && view.phase === "lobby" && view.players.length === 2) {
        started = true;
        store.start();
      }
    });
    const onVisibility = () => local.setSuspended("hidden", document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return {
      store,
      local,
      dispose() {
        offWelcome();
        offState();
        document.removeEventListener("visibilitychange", onVisibility);
        local.destroy();
      },
    };
  }

  const ss = storage();
  const transport = createSocketTransport({ roomId: session.roomId });
  const store = createClientStore({
    transport,
    intent: session.intent,
    name: session.name,
    loadToken: () => ss?.getItem(tokenKey(session.roomId)) || null,
    saveToken: (t) => ss?.setItem(tokenKey(session.roomId), t),
  });
  // Coming back to a tab: make sure nothing was missed while it slept.
  const onVisibility = () => {
    if (!document.hidden && store.getState().status === "online") store.requestSync();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return {
    store,
    local: null,
    dispose() {
      document.removeEventListener("visibilitychange", onVisibility);
      store.destroy();
    },
  };
}

const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

export function useMatch(session) {
  const [handle, setHandle] = useState(null);

  useEffect(() => {
    if (!session) {
      setHandle(null);
      return undefined;
    }
    const opened = openSession(session);
    const lane = new LaneController({ store: opened.store, snapshotEveryMs: session.mode === "solo" ? 0 : 200 });
    const remote = new RemoteLaneView({ store: opened.store });
    const h = { ...opened, lane, remote, session };
    setHandle(h);
    return () => {
      lane.destroy();
      remote.destroy();
      opened.dispose();
    };
  }, [session]);

  const state = useSyncExternalStore(handle?.store.subscribe ?? noopSubscribe, handle?.store.getState ?? nullSnapshot);
  return { handle: handle && handle.session === session ? handle : null, state };
}
