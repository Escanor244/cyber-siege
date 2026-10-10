// Cyber Siege - Futuristic Matchmaker Lobby Modal
import { useState } from "react";
import { Shield, Swords, Cpu, Users, Play, ArrowRight, Sparkles, Skull, BatteryCharging, X } from "lucide-react";

export default function Lobby({
  playerName,
  setPlayerName,
  initialRoomCode,
  onStartSoloAi,
  onCreateRoom,
  onJoinRoom,
}) {
  const [joinCode, setJoinCode] = useState(
    initialRoomCode && initialRoomCode !== "ALPHA1" ? initialRoomCode : ""
  );

  const handleRandomizeName = () => {
    const prefixes = ["Viper", "Ghost", "Apex", "Nexus", "Zero", "Pulse", "Titan", "Vortex"];
    const nums = Math.floor(Math.random() * 89 + 10);
    setPlayerName(`${prefixes[Math.floor(Math.random() * prefixes.length)]}-${nums}`);
  };

  return (
    <div className="lobby-overlay">
      <div className="lobby-container">
        {/* Banner */}
        <div className="lobby-header">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="badge-pill">CYBERNETIC TOWER DEFENSE</span>
          </div>
          <h1 className="lobby-title">CYBER SIEGE</h1>
          <h2 className="lobby-subtitle">1V1 TUG-OF-WAR // LINE WARS</h2>
          <p className="lobby-tagline">
            Survive timed natural waves. Spam monster raids, bosses & sabotages at your opponent.
          </p>
        </div>

        {/* Player Name Input */}
        <div className="name-input-box">
          <label className="input-label">COMMANDER CALLSIGN</label>
          <div className="input-group">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your handle..."
              maxLength={16}
              className="name-input"
            />
            <button
              onClick={handleRandomizeName}
              title="Randomize callsign"
              className="randomize-btn"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        </div>

        {/* Mode Selector Cards */}
        <div className="mode-grid">
          {/* Option 1: Solo AI Skirmish */}
          <div className="mode-card card-ai">
            <div className="mode-badge badge-amber">INSTANT PLAY</div>
            <div className="mode-icon-box">
              <Cpu className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="mode-card-title">SOLO SKIRMISH</h3>
            <p className="mode-card-desc">
              Battle against the Cyber-Vanguard AI with natural waves, bosses, and debuffs!
            </p>
            <button onClick={onStartSoloAi} className="mode-btn btn-ai">
              <Play className="w-4 h-4" />
              <span>LAUNCH SKIRMISH</span>
            </button>
          </div>

          {/* Option 2: Multiplayer 1v1 Room */}
          <div className="mode-card card-multi">
            <div className="mode-badge badge-cyan">ONLINE 1V1</div>
            <div className="mode-icon-box">
              <Users className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="mode-card-title">MULTIPLAYER DUEL</h3>
            <p className="mode-card-desc">
              Real-time 1v1 battle: share room code with a friend to duel live!
            </p>

            <div className="flex flex-col gap-2 w-full mt-2">
              <button onClick={onCreateRoom} className="mode-btn btn-multi">
                <Play className="w-4 h-4" />
                <span>CREATE NEW ROOM</span>
              </button>

              <div className="join-row">
                <input
                  type="text"
                  placeholder="ROOM CODE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && joinCode.trim().length >= 3) {
                      onJoinRoom(joinCode.trim());
                    }
                  }}
                  maxLength={6}
                  className="join-input"
                />
                {joinCode && (
                  <button
                    onClick={() => setJoinCode("")}
                    className="clear-code-btn"
                    title="Clear Room Code"
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      padding: "0 10px",
                      color: "#94a3b8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  disabled={joinCode.length < 3}
                  onClick={() => onJoinRoom(joinCode)}
                  className="join-btn"
                  title="Join Room"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Game Rules Quick Guide */}
        <div className="rules-bar">
          <div className="rule-item">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Defend against timed natural waves coming every 22 seconds (+Wave Gold Bonus).</span>
          </div>
          <div className="rule-item">
            <Swords className="w-4 h-4 text-green-400" />
            <span>Spam monster raids & summon giant bosses to collapse enemy defenses.</span>
          </div>
          <div className="rule-item">
            <BatteryCharging className="w-4 h-4 text-amber-400" />
            <span>Upgrade your Power Grid to boost passive gold income independently!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
