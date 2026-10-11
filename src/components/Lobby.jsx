// Main menu: callsign, solo skirmish (with difficulty) and multiplayer rooms.
import { useState } from "react";
import { Shield, Swords, Cpu, Users, Play, ArrowRight, Sparkles, BatteryCharging, X } from "lucide-react";

const DIFFICULTIES = [
  { id: "easy", label: "EASY" },
  { id: "normal", label: "NORMAL" },
  { id: "hard", label: "HARD" },
];

const PREFIXES = ["Viper", "Ghost", "Apex", "Nexus", "Zero", "Pulse", "Titan", "Vortex"];

export default function Lobby({ playerName, setPlayerName, difficulty, setDifficulty, onStartSolo, onCreateRoom, onJoinRoom }) {
  const [joinCode, setJoinCode] = useState("");
  const cleanCode = joinCode.replace(/[^A-Z0-9]/g, "");
  const canJoin = cleanCode.length >= 4;

  const randomizeName = () => {
    const n = Math.floor(Math.random() * 89 + 10);
    setPlayerName(`${PREFIXES[Math.floor(Math.random() * PREFIXES.length)]}-${n}`);
  };

  return (
    <div className="lobby-overlay">
      <div className="lobby-container">
        <div className="lobby-header">
          <div className="row center mb-2">
            <span className="badge-pill">CYBERNETIC TOWER DEFENSE</span>
          </div>
          <h1 className="lobby-title">CYBER SIEGE</h1>
          <h2 className="lobby-subtitle">1V1 TUG-OF-WAR // LINE WARS</h2>
          <p className="lobby-tagline">Survive timed natural waves. Spam monster raids, bosses & sabotages at your opponent.</p>
        </div>

        <div className="name-input-box">
          <label className="input-label" htmlFor="callsign">
            COMMANDER CALLSIGN
          </label>
          <div className="input-group">
            <input
              id="callsign"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your handle..."
              maxLength={16}
              autoComplete="off"
              className="name-input"
            />
            <button type="button" onClick={randomizeName} title="Randomize callsign" aria-label="Randomize callsign" className="randomize-btn">
              <Sparkles size={16} className="ic-cyan" />
            </button>
          </div>
        </div>

        <div className="mode-grid">
          <div className="mode-card card-ai">
            <div className="mode-badge badge-amber">INSTANT PLAY</div>
            <div className="mode-icon-box">
              <Cpu size={28} className="ic-amber" />
            </div>
            <h3 className="mode-card-title">SOLO SKIRMISH</h3>
            <p className="mode-card-desc">Battle the Cyber-Vanguard AI with natural waves, bosses and sabotage.</p>
            <div className="segmented" role="radiogroup" aria-label="AI difficulty">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === d.id}
                  className={`segment ${difficulty === d.id ? "segment-active" : ""}`}
                  onClick={() => setDifficulty(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={onStartSolo} className="mode-btn btn-ai">
              <Play size={16} />
              <span>LAUNCH SKIRMISH</span>
            </button>
          </div>

          <div className="mode-card card-multi">
            <div className="mode-badge badge-cyan">ONLINE 1V1</div>
            <div className="mode-icon-box">
              <Users size={28} className="ic-cyan" />
            </div>
            <h3 className="mode-card-title">MULTIPLAYER DUEL</h3>
            <p className="mode-card-desc">Real-time 1v1: share your room code with a friend to duel live.</p>

            <div className="stack gap-2 w-full mt-auto">
              <button type="button" onClick={onCreateRoom} className="mode-btn btn-multi">
                <Play size={16} />
                <span>CREATE NEW ROOM</span>
              </button>

              <form
                className="join-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canJoin) onJoinRoom(cleanCode);
                }}
              >
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="ROOM CODE"
                  aria-label="Room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="join-input"
                />
                {joinCode && (
                  <button type="button" onClick={() => setJoinCode("")} className="clear-code-btn" title="Clear room code" aria-label="Clear room code">
                    <X size={14} />
                  </button>
                )}
                <button type="submit" disabled={!canJoin} className="join-btn" title="Join room" aria-label="Join room">
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="rules-bar">
          <div className="rule-item">
            <Shield size={16} className="ic-cyan shrink-0" />
            <span>Defend against natural waves every 22 seconds (+wave gold bonus).</span>
          </div>
          <div className="rule-item">
            <Swords size={16} className="ic-green shrink-0" />
            <span>Kill creeps for bounty gold. Spam raids & summon bosses at your rival.</span>
          </div>
          <div className="rule-item">
            <BatteryCharging size={16} className="ic-amber shrink-0" />
            <span>Upgrade your Power Grid to boost passive income.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
