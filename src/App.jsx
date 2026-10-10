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
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") ? params.get("room").toUpperCase() : "";
  });
  const [isSoloAi, setIsSoloAi] = useState(false);
  const [inLobby, setInLobby] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !params.get("room");
  });
  const [isMuted, setIsMuted] = useState(false);

  // Tower Selection state
  const [selectedTowerType, setSelectedTowerType] = useState(null);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState(null);

  const {
    gameState,
    myPlayerId,
    mySlot,
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
  } = useCyberSocket(roomId, playerName, isSoloAi);

  const handleReturnLobby = () => {
    leaveRoom();
    setInLobby(true);
    setRoomId("");
    setIsSoloAi(false);
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch (e) {}
  };

  // Automatically return to main menu if host closes room or room is full
  useEffect(() => {
    if (connectionStatus === "room_closed" || connectionStatus === "room_full") {
      if (roomId) {
        try {
          sessionStorage.removeItem(`cybersiege_session_${roomId}`);
        } catch (e) {}
      }
      setInLobby(true);
      setRoomId("");
      try {
        window.history.replaceState({}, "", window.location.pathname);
      } catch (e) {}
    }
  }, [connectionStatus, roomId]);

  // Resolve player & opponent states using persistent sessionId and slot
  const sessionKey = roomId ? sessionStorage.getItem(`cybersiege_session_${roomId}`) : null;
  const myPlayer =
    gameState?.players?.find((p) => (myPlayerId && p.id === myPlayerId) || (sessionKey && p.sessionId === sessionKey)) ||
    gameState?.players?.find((p) => p.slot === mySlot) ||
    gameState?.players?.[0] || {
      id: "p1",
      name: playerName,
      gold: 250,
      incomeRate: 15,
      baseHp: 100,
      towers: [],
      stats: { creepsSent: 0 },
      isHost: mySlot === "p1",
    };

  const opponentPlayer =
    gameState?.players?.find((p) => p.id !== myPlayer?.id && (!sessionKey || p.sessionId !== sessionKey)) ||
    gameState?.players?.[1] || {
      id: "p2",
      name: isSoloAi ? "Cyber-Vanguard AI" : "Waiting for Opponent...",
      gold: 250,
      incomeRate: 15,
      baseHp: 100,
      towers: [],
      stats: { creepsSent: 0 },
    };

  // Lobby Handlers
  const handleStartSoloAi = () => {
    setIsSoloAi(true);
    setInLobby(false);
    startGame(true);
  };

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(code);
    setIsSoloAi(false);
    setInLobby(false);
    window.history.pushState({}, "", `?room=${code}`);
  };

  const handleJoinRoom = (code) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setRoomId(clean);
    setIsSoloAi(false);
    setInLobby(false);
    window.history.pushState({}, "", `?room=${clean}`);
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
          {!isSoloAi && gameState?.phase === "lobby" && (
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
                    Share this room link with your friend. The room host can launch the duel once both commanders connect.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
                      navigator.clipboard?.writeText(url);
                      sound.playCoin();
                      alert("Room Invite Link Copied to Clipboard:\n" + url);
                    }}
                    className="copy-invite-btn"
                  >
                    📋 COPY INVITE LINK
                  </button>

                  <button
                    onClick={handleReturnLobby}
                    className="copy-invite-btn"
                    style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                  >
                    🚪 LEAVE ROOM
                  </button>

                  {myPlayer?.isHost ? (
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
                    {gameState?.players?.[0]?.name || playerName} {gameState?.players?.[0]?.isHost ? "👑 HOST" : ""}
                  </span>
                  <span className="strip-ready-tag">ONLINE</span>
                </div>

                <div className="player-strip-card">
                  <span className="text-xs font-mono text-fuchsia-400 font-bold">SLOT 2 (P2):</span>
                  {gameState?.players?.[1] ? (
                    <>
                      <span className="text-sm font-bold text-white">{gameState.players[1].name}</span>
                      <span className="strip-ready-tag">ONLINE</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-500 italic">Waiting for challenger...</span>
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
            />
          </main>

          {/* Bottom HUD: 4 Distinct Tabs (Armory, Raids, Bosses/Sabotage, Power Grid) */}
          <ControlHUD
            playerGold={myPlayer.gold}
            selectedTowerType={selectedTowerType}
            onSelectTowerType={setSelectedTowerType}
            selectedPlacedTower={selectedPlacedTower}
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
