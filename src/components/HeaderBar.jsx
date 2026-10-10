// Cyber Siege - Top HUD Header Bar
import { Volume2, VolumeX, Copy, Check, Users, Cpu, Zap, Activity, LogOut } from "lucide-react";
import { useState } from "react";
import { NATURAL_WAVE_INTERVAL_SEC } from "../lib/constants";

export default function HeaderBar({
  roomId,
  playerGold,
  playerIncome,
  matchTime,
  currentWave = 0,
  nextWaveCountdown = 22,
  connectionStatus,
  isSoloAi,
  onToggleSound,
  isMuted,
  onLeaveRoom,
  isPlaying = false,
}) {
  const [copied, setCopied] = useState(false);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waveProgress = Math.max(0, Math.min(100, ((NATURAL_WAVE_INTERVAL_SEC - nextWaveCountdown) / NATURAL_WAVE_INTERVAL_SEC) * 100));

  return (
    <header className="header-bar">
      <div className="header-left">
        <div className="brand-logo">
          <div className="brand-icon">
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="brand-title">CYBER SIEGE</h1>
            <span className="brand-subtitle">1V1 LINE WARS</span>
          </div>
        </div>

        {/* Room / Mode Badge */}
        <div className="status-pill">
          {isSoloAi ? (
            <>
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>VS AI BOT</span>
            </>
          ) : (
            <>
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>ROOM: {roomId}</span>
              <button
                onClick={copyRoomLink}
                title="Copy room invite link"
                className="copy-btn"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Center: Wave Spawner & Combat Clock */}
      <div className="center-hud-cluster">
        <div className="wave-status-card">
          <div className="wave-header-row">
            <span className="wave-num-badge">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              WAVE {currentWave}
            </span>
            <span className="wave-countdown-text">
              NEXT WAVE IN: <strong className="text-amber-400">{nextWaveCountdown}s</strong>
            </span>
          </div>
          <div className="wave-progress-track">
            <div className="wave-progress-fill" style={{ width: `${waveProgress}%` }} />
          </div>
        </div>

        <div className="match-timer-box">
          <span className="timer-label">TIME</span>
          <span className="timer-val">{formatTime(matchTime)}</span>
        </div>
      </div>

      {/* Right Stats & Sound Controls */}
      <div className="header-right">
        {/* Gold & Income */}
        <div className="eco-pill">
          <div className="gold-box">
            <span className="gold-icon">💰</span>
            <span className="gold-val">${playerGold}</span>
          </div>
          <div className="income-divider" />
          <div className="income-box" title="Passive gold earned every 2 seconds from your Power Grid">
            <span className="income-label">INCOME:</span>
            <span className="income-val">+${playerIncome}/2s</span>
          </div>
        </div>

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          className="icon-btn"
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-red-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-cyan-400" />
          )}
        </button>

        {/* Leave Match / Return to Lobby Button: only shown during active combat play */}
        {onLeaveRoom && isPlaying && (
          <button
            onClick={onLeaveRoom}
            className="icon-btn hover:text-red-400"
            title="Leave Match & Return to Menu"
          >
            <LogOut className="w-4 h-4 text-slate-400 hover:text-red-400" />
          </button>
        )}
      </div>
    </header>
  );
}
