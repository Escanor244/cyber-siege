// Cyber Siege - Game Over Victory / Defeat Modal
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy, Skull, RotateCcw, Home } from "lucide-react";
import { sound } from "../lib/soundFx";

export default function GameOverModal({
  isWinner,
  winnerName,
  matchTime,
  myStats,
  myIncome,
  onRematch,
  onReturnLobby,
}) {
  useEffect(() => {
    if (isWinner) {
      sound.playVictory();
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00f0ff", "#a855f7", "#22c55e", "#fbbf24"],
      });
    } else {
      sound.playAlarm();
    }
  }, [isWinner]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="modal-overlay">
      <div className={`modal-container ${isWinner ? "modal-win" : "modal-loss"}`}>
        <div className="modal-icon-badge">
          {isWinner ? (
            <Trophy className="w-12 h-12 text-amber-400 animate-bounce" />
          ) : (
            <Skull className="w-12 h-12 text-red-500 animate-pulse" />
          )}
        </div>

        <h2 className="modal-title">
          {isWinner ? "VICTORY ACHIEVED" : "REACTOR CORE CRITICAL"}
        </h2>
        <p className="modal-subtitle">
          {isWinner
            ? "Opponent defense grid collapsed! You have conquered the cyber sector."
            : "Your core reactor was breached. Regroup and counter-attack!"}
        </p>

        {/* Stats Matrix */}
        <div className="stats-box">
          <div className="stat-row">
            <span className="stat-name">MATCH DURATION</span>
            <span className="stat-val">{formatTime(matchTime)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-name">PEAK INCOME RATE</span>
            <span className="stat-val">+${myIncome}/2s</span>
          </div>
          <div className="stat-row">
            <span className="stat-name">CREEPS DISPATCHED</span>
            <span className="stat-val">{myStats?.creepsSent || 0}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button onClick={onRematch} className="action-primary-btn">
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN / REMATCH</span>
          </button>
          <button onClick={onReturnLobby} className="action-secondary-btn">
            <Home className="w-4 h-4" />
            <span>RETURN TO LOBBY</span>
          </button>
        </div>
      </div>
    </div>
  );
}
