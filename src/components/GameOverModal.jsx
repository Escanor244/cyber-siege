// Victory / defeat screen with match stats.
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy, Skull, RotateCcw, Home, Handshake } from "lucide-react";
import { sound } from "../audio/soundFx.js";
import { formatClock } from "../lib/useTicker.js";
import { settings } from "../lib/settings.js";

const REASONS = {
  core: null,
  forfeit: "Your opponent forfeited.",
  left: "Your opponent left the match.",
  timeout: "A commander did not reconnect in time.",
  draw: "Both reactor cores fell at the same moment.",
};

export default function GameOverModal({ view, me, opponent, isHost, isSolo, onRematch, onReturnLobby }) {
  const outcome = !view.winnerId ? "draw" : view.winnerId === me?.id ? "win" : "loss";

  useEffect(() => {
    if (outcome === "win") {
      sound.playVictory();
      if (!settings.get().reducedMotion) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ["#00f0ff", "#a855f7", "#22c55e", "#fbbf24"] });
      }
    } else {
      sound.playAlarm();
    }
  }, [outcome]);

  const s = me?.stats || {};
  const reason = view.endReason && view.endReason !== "core" && outcome !== "loss" ? REASONS[view.endReason] : null;
  const title = outcome === "win" ? "VICTORY ACHIEVED" : outcome === "draw" ? "STALEMATE" : "REACTOR CORE CRITICAL";
  const subtitle =
    reason ||
    (outcome === "win"
      ? `${opponent?.name || "The enemy"}'s defense grid collapsed. The sector is yours.`
      : outcome === "draw"
        ? "No commander holds the sector."
        : "Your core reactor was breached. Regroup and counter-attack!");

  const rows = [
    ["MATCH DURATION", formatClock(view.matchMs)],
    ["WAVES SURVIVED", view.wave],
    ["CREEPS DESTROYED", s.kills ?? 0],
    ["CREEPS SENT", s.creepsSent ?? 0],
    ["BOSSES SUMMONED", s.bossesSent ?? 0],
    ["DAMAGE DEALT", s.damageDealt ?? 0],
    ["GOLD EARNED", `$${s.goldEarned ?? 0}`],
    ["FINAL INCOME", `+$${me?.income ?? 0}/2s`],
  ];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
      <div className={`modal-container ${outcome === "win" ? "modal-win" : "modal-loss"}`}>
        <div className="modal-icon-badge">
          {outcome === "win" ? (
            <Trophy size={48} className="ic-amber anim-bounce" />
          ) : outcome === "draw" ? (
            <Handshake size={48} className="ic-cyan" />
          ) : (
            <Skull size={48} className="ic-red anim-pulse" />
          )}
        </div>
        <h2 id="gameover-title" className="modal-title">
          {title}
        </h2>
        <p className="modal-subtitle">{subtitle}</p>

        <div className="stats-box stats-grid">
          {rows.map(([name, val]) => (
            <div key={name} className="stat-row">
              <span className="stat-name">{name}</span>
              <span className="stat-val">{val}</span>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          {isHost || isSolo ? (
            <button type="button" onClick={onRematch} className="action-primary-btn">
              <RotateCcw size={16} />
              <span>{isSolo ? "PLAY AGAIN" : "REMATCH (BACK TO ROOM)"}</span>
            </button>
          ) : (
            <div className="challenger-status-tag center">Waiting for the host to start a rematch…</div>
          )}
          <button type="button" onClick={onReturnLobby} className="action-secondary-btn">
            <Home size={16} />
            <span>RETURN TO MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
}
