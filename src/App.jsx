// Cyber Siege - top-level screen flow. Solo and multiplayer share every screen;
// only the session's transport differs (see net/useMatch.js).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import HeaderBar from "./components/HeaderBar";
import GameBoard from "./components/GameBoard";
import ControlHUD from "./components/ControlHUD";
import Lobby from "./components/Lobby";
import GameOverModal from "./components/GameOverModal";
import SettingsMenu from "./components/SettingsMenu";
import Tutorial from "./components/Tutorial";
import { PauseOverlay, ReconnectBanner, Toasts, RoomBanner } from "./components/Overlays";
import { useMatch, forgetRoomToken } from "./net/useMatch.js";
import { useMatchAlerts } from "./lib/useMatchAlerts.js";
import { settings } from "./lib/settings.js";
import { sound } from "./audio/soundFx.js";
import { TOWERS } from "./shared/config/towers.js";
import * as V from "./shared/rules/validate.js";

const TOWER_KEYS = Object.fromEntries(Object.values(TOWERS).map((t) => [t.hotkey, t.id]));
const TAB_KEYS = { q: "defense", w: "raids", e: "sabotage", r: "economy" };
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

// The tab remembers its multiplayer room, so a reload drops straight back into the
// match (the server's resume token gives back the same seat).
const ACTIVE_KEY = "cybersiege_active_room";

function loadActiveSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ACTIVE_KEY) || "null");
    return saved?.mode === "multi" && saved.roomId ? saved : null;
  } catch {
    return null;
  }
}

function saveActiveSession(session) {
  try {
    if (session?.mode === "multi") sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

function newRoomCode() {
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

const REJECT_TEXT = {
  room_full: "That battle room is already full (2/2).",
  not_found: "No battle room with that code. Check the code and try again.",
  in_progress: "That match has already started.",
  room_closed: "That battle room has ended.",
  replaced: "This match was opened in another tab.",
  version: "A newer version of Cyber Siege is available. Please refresh the page.",
};

export default function App() {
  const prefs = useSyncExternalStore(settings.subscribe, settings.get);
  const [playerName, setPlayerName] = useState(prefs.playerName || "Viper-01");
  const [session, setSession] = useState(loadActiveSession);
  const [activeTab, setActiveTab] = useState("defense");
  const [ghostType, setGhostType] = useState(null);
  const [pendingCell, setPendingCell] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [selectedTowerId, setSelectedTowerId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [enemyOpen, setEnemyOpen] = useState(false);
  const [isMuted, setMuted] = useState(sound.isMuted);
  const createRetries = useRef(0);

  const { handle, state } = useMatch(session);
  const { toasts, pushToast } = useMatchAlerts(handle);

  const view = state?.view || null;
  const me = view?.players.find((p) => p.id === state?.playerId) || null;
  const opponent = view?.players.find((p) => p.id !== state?.playerId) || null;
  const isSolo = session?.mode === "solo";
  const phase = view?.phase;

  useEffect(() => sound.installUnlock(), []);
  useEffect(() => saveActiveSession(session), [session]);

  const clearSelection = useCallback(() => {
    setGhostType(null);
    setPendingCell(null);
    setSelectedTowerId(null);
  }, []);

  const backToMenu = useCallback(
    (message) => {
      if (session?.roomId) forgetRoomToken(session.roomId);
      setSession(null);
      clearSelection();
      setEnemyOpen(false);
      if (message) pushToast(message, "danger");
    },
    [session, clearSelection, pushToast]
  );

  // Rejections and closed rooms send the player back to the menu (or retry a new code)
  useEffect(() => {
    if (!state || !session) return;
    if (state.status === "rejected") {
      const code = state.reject?.code;
      if (code === "room_exists" && session.intent === "create" && createRetries.current < 3) {
        createRetries.current += 1;
        setSession({ ...session, roomId: newRoomCode() });
        return;
      }
      backToMenu(REJECT_TEXT[code] || state.reject?.reason || "Could not join the room.");
    } else if (state.status === "closed") {
      backToMenu(state.closedReason || "The room was closed.");
    }
  }, [state, session, backToMenu]);

  // Leaving the playing phase clears any half-finished placement
  useEffect(() => {
    if (phase !== "playing") clearSelection();
  }, [phase, clearSelection]);

  // First visit: show the tutorial as soon as a session opens
  useEffect(() => {
    if (handle && !settings.get().tutorialDone) setShowTutorial(true);
  }, [handle]);

  // Solo: the clock stops while a menu covers the board
  useEffect(() => {
    handle?.local?.setSuspended("menu", showTutorial || showSettings);
  }, [handle, showTutorial, showSettings]);

  const updateName = (name) => {
    setPlayerName(name);
    settings.set({ playerName: name });
  };

  const startSolo = () => {
    createRetries.current = 0;
    setSession({ mode: "solo", name: playerName.trim() || "Commander", difficulty: prefs.difficulty });
  };
  const createRoom = () => {
    createRetries.current = 0;
    setSession({ mode: "multi", intent: "create", roomId: newRoomCode(), name: playerName.trim() || "Commander" });
  };
  const joinRoom = (code) => {
    setSession({ mode: "multi", intent: "join", roomId: code.toUpperCase(), name: playerName.trim() || "Commander" });
  };
  const leave = () => {
    handle?.store.leave();
    backToMenu();
  };

  // --------------------------------------------------------------- placement
  const selectedTower = me?.towers.find((t) => t.id === selectedTowerId) || null;
  const previewCell = pendingCell || hoverCell;
  const ghostOk = !!(ghostType && previewCell && me && view && V.canBuild(view, me, ghostType, previewCell.x, previewCell.y).ok);

  const build = (cell) => {
    if (!handle || !me || !ghostType) return;
    const check = V.canBuild(view, me, ghostType, cell.x, cell.y);
    if (!check.ok) {
      pushToast(check.reason, "warn");
      return;
    }
    handle.store.build(ghostType, cell.x, cell.y);
    setPendingCell(null);
    setGhostType(null);
  };

  const onCellTap = (cell, pointerType) => {
    const tower = me?.towers.find((t) => t.gridX === cell.x && t.gridY === cell.y);
    if (tower) {
      setSelectedTowerId(tower.id);
      setGhostType(null);
      setPendingCell(null);
      setActiveTab("defense");
      return;
    }
    if (ghostType) {
      const touch = pointerType !== "mouse";
      if (!touch || (pendingCell && pendingCell.x === cell.x && pendingCell.y === cell.y)) build(cell);
      else setPendingCell(cell);
      return;
    }
    setSelectedTowerId(null);
  };

  const selectTowerType = (type) => {
    setGhostType(type);
    setPendingCell(null);
    setSelectedTowerId(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!handle) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (TOWER_KEYS[key]) {
        setActiveTab("defense");
        setGhostType((cur) => (cur === TOWER_KEYS[key] ? null : TOWER_KEYS[key]));
        setPendingCell(null);
        setSelectedTowerId(null);
      } else if (TAB_KEYS[key]) {
        setActiveTab(TAB_KEYS[key]);
      } else if (key === "escape") {
        clearSelection();
      } else if (key === "u" && selectedTowerId) {
        handle.store.upgrade(selectedTowerId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handle, selectedTowerId, clearSelection]);

  // ------------------------------------------------------------------ render
  if (!session) {
    return (
      <div className="app-root">
        <Toasts toasts={toasts} />
        <Lobby
          playerName={playerName}
          setPlayerName={updateName}
          difficulty={prefs.difficulty}
          setDifficulty={(d) => settings.set({ difficulty: d })}
          onStartSolo={startSolo}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
        />
      </div>
    );
  }

  const hpClass = (hp) => (hp < 30 ? "hp-val hp-danger" : "hp-val");

  return (
    <div className="app-root">
      <Toasts toasts={toasts} />
      <div className="battle-arena">
        <HeaderBar
          store={handle?.store}
          view={view}
          me={me}
          isSolo={isSolo}
          roomId={session.roomId}
          isMuted={isMuted}
          onToggleSound={() => setMuted(sound.toggleMute())}
          onOpenSettings={() => setShowSettings(true)}
          onLeave={leave}
        />

        {!isSolo && <ReconnectBanner status={state?.status} />}

        {!isSolo && phase === "lobby" && (
          <RoomBanner roomId={session.roomId} view={view} isHost={!!me?.isHost} onStart={() => handle?.store.start()} onLeave={leave} />
        )}

        <main className={`battlefields-row ${enemyOpen ? "enemy-open" : ""}`}>
          <section className="battleground-card card-own">
            <div className="battleground-header">
              <div className="row gap-2 min-w-0">
                <span className="status-dot dot-cyan" />
                <h3 className="sector-title">YOUR SECTOR // {me?.name || playerName}</h3>
              </div>
              <div className="base-hp-badge">
                <span className="hp-label">CORE</span>
                <span className={hpClass(me?.hp ?? 100)}>{me?.hp ?? 100}%</span>
              </div>
            </div>
            {handle && (
              <GameBoard
                kind="own"
                handle={handle}
                coreHp={me?.hp ?? 100}
                ghostType={ghostType}
                ghostOk={ghostOk}
                pendingCell={pendingCell}
                selectedTowerId={selectedTowerId}
                onCellTap={onCellTap}
                onCellHover={setHoverCell}
              >
                {pendingCell && ghostType && (
                  <div className="place-confirm" role="group" aria-label="Confirm placement">
                    <span className="place-confirm-label">
                      {TOWERS[ghostType].name} · ${TOWERS[ghostType].cost}
                    </span>
                    <button type="button" className="place-btn place-cancel" onClick={() => setPendingCell(null)} aria-label="Cancel placement">
                      ✕
                    </button>
                    <button type="button" className="place-btn place-ok" disabled={!ghostOk} onClick={() => build(pendingCell)} aria-label="Build here">
                      ✓
                    </button>
                  </div>
                )}
              </GameBoard>
            )}
          </section>

          <section className="battleground-card card-enemy">
            <button type="button" className="battleground-header enemy-toggle" onClick={() => setEnemyOpen((o) => !o)} aria-expanded={enemyOpen}>
              <div className="row gap-2 min-w-0">
                <span className="status-dot dot-purple" />
                <h3 className="sector-title">ENEMY // {opponent?.name || (isSolo ? "Vanguard AI" : "Waiting…")}</h3>
              </div>
              <div className="row gap-2">
                <div className="base-hp-badge">
                  <span className="hp-label">CORE</span>
                  <span className={hpClass(opponent?.hp ?? 100)}>{opponent?.hp ?? 100}%</span>
                </div>
                <span className="enemy-chevron" aria-hidden="true">
                  {enemyOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </span>
              </div>
            </button>
            {handle && <GameBoard kind="enemy" handle={handle} coreHp={opponent?.hp ?? 100} />}
          </section>
        </main>

        <ControlHUD
          store={handle?.store}
          view={view}
          me={me}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ghostType={ghostType}
          onSelectTowerType={selectTowerType}
          selectedTower={selectedTower}
          onCloseInspector={() => setSelectedTowerId(null)}
        />

        {phase === "playing" && view?.pause && <PauseOverlay pause={view.pause} me={me} />}

        {phase === "game_over" && (
          <GameOverModal
            view={view}
            me={me}
            opponent={opponent}
            isHost={!!me?.isHost}
            isSolo={isSolo}
            onRematch={() => handle?.store.restart()}
            onReturnLobby={leave}
          />
        )}

        {showSettings && (
          <SettingsMenu
            onClose={() => setShowSettings(false)}
            onShowTutorial={() => {
              setShowSettings(false);
              setShowTutorial(true);
            }}
          />
        )}
        {showTutorial && (
          <Tutorial
            onDone={() => {
              settings.set({ tutorialDone: true });
              setShowTutorial(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
