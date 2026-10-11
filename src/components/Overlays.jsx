// Small overlay pieces: pause, reconnecting banner, toasts, the room waiting banner.
import { useState } from "react";
import { WifiOff } from "lucide-react";
import { copyText } from "../lib/clipboard.js";
import { sound } from "../audio/soundFx.js";

export function PauseOverlay({ pause, me }) {
  if (!pause) return null;
  const itsMe = pause.byPlayerId === me?.id;
  return (
    <div className="combat-pause-modal" role="alertdialog" aria-live="assertive">
      <div className="pause-card">
        <div className="pause-icon-ring" aria-hidden="true">
          ⏸️
        </div>
        <h2 className="pause-title">COMBAT PAUSED</h2>
        <p className="pause-subtitle">
          {itsMe ? (
            "You were disconnected. Reconnecting…"
          ) : (
            <>
              Commander <strong className="txt-cyan">{pause.byName || "Opponent"}</strong> disconnected.
            </>
          )}
        </p>
        <div className="pause-timer-box">
          <span className="pause-timer-label">AUTO-FORFEIT IN</span>
          <span className="pause-timer-val">{Math.ceil((pause.remainingMs ?? 30000) / 1000)}s</span>
        </div>
        <p className="pause-footer-text">Combat resumes the moment the commander reconnects.</p>
      </div>
    </div>
  );
}

export function ReconnectBanner({ status }) {
  if (status !== "reconnecting" && status !== "connecting") return null;
  return (
    <div className="reconnect-banner" role="status" aria-live="polite">
      <WifiOff size={14} />
      <span>{status === "connecting" ? "Connecting to the battle server…" : "Connection lost. Reconnecting…"}</span>
    </div>
  );
}

export function Toasts({ toasts }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`global-alert-banner alert-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function RoomBanner({ roomId, view, isHost, onStart, onLeave }) {
  const [copied, setCopied] = useState(false);
  const players = view?.players || [];
  const p1 = players.find((p) => p.slot === "p1");
  const p2 = players.find((p) => p.slot === "p2");
  const ready = players.length === 2 && players.every((p) => p.connected);

  const copy = async () => {
    if (await copyText(roomId)) {
      sound.playCoin();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const slot = (p, label, waiting) => (
    <div className="player-strip-card">
      <span className="strip-slot">{label}</span>
      <span className={`strip-name ${p ? "" : "muted"}`}>{p ? `${p.name}${p.isHost ? " 👑" : ""}` : waiting}</span>
      <span className={p?.connected ? "strip-ready-tag" : "strip-waiting-tag"}>{p ? (p.connected ? "ONLINE" : "OFFLINE") : "WAITING"}</span>
    </div>
  );

  return (
    <section className="room-lobby-banner" aria-label="Battle room">
      <div className="room-lobby-header">
        <div className="room-lobby-info">
          <div className="row gap-2 mb-1">
            <span className="badge-pill">1V1 BATTLE ROOM</span>
            <span className="room-code-tag">CODE: {roomId}</span>
          </div>
          <h2 className="room-lobby-title">{ready ? "BOTH COMMANDERS READY FOR COMBAT!" : "WAITING FOR OPPONENT TO CONNECT…"}</h2>
          <p className="room-lobby-hint">Share the room code with your friend to duel.</p>
        </div>
        <div className="room-lobby-actions">
          <button type="button" onClick={copy} className={`copy-invite-btn ${copied ? "btn-copied" : ""}`}>
            {copied ? `✅ COPIED ${roomId}` : `📋 COPY CODE ${roomId}`}
          </button>
          <button type="button" onClick={onLeave} className="copy-invite-btn btn-leave">
            🚪 LEAVE
          </button>
          {isHost ? (
            <button type="button" disabled={!ready} onClick={onStart} className={`launch-duel-btn ${ready ? "btn-pulse" : "btn-disabled"}`}>
              {ready ? "⚡ START 1V1 DUEL" : "⏳ WAITING (1/2)…"}
            </button>
          ) : (
            <div className="challenger-status-tag">🎮 READY · WAITING FOR HOST</div>
          )}
        </div>
      </div>
      <div className="room-players-strip">
        {slot(p1, "P1", "Host")}
        {slot(p2, "P2", "Waiting for challenger…")}
      </div>
    </section>
  );
}
