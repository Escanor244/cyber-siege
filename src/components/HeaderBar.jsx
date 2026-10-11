// Top HUD: brand, room, wave countdown + preview, match clock, gold and income.
import { Volume2, VolumeX, Copy, Check, Users, Cpu, Zap, Activity, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { NATURAL_WAVE_INTERVAL_SEC } from "../shared/config/economy.js";
import { getWave } from "../shared/rules/waveGen.js";
import { formatClock, useTicker } from "../lib/useTicker.js";
import { copyText } from "../lib/clipboard.js";

export default function HeaderBar({ store, view, me, isSolo, roomId, isMuted, onToggleSound, onOpenSettings, onLeave }) {
  const [copied, setCopied] = useState(false);
  const playing = view?.phase === "playing";
  useTicker(250, playing && !view?.pause);

  const matchMs = playing ? store.matchNow() : view?.matchMs || 0;
  const untilWaveMs = Math.max(0, (view?.nextWaveAtMs || NATURAL_WAVE_INTERVAL_SEC * 1000) - matchMs);
  const untilWave = Math.ceil(untilWaveMs / 1000);
  const progress = Math.max(0, Math.min(100, 100 - (untilWaveMs / (NATURAL_WAVE_INTERVAL_SEC * 1000)) * 100));
  const nextWave = getWave((view?.wave || 0) + 1);

  const copy = async () => {
    if (await copyText(roomId)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="header-bar">
      <div className="header-left">
        <div className="brand-logo">
          <div className="brand-icon">
            <Zap size={20} className="ic-cyan" />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">CYBER SIEGE</h1>
            <span className="brand-subtitle">1V1 LINE WARS</span>
          </div>
        </div>

        <div className="status-pill">
          {isSolo ? (
            <>
              <Cpu size={14} className="ic-amber" />
              <span>VS AI</span>
            </>
          ) : (
            <>
              <Users size={14} className="ic-cyan" />
              <span>{roomId}</span>
              <button type="button" onClick={copy} title="Copy room code" aria-label="Copy room code" className="copy-btn">
                {copied ? <Check size={12} className="ic-green" /> : <Copy size={12} />}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="center-hud-cluster">
        <div className={`wave-status-card ${nextWave.isBossWave && untilWave <= 8 && playing ? "wave-boss-incoming" : ""}`}>
          <div className="wave-header-row">
            <span className="wave-num-badge">
              <Activity size={14} className="ic-cyan" />
              WAVE {view?.wave || 0}
            </span>
            <span className="wave-countdown-text">
              NEXT IN <strong className="txt-amber">{playing ? `${untilWave}s` : "--"}</strong>
            </span>
          </div>
          <div className="wave-progress-track">
            <div className="wave-progress-fill" style={{ width: `${playing ? progress : 0}%` }} />
          </div>
          <div className="wave-preview" title="Next natural wave">
            NEXT: <span className={nextWave.isBossWave ? "txt-red" : ""}>{nextWave.name}</span>
          </div>
        </div>

        <div className="match-timer-box">
          <span className="timer-label">TIME</span>
          <span className="timer-val">{formatClock(matchMs)}</span>
        </div>
      </div>

      <div className="header-right">
        <div className="eco-pill">
          <div className="gold-box">
            <span className="gold-icon" aria-hidden="true">
              💰
            </span>
            <span className="gold-val">${me?.gold ?? 0}</span>
          </div>
          <div className="income-divider" />
          <div className="income-box" title="Passive gold earned every 2 seconds">
            <span className="income-label">INCOME</span>
            <span className="income-val">+${me?.income ?? 0}/2s</span>
          </div>
        </div>

        <button type="button" onClick={onToggleSound} className="icon-btn" title={isMuted ? "Unmute" : "Mute"} aria-label={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <VolumeX size={16} className="ic-red" /> : <Volume2 size={16} className="ic-cyan" />}
        </button>
        <button type="button" onClick={onOpenSettings} className="icon-btn" title="Settings" aria-label="Settings">
          <Settings size={16} />
        </button>
        <button type="button" onClick={onLeave} className="icon-btn icon-btn-danger" title="Leave match" aria-label="Leave match">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
