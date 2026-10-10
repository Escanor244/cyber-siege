// Cyber Siege - Main Game Orchestrator Component
import { useState, useEffect } from "react";
import HeaderBar from "./components/HeaderBar";
import GameBoard from "./components/GameBoard";
import ControlHUD from "./components/ControlHUD";
import Lobby from "./components/Lobby";
import GameOverModal from "./components/GameOverModal";
import { useCyberSocket } from "./hooks/useCyberSocket";
import { sound } from "./lib/soundFx";

export default function App() {
  const [playerName, setPlayerName] = useState("Viper-01");
  const [roomId, setRoomId] = useState("");
  const [inLobby, setInLobby] = useState(true);
  const [isSoloAi, setIsSoloAi] = useState(false);
  const [isHostRole, setIsHostRole] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Tower Selection state
  const [selectedTowerType, setSelectedTowerType] = useState(null);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState(null);

  const {
    gameState,
    myPlayerId,
    mySlot,
    isHost: isSocketHost,
    incomingCreeps,
    opponentIncomingCreeps,
    activeSabotages,
    connectionStatus,
    alertBanner,
    startGame,
    buildTower,
    upgradeTower,
    sellTower,
    sendRaid,
    upgradeEconomy,
    sabotageOpponent,
    reportLeakDamage,
    reportBotLeakDamage,
    restartGame,
    leaveRoom,
  } = useCyberSocket(roomId, playerName, isSoloAi, isHostRole);

  // Ensure browser address bar is always clean at /
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleReturnLobby = () => {
    leaveRoom();
    if (roomId) {
      try {
        sessionStorage.removeItem(`cybersiege_sess_${roomId}`);
      } catch (e) {}
    }
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    setInLobby(true);
    setRoomId("");
    setIsSoloAi(false);
    setIsHostRole(false);
  };

  // Automatically return to main menu if host closes room or room is full
  useEffect(() => {
    if (connectionStatus === "room_closed" || connectionStatus === "room_full") {
      if (roomId) {
        try {
          sessionStorage.removeItem(`cybersiege_sess_${roomId}`);
        } catch (e) {}
      }
      setInLobby(true);
      setRoomId("");
      setIsHostRole(false);
    }
  }, [connectionStatus, roomId]);

  // Resolve player & opponent states strictly based on role and slot
  const sessionKey = roomId ? sessionStorage.getItem(`cybersiege_sess_${roomId}`) : null;
  const p1Player = gameState?.players?.find((p) => p.slot === "p1");
  const p2Player = gameState?.players?.find((p) => p.slot === "p2");

  const myPlayer =
    gameState?.players?.find((p) => (myPlayerId && p.id === myPlayerId) || (sessionKey && p.sessionId === sessionKey)) ||
    (isHostRole ? p1Player : p2Player) ||
    {
      id: isHostRole ? "p1" : "p2",
      name: playerName,
      gold: 250,
      incomeRate: 15,
      baseHp: 100,
      towers: [],
      stats: { creepsSent: 0 },
      isHost: isHostRole,
      slot: isHostRole ? "p1" : "p2",
    };

  const isEffectiveHost = isHostRole || isSocketHost || !!myPlayer?.isHost || mySlot === "p1";

  const opponentPlayer =
    gameState?.players?.find((p) => p.id !== myPlayer?.id && (!sessionKey || p.sessionId !== sessionKey)) ||
    (isHostRole ? p2Player : p1Player) ||
    {
      id: isHostRole ? "p2" : "p1",
      name: isSoloAi ? "Cyber-Vanguard AI" : (isHostRole ? "Waiting for Opponent..." : "Host Commander"),
      gold: 250,
      incomeRate: 15,
      baseHp: 100,
      towers: [],
      stats: { creepsSent: 0 },
      slot: isHostRole ? "p2" : "p1",
    };

  // Lobby Handlers
  const handleStartSoloAi = () => {
    setIsHostRole(true);
    setIsSoloAi(true);
    setInLobby(false);
    startGame(true);
  };

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setIsHostRole(true);
    setRoomId(code);
    setIsSoloAi(false);
    setInLobby(false);
  };

  const handleJoinRoom = (code) => {
    const clean = (code || "").trim().toUpperCase();
    if (!clean) return;
    setIsHostRole(false);
    setRoomId(clean);
    setIsSoloAi(false);
    setInLobby(false);
  };

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleBuildTowerAction = (towerType, x, y) => {
    buildTower(towerType, x, y);
    setSelectedTowerType(null);
  };

  const isGameOver = gameState?.phase === "game_over";
  const isWinner = gameState?.winnerId === myPlayer.id;

  return (
    <div className="app-root">
      {/* Global Alert Notification Banner */}
      {alertBanner && (
        <div className={`global-alert-banner alert-${alertBanner.type}`}>
          {alertBanner.text}
        </div>
      )}

      {inLobby ? (
        <Lobby
          playerName={playerName}
          setPlayerName={setPlayerName}
          initialRoomCode={roomId}
          onStartSoloAi={handleStartSoloAi}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      ) : (
        <div className="battle-arena">
          {/* Top HUD Header */}
          <HeaderBar
            roomId={roomId}
            playerGold={myPlayer.gold}
            playerIncome={myPlayer.incomeRate}
            matchTime={gameState?.matchTimeSeconds || 0}
            currentWave={gameState?.currentWaveNumber || 0}
            nextWaveCountdown={gameState?.nextWaveCountdown ?? 22}
            connectionStatus={connectionStatus}
            isSoloAi={isSoloAi}
            onToggleSound={handleToggleSound}
            isMuted={isMuted}
            onLeaveRoom={handleReturnLobby}
            isPlaying={gameState?.phase === "playing" || isSoloAi}
          />

          {/* Multiplayer 1v1 Waiting Room Banner */}
          {!isSoloAi && (!gameState || gameState.phase === "lobby") && (
            <div className="room-lobby-banner">
              <div className="room-lobby-header">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-pill">1V1 BATTLE ROOM</span>
                    <span className="room-code-tag">CODE: {roomId}</span>
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    {(gameState?.players?.length || 0) >= 2
                      ? "BOTH COMMANDERS READY FOR COMBAT!"
                      : "WAITING FOR OPPONENT TO CONNECT..."}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Share your room code with your friend to duel!
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(roomId);
                      sound.playCoin();
                      alert(`Room Code [${roomId}] Copied to Clipboard!\nShare this code with your friend to join.`);
                    }}
                    className="copy-invite-btn"
                    title="Copy 6-character room code"
                  >
                    📋 COPY ROOM CODE: {roomId}
                  </button>

                  <button
                    onClick={handleReturnLobby}
                    className="copy-invite-btn"
                    style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                  >
                    🚪 LEAVE ROOM
                  </button>

                  {isEffectiveHost ? (
                    <button
                      disabled={(gameState?.players?.length || 0) < 2}
                      onClick={() => startGame(false)}
                      className={`launch-duel-btn ${(gameState?.players?.length || 0) < 2 ? "btn-disabled" : "btn-pulse"}`}
                    >
                      {(gameState?.players?.length || 0) < 2
                        ? "⏳ WAITING FOR OPPONENT (1/2)..."
                        : "⚡ START 1V1 DUEL (2/2 READY)"}
                    </button>
                  ) : (
                    <div className="challenger-status-tag">
                      🎮 READY · WAITING FOR HOST TO START DUEL
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Players Badges */}
              <div className="room-players-strip">
                <div className="player-strip-card">
                  <span className="text-xs font-mono text-cyan-400 font-bold">SLOT 1 (P1):</span>
                  <span className="text-sm font-bold text-white">
                    {p1Player?.name || (isHostRole ? playerName : "Host Commander")} 👑 HOST
                  </span>
                  <span className={p1Player ? "strip-ready-tag" : "strip-waiting-tag"}>
                    {p1Player ? "ONLINE" : "CONNECTING..."}
                  </span>
                </div>

                <div className="player-strip-card">
                  <span className="text-xs font-mono text-fuchsia-400 font-bold">SLOT 2 (P2):</span>
                  {p2Player ? (
                    <>
                      <span className="text-sm font-bold text-white">{p2Player.name}</span>
                      <span className="strip-ready-tag">ONLINE</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-500 italic">
                        {!isHostRole && !p2Player ? `${playerName} (Connecting...)` : "Waiting for challenger..."}
                      </span>
                      <span className="strip-waiting-tag">WAITING</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Split Battlefield Grid */}
          <main className="battlefields-row">
            {/* Sector 1: YOUR SECTOR (Interactive) */}
            <GameBoard
              isInteractive={true}
              title={`YOUR SECTOR // ${myPlayer.name}`}
              baseHp={myPlayer.baseHp}
              towers={myPlayer.towers}
              incomingWaves={incomingCreeps}
              selectedTowerType={selectedTowerType}
              selectedPlacedTower={selectedPlacedTower}
              onSelectPlacedTower={setSelectedPlacedTower}
              onBuildTower={handleBuildTowerAction}
              onLeakDamage={reportLeakDamage}
              activeSabotages={activeSabotages}
              playerSlot={mySlot}
              isPaused={gameState?.isPaused}
            />

            {/* Sector 2: OPPONENT SECTOR (Live Synced View) */}
            <GameBoard
              isInteractive={false}
              title={`ENEMY SECTOR // ${opponentPlayer.name}`}
              baseHp={opponentPlayer.baseHp}
              towers={opponentPlayer.towers}
              incomingWaves={opponentIncomingCreeps}
              onLeakDamage={isSoloAi ? reportBotLeakDamage : () => {}}
              activeSabotages={activeSabotages}
              playerSlot={mySlot === "p1" ? "p2" : "p1"}
              isPaused={gameState?.isPaused}
            />
          </main>

          {/* 30s Tactical Match Pause Overlay */}
          {gameState?.isPaused && gameState.phase === "playing" && (
            <div className="combat-pause-modal">
              <div className="pause-card">
                <div className="pause-icon-ring">⏸️</div>
                <h2 className="pause-title">COMBAT PAUSED</h2>
                <p className="pause-subtitle">
                  Commander <strong className="text-cyan-400">{gameState.pausedPlayerName || "Opponent"}</strong> disconnected or switched tabs.
                </p>
                <div className="pause-timer-box">
                  <span className="text-xs text-slate-400 font-mono tracking-wider">AUTO-FORFEIT IN</span>
                  <span className="pause-timer-val">{gameState.pauseCountdown ?? 30}s</span>
                </div>
                <p className="pause-footer-text">
                  Combat will automatically resume the moment the commander reconnects.
                </p>
              </div>
            </div>
          )}

          {/* Bottom HUD: 4 Distinct Tabs (Armory, Raids, Bosses/Sabotage, Power Grid) */}
          <ControlHUD
            playerGold={myPlayer.gold}
            selectedTowerType={selectedTowerType}
            onSelectTowerType={setSelectedTowerType}
            selectedPlacedTower={
              selectedPlacedTower
                ? myPlayer?.towers?.find((t) => t.id === selectedPlacedTower.id) || null
                : null
            }
            onCloseInspector={() => setSelectedPlacedTower(null)}
            onUpgradeTower={upgradeTower}
            onSellTower={(tid) => {
              sellTower(tid);
              setSelectedPlacedTower(null);
            }}
            onSendRaid={sendRaid}
            onUpgradeEconomy={upgradeEconomy}
            onSabotageOpponent={sabotageOpponent}
          />

          {/* Game Over Modal */}
          {isGameOver && (
            <GameOverModal
              isWinner={isWinner}
              winnerName={isWinner ? myPlayer.name : opponentPlayer.name}
              matchTime={gameState?.matchTimeSeconds || 0}
              myStats={myPlayer.stats}
              myIncome={myPlayer.incomeRate}
              onRematch={restartGame}
              onReturnLobby={handleReturnLobby}
            />
          )}
        </div>
      )}
    </div>
  );
}
