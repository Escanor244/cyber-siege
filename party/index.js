// Cyber Siege - 1v1 Tug-of-War Tower Defense PartyServer / Cloudflare Workers
import { routePartykitRequest, Server } from "partyserver";
import {
  TOWERS,
  CREEP_RAIDS,
  BOSS_SUMMONS,
  SABOTAGE_SPELLS,
  ECO_UPGRADES,
  NATURAL_WAVES,
  NATURAL_WAVE_INTERVAL_SEC,
  STARTING_GOLD,
  STARTING_HP,
  STARTING_INCOME,
  getCreepDefinition,
} from "../src/lib/constants.js";

const INCOME_INTERVAL_MS = 2000; // Gold income ticks every 2s

export class CyberSiegeServer extends Server {
  static options = { hibernate: true };

  constructor(ctx, env) {
    super(ctx, env);
    this.isDeleted = false;
    this.state = this.initialState();
    this.incomeTimer = null;
    this.matchClockTimer = null;
    this.pauseTimer = null;
    this.disconnectTimeouts = new Map();
  }

  get roomId() {
    return this.name || this.room?.id || "default";
  }

  initialState() {
    return {
      phase: "lobby", // 'lobby' | 'playing' | 'game_over' | 'closed'
      hostSessionId: null, // Strictly locks to room creator
      players: [],
      matchTimeSeconds: 0,
      currentWaveNumber: 0,
      nextWaveCountdown: NATURAL_WAVE_INTERVAL_SEC,
      winnerId: null,
      loserId: null,
      isAiMatch: false,
      isPaused: false, // 30-second combat pause on disconnect / tab switch
      pauseCountdown: 30,
      pausedPlayerName: null,
    };
  }

  async onStart() {
    try {
      const savedState = await this.ctx?.storage?.get("gameState");
      if (savedState) {
        this.state = savedState;
      }
    } catch (e) {}
  }

  saveState() {
    try {
      this.ctx?.storage?.put("gameState", this.state);
    } catch (e) {}
  }

  onConnect(conn) {
    // If room has been closed or marked deleted, reject:
    if (this.isDeleted || this.state.phase === "closed") {
      try {
        conn.send(
          JSON.stringify({
            type: "room-closed",
            reason: "This battle room does not exist or has ended.",
          })
        );
      } catch (e) {}
      try {
        conn.close(1000, "Room closed");
      } catch (e) {}
      return;
    }

    // Send latest state update to client
    try {
      conn.send(JSON.stringify({ type: "state-update", state: this.state }));
    } catch (e) {}
  }

  onMessage(arg1, arg2) {
    const sender = arg1 && typeof arg1.send === "function" ? arg1 : arg2;
    const message = typeof arg1 === "string" || arg1 instanceof ArrayBuffer ? arg1 : arg2;

    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case "join":
          return this.handleJoin(msg, sender);
        case "start-game":
          return this.handleStart(msg, sender);
        case "build-tower":
          return this.handleBuildTower(msg, sender);
        case "upgrade-tower":
          return this.handleUpgradeTower(msg, sender);
        case "sell-tower":
          return this.handleSellTower(msg, sender);
        case "send-raid":
          return this.handleSendRaid(msg, sender);
        case "upgrade-economy":
          return this.handleUpgradeEconomy(msg, sender);
        case "sabotage-opponent":
          return this.handleSabotageOpponent(msg, sender);
        case "leak-damage":
          return this.handleLeakDamage(msg, sender);
        case "restart-game":
          return this.handleRestart(sender);
        case "leave":
          return this.handleLeave(sender);
      }
    } catch (err) {
      console.error("Error handling message:", err);
    }
  }

  handleLeave(sender) {
    this.removePlayer(sender.id, true);
  }

  removePlayer(playerId, isDeliberate = false) {
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;

    const removedPlayer = this.state.players[playerIndex];
    const wasHost =
      !!removedPlayer.isHost ||
      removedPlayer.sessionId === this.state.hostSessionId ||
      removedPlayer.slot === "p1";

    if (this.disconnectTimeouts.has(removedPlayer.sessionId)) {
      clearTimeout(this.disconnectTimeouts.get(removedPlayer.sessionId));
      this.disconnectTimeouts.delete(removedPlayer.sessionId);
    }

    if (this.pauseTimer) {
      clearInterval(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.state.isPaused = false;
    this.state.pauseCountdown = 30;
    this.state.pausedPlayerName = null;

    this.state.players.splice(playerIndex, 1);
    const humanPlayers = this.state.players.filter((p) => !p.isAi);

    // CRITICAL DISPOSAL 1:
    // If NO human players remain in the room, immediately permanently delete room
    if (humanPlayers.length === 0) {
      console.log(`[CyberSiegeServer] Room ${this.roomId} completely empty. Disposing room.`);
      this.disposeRoom();
      return;
    }

    // CRITICAL DISPOSAL 2:
    // When the ROOM CREATOR / HOST leaves (deliberately or via 30s timeout):
    // Permanently close and delete the room in ALL phases (lobby, playing, game_over)!
    // Notify any remaining players and terminate all connections so zero orphan rooms linger.
    if (wasHost) {
      console.log(`[CyberSiegeServer] Room creator/host left room ${this.roomId}. Disposing room.`);
      this.broadcast(
        JSON.stringify({
          type: "room-closed",
          reason: isDeliberate
            ? "The room creator has left. The room has been deleted."
            : "The room host forfeited. The room has been closed.",
        })
      );
      this.disposeRoom();
      return;
    }

    // SCENARIO 3: Non-host left while match was actively playing (forfeit / win)
    if (this.state.phase === "playing") {
      const survivor = humanPlayers[0];
      if (survivor) {
        this.stopTimers();
        this.state.phase = "game_over";
        this.state.winnerId = survivor.id;
        this.state.loserId = removedPlayer.id;
      }
      this.saveState();
      this.broadcastState();
      return;
    }

    // SCENARIO 4: Non-host left during lobby or game_over
    this.saveState();
    this.broadcastState();
  }

  disposeRoom() {
    this.isDeleted = true;
    try {
      this.ctx?.storage?.deleteAll();
    } catch (e) {}

    this.stopTimers();
    if (this.pauseTimer) {
      clearInterval(this.pauseTimer);
      this.pauseTimer = null;
    }
    for (const timeout of this.disconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.disconnectTimeouts.clear();
    this.state = this.initialState();
    this.state.phase = "closed";

    // Close all open client connections for this room safely
    try {
      const connections =
        typeof this.getConnections === "function"
          ? this.getConnections()
          : this.room?.getConnections?.() || [];
      for (const conn of connections) {
        try {
          conn.send(
            JSON.stringify({
              type: "room-closed",
              reason: "This room has ended and no longer exists.",
            })
          );
        } catch (e) {}
        try {
          conn.close(1000, "Room disposed");
        } catch (e) {}
      }
    } catch (e) {}
  }

  onClose(conn) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player) return;

    player.connected = false;
    player.disconnectedAt = Date.now();
    const sessionId = player.sessionId;
    console.log(`[CyberSiegeServer] Connection closed: ${player.name} (${sessionId})`);

    if (this.disconnectTimeouts.has(sessionId)) {
      clearTimeout(this.disconnectTimeouts.get(sessionId));
      this.disconnectTimeouts.delete(sessionId);
    }

    // SCENARIO 1: Combat is actively in progress -> 30s PAUSE MATCH FOR BOTH PLAYERS!
    if (this.state.phase === "playing") {
      if (!this.state.isPaused) {
        this.state.isPaused = true;
        this.state.pauseCountdown = 30;
        this.state.pausedPlayerName = player.name;

        // Stop economy and clock timers immediately while paused
        this.stopTimers();

        // Start 30-second countdown interval
        this.pauseTimer = setInterval(() => {
          if (!this.state.isPaused || this.state.phase !== "playing") {
            if (this.pauseTimer) clearInterval(this.pauseTimer);
            this.pauseTimer = null;
            return;
          }

          this.state.pauseCountdown -= 1;

          if (this.state.pauseCountdown <= 0) {
            if (this.pauseTimer) clearInterval(this.pauseTimer);
            this.pauseTimer = null;
            console.log(`[CyberSiegeServer] 30s pause expired for: ${player.name}. Treating as forfeit.`);
            this.removePlayer(player.id, false);
            return;
          }

          this.broadcast(
            JSON.stringify({
              type: "pause-tick",
              pauseCountdown: this.state.pauseCountdown,
              pausedPlayerName: this.state.pausedPlayerName,
            })
          );
        }, 1000);
      }
      this.saveState();
      this.broadcastState();
      return;
    }

    // SCENARIO 2: In Lobby or Game Over -> LOBBY IMMUNITY!
    // Players freely switch tabs to Discord/YouTube while waiting.
    // DO NOT REMOVE PLAYER! DO NOT DELETE ROOM!
    // Set a 15-minute total room inactivity timeout:
    const timeout = setTimeout(() => {
      this.disconnectTimeouts.delete(sessionId);
      const anyConnected = this.state.players.some((p) => !p.isAi && p.connected);
      if (!anyConnected && (this.state.phase === "lobby" || this.state.phase === "game_over")) {
        console.log(`[CyberSiegeServer] Room ${this.roomId} idle timeout (15 min) expired. Disposing room.`);
        this.disposeRoom();
      }
    }, 15 * 60 * 1000); // 15 minutes

    this.disconnectTimeouts.set(sessionId, timeout);
    this.saveState();
    this.broadcastState();
  }

  handleJoin(msg, sender) {
    const sessionId = msg.sessionId || sender.id;
    const isCreatorIntent = !!msg.isCreator;

    // If room is closed or marked deleted:
    if (this.isDeleted || this.state.phase === "closed") {
      try {
        sender.send(
          JSON.stringify({
            type: "room-closed",
            reason: "This battle room does not exist or has ended.",
          })
        );
      } catch (e) {}
      try {
        sender.close(1000, "Room closed");
      } catch (e) {}
      return;
    }

    // 1. Check if this is an existing player reconnecting (by sessionId)
    let existing = this.state.players.find((p) => p.sessionId === sessionId);

    if (existing) {
      existing.id = sender.id;
      existing.connected = true;
      delete existing.disconnectedAt;

      // Cancel pending disconnect timeout
      if (this.disconnectTimeouts.has(existing.sessionId)) {
        clearTimeout(this.disconnectTimeouts.get(existing.sessionId));
        this.disconnectTimeouts.delete(existing.sessionId);
      }

      // Preserve host status based on state.hostSessionId or p1 slot
      if (this.state.hostSessionId === existing.sessionId || existing.slot === "p1") {
        existing.isHost = true;
        this.state.hostSessionId = existing.sessionId;
      }

      // If game was paused, resume if all human players are back!
      if (this.state.isPaused && this.state.phase === "playing") {
        const allHumansConnected = this.state.players
          .filter((p) => !p.isAi)
          .every((p) => p.connected);

        if (allHumansConnected) {
          if (this.pauseTimer) {
            clearInterval(this.pauseTimer);
            this.pauseTimer = null;
          }
          this.state.isPaused = false;
          this.state.pauseCountdown = 30;
          this.state.pausedPlayerName = null;

          // Resume combat timers
          this.startTimers();

          this.broadcast(
            JSON.stringify({
              type: "match-resumed",
              reason: "All commanders reconnected! Combat resumed.",
            })
          );
        }
      }

      sender.send(
        JSON.stringify({
          type: "player-id",
          playerId: sender.id,
          playerSlot: existing.slot,
          isHost: !!existing.isHost,
        })
      );
      this.saveState();
      this.broadcastState();
      return;
    }

    // 2. Not an existing player:
    // If joining as Challenger via room code (not creator), but NO ROOM / HOST exists:
    const humanPlayers = this.state.players.filter((p) => !p.isAi);
    if (!isCreatorIntent && (!this.state.hostSessionId || humanPlayers.length === 0)) {
      try {
        sender.send(
          JSON.stringify({
            type: "room-closed",
            reason: "Battle room does not exist or host has left.",
          })
        );
      } catch (e) {}
      try {
        sender.close(1000, "Room not found");
      } catch (e) {}
      return;
    }

    // Capacity check: strictly 2 human players:
    if (humanPlayers.length >= 2) {
      try {
        sender.send(
          JSON.stringify({
            type: "room-full",
            reason: "Battle room is already full (2/2 commanders)!",
          })
        );
      } catch (e) {}
      try {
        sender.close(1000, "Room full");
      } catch (e) {}
      return;
    }

    // 3. Room Creator joining:
    if (isCreatorIntent) {
      this.isDeleted = false;
      this.state.hostSessionId = sessionId;
      const hostPlayer = {
        id: sender.id,
        sessionId: sessionId,
        name: msg.playerName || "Commander Alpha",
        slot: "p1",
        isHost: true,
        connected: true,
        baseHp: STARTING_HP,
        gold: STARTING_GOLD,
        incomeRate: STARTING_INCOME,
        towers: [],
        stats: { creepsSent: 0, bossesSent: 0, damageDealt: 0 },
        isAi: false,
      };

      const existingP1Index = this.state.players.findIndex((p) => p.slot === "p1");
      if (existingP1Index !== -1) {
        this.state.players[existingP1Index] = hostPlayer;
      } else {
        this.state.players.unshift(hostPlayer);
      }

      sender.send(
        JSON.stringify({
          type: "player-id",
          playerId: sender.id,
          playerSlot: "p1",
          isHost: true,
        })
      );
      this.saveState();
      this.broadcastState();
      return;
    }

    // 4. Challenger joining (strictly p2, isHost: false):
    const challengerPlayer = {
      id: sender.id,
      sessionId: sessionId,
      name: msg.playerName || "Commander Omega",
      slot: "p2",
      isHost: false,
      connected: true,
      baseHp: STARTING_HP,
      gold: STARTING_GOLD,
      incomeRate: STARTING_INCOME,
      towers: [],
      stats: { creepsSent: 0, bossesSent: 0, damageDealt: 0 },
      isAi: false,
    };

    const existingP2Index = this.state.players.findIndex((p) => p.slot === "p2");
    if (existingP2Index !== -1) {
      this.state.players[existingP2Index] = challengerPlayer;
    } else {
      this.state.players.push(challengerPlayer);
    }

    sender.send(
      JSON.stringify({
        type: "player-id",
        playerId: sender.id,
        playerSlot: "p2",
        isHost: false,
      })
    );
    this.saveState();
    this.broadcastState();
  }

  handleStart(msg, sender) {
    const player = this.state.players.find((p) => p.id === sender.id);
    const isHost = !!player?.isHost || player?.sessionId === this.state.hostSessionId || player?.slot === "p1";
    if (!player || !isHost) return;

    if (msg.aiMode) {
      this.state.isAiMatch = true;
      if (this.state.players.length === 1) {
        this.state.players.push({
          id: "bot_ai",
          sessionId: "bot_session",
          name: "Cyber-Vanguard (AI)",
          slot: "p2",
          isHost: false,
          baseHp: STARTING_HP,
          gold: STARTING_GOLD,
          incomeRate: STARTING_INCOME,
          towers: [],
          stats: { creepsSent: 0, bossesSent: 0, damageDealt: 0 },
          isAi: true,
        });
      }
    } else {
      // Multiplayer 1v1: Wait for 2 human players to be ready!
      const humanPlayers = this.state.players.filter((p) => !p.isAi);
      if (humanPlayers.length < 2) return;
      this.state.isAiMatch = false;
    }

    this.state.phase = "playing";
    this.state.matchTimeSeconds = 0;
    this.state.currentWaveNumber = 0;
    this.state.nextWaveCountdown = NATURAL_WAVE_INTERVAL_SEC;
    this.state.winnerId = null;
    this.state.loserId = null;

    this.state.players.forEach((p) => {
      p.baseHp = STARTING_HP;
      p.gold = STARTING_GOLD;
      p.incomeRate = STARTING_INCOME;
      p.towers = [];
      p.stats = { creepsSent: 0, bossesSent: 0, damageDealt: 0 };
    });

    this.startTimers();
    this.saveState();
    this.broadcastState();
  }

  startTimers() {
    this.stopTimers();

    // 1. Economy Income Tick (every 2s)
    this.incomeTimer = setInterval(() => {
      if (this.state.phase !== "playing") return;

      this.state.players.forEach((p) => {
        p.gold += p.incomeRate;
      });

      this.broadcast(
        JSON.stringify({
          type: "economy-tick",
          players: this.state.players.map((p) => ({
            id: p.id,
            gold: p.gold,
            incomeRate: p.incomeRate,
          })),
        })
      );
    }, INCOME_INTERVAL_MS);

    // 2. Match Clock & Natural Wave Spawner (every 1s)
    this.matchClockTimer = setInterval(() => {
      if (this.state.phase !== "playing") return;
      this.state.matchTimeSeconds += 1;
      this.state.nextWaveCountdown -= 1;

      // Natural Wave Trigger
      if (this.state.nextWaveCountdown <= 0) {
        this.state.currentWaveNumber += 1;
        this.state.nextWaveCountdown = NATURAL_WAVE_INTERVAL_SEC;

        const waveClearBonus = 50 + this.state.currentWaveNumber * 10;
        this.state.players.forEach((p) => {
          p.gold += waveClearBonus;
        });

        const waveConfig = NATURAL_WAVES[this.state.currentWaveNumber - 1] || {
          wave: this.state.currentWaveNumber,
          name: `Sector Escalation Lv.${this.state.currentWaveNumber}`,
          creeps: [{ type: "scout_rush", count: 2 }, { type: "armored_squad", count: 1 }],
        };

        this.broadcast(
          JSON.stringify({
            type: "natural-wave-spawn",
            waveNumber: this.state.currentWaveNumber,
            waveConfig,
            bonusGold: waveClearBonus,
          })
        );
      }

      if (this.state.isAiMatch) {
        this.tickAiLogic();
      }

      this.broadcast(
        JSON.stringify({
          type: "clock-tick",
          matchTimeSeconds: this.state.matchTimeSeconds,
          currentWaveNumber: this.state.currentWaveNumber,
          nextWaveCountdown: this.state.nextWaveCountdown,
        })
      );
    }, 1000);
  }

  stopTimers() {
    if (this.incomeTimer) clearInterval(this.incomeTimer);
    if (this.matchClockTimer) clearInterval(this.matchClockTimer);
    this.incomeTimer = null;
    this.matchClockTimer = null;
  }

  handleBuildTower(msg, sender) {
    const player = this.state.players.find((p) => p.id === sender.id);
    if (!player || this.state.phase !== "playing") return;

    const towerInfo = TOWERS[msg.towerType];
    if (!towerInfo || player.gold < towerInfo.cost) return;

    player.gold -= towerInfo.cost;
    const tower = {
      id: `t_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: msg.towerType,
      gridX: msg.gridX,
      gridY: msg.gridY,
      level: 1,
    };
    player.towers.push(tower);

    this.broadcast(
      JSON.stringify({
        type: "tower-built",
        playerId: player.id,
        slot: player.slot,
        tower: tower,
        remainingGold: player.gold,
      })
    );
  }

  handleUpgradeTower(msg, sender) {
    const player = this.state.players.find((p) => p.id === sender.id);
    if (!player || this.state.phase !== "playing") return;

    const tower = player.towers.find((t) => t.id === msg.towerId);
    if (!tower) return;

    const baseCost = TOWERS[tower.type]?.cost || 100;
    const upgradeCost = Math.floor(baseCost * 0.8 * tower.level);
    if (player.gold < upgradeCost) return;

    player.gold -= upgradeCost;
    tower.level += 1;

    this.broadcast(
      JSON.stringify({
        type: "tower-upgraded",
        playerId: player.id,
        towerId: tower.id,
        newLevel: tower.level,
        remainingGold: player.gold,
      })
    );
  }

  handleSellTower(msg, sender) {
    const player = this.state.players.find((p) => p.id === sender.id);
    if (!player || this.state.phase !== "playing") return;

    const idx = player.towers.findIndex((t) => t.id === msg.towerId);
    if (idx === -1) return;

    const tower = player.towers[idx];
    const baseCost = TOWERS[tower.type]?.cost || 100;
    const refund = Math.floor(baseCost * 0.7 * tower.level);
    player.gold += refund;
    player.towers.splice(idx, 1);

    this.broadcast(
      JSON.stringify({
        type: "tower-sold",
        playerId: player.id,
        towerId: tower.id,
        refund: refund,
        remainingGold: player.gold,
      })
    );
  }

  handleSendRaid(msg, sender) {
    const senderPlayer = this.state.players.find((p) => p.id === sender.id);
    if (!senderPlayer || this.state.phase !== "playing") return;

    const unitDef = getCreepDefinition(msg.creepType);
    if (!unitDef || senderPlayer.gold < unitDef.cost) return;

    senderPlayer.gold -= unitDef.cost;
    if (unitDef.isBoss) {
      senderPlayer.stats.bossesSent += 1;
    } else {
      senderPlayer.stats.creepsSent += unitDef.count || 1;
    }

    const targetPlayer = this.state.players.find((p) => p.id !== sender.id);
    if (!targetPlayer) return;

    this.broadcast(
      JSON.stringify({
        type: "spawn-creep-wave",
        senderId: senderPlayer.id,
        targetId: targetPlayer.id,
        targetSlot: targetPlayer.slot,
        creepType: msg.creepType,
        count: unitDef.count || 1,
        isBoss: !!unitDef.isBoss,
        senderGold: senderPlayer.gold,
      })
    );
  }

  handleUpgradeEconomy(msg, sender) {
    const player = this.state.players.find((p) => p.id === sender.id);
    if (!player || this.state.phase !== "playing") return;

    const ecoTier = ECO_UPGRADES.find((e) => e.id === msg.ecoId);
    if (!ecoTier || player.gold < ecoTier.cost) return;

    player.gold -= ecoTier.cost;
    player.incomeRate += ecoTier.incomeBoost;

    this.broadcast(
      JSON.stringify({
        type: "economy-upgraded",
        playerId: player.id,
        ecoId: ecoTier.id,
        newIncomeRate: player.incomeRate,
        remainingGold: player.gold,
      })
    );
  }

  handleSabotageOpponent(msg, sender) {
    const caster = this.state.players.find((p) => p.id === sender.id);
    if (!caster || this.state.phase !== "playing") return;

    const spell = SABOTAGE_SPELLS[msg.sabotageId];
    if (!spell || caster.gold < spell.cost) return;

    caster.gold -= spell.cost;
    const target = this.state.players.find((p) => p.id !== sender.id);
    if (!target) return;

    let destroyedTower = null;

    // Handle Orbital Strike (destroy enemy defense turret COMPLETELY RANDOMLY)
    if (spell.destroysTower && target.towers.length > 0) {
      const randIdx = Math.floor(Math.random() * target.towers.length);
      destroyedTower = target.towers[randIdx];
      target.towers = target.towers.filter((t) => t.id !== destroyedTower.id);
    }

    this.broadcast(
      JSON.stringify({
        type: "sabotage-applied",
        sabotageId: spell.id,
        casterId: caster.id,
        targetId: target.id,
        targetSlot: target.slot,
        casterGold: caster.gold,
        duration: spell.duration || 0,
        destroyedTower: destroyedTower
          ? { id: destroyedTower.id, gridX: destroyedTower.gridX, gridY: destroyedTower.gridY, type: destroyedTower.type }
          : null,
      })
    );
  }

  handleLeakDamage(msg, sender) {
    const victim = this.state.players.find((p) => p.id === sender.id);
    if (!victim || this.state.phase !== "playing") return;

    const damage = Math.max(1, Math.min(msg.damage || 5, 40));
    victim.baseHp = Math.max(0, victim.baseHp - damage);

    const opponent = this.state.players.find((p) => p.id !== victim.id);
    if (opponent) {
      opponent.stats.damageDealt += damage;
    }

    this.broadcast(
      JSON.stringify({
        type: "base-damaged",
        victimId: victim.id,
        slot: victim.slot,
        damage: damage,
        remainingHp: victim.baseHp,
      })
    );

    if (victim.baseHp <= 0) {
      this.triggerGameOver(opponent, victim);
    }
  }

  triggerGameOver(winner, loser) {
    this.state.phase = "game_over";
    this.state.winnerId = winner ? winner.id : null;
    this.state.loserId = loser ? loser.id : null;
    this.stopTimers();

    this.broadcast(
      JSON.stringify({
        type: "game-over",
        winnerId: this.state.winnerId,
        loserId: this.state.loserId,
        stats: this.state.players.map((p) => ({
          id: p.id,
          name: p.name,
          slot: p.slot,
          stats: p.stats,
          income: p.incomeRate,
          isWinner: p.id === this.state.winnerId,
        })),
      })
    );
  }

  handleRestart(sender) {
    // 1. Stop active gameplay timers
    this.stopTimers();

    // 2. Redirect back to room lobby with clean slate
    this.state.phase = "lobby";
    this.state.matchTimeSeconds = 0;
    this.state.currentWaveNumber = 0;
    this.state.nextWaveCountdown = NATURAL_WAVE_INTERVAL_SEC;
    this.state.winnerId = null;
    this.state.loserId = null;

    // Prune AI bot if this was solo mode so player returns to fresh lobby
    if (this.state.isAiMatch) {
      this.state.players = this.state.players.filter((p) => !p.isAi);
      this.state.isAiMatch = false;
    }

    // Reset base HP, gold, income, towers and stats for all players
    this.state.players.forEach((p) => {
      p.baseHp = STARTING_HP;
      p.gold = STARTING_GOLD;
      p.incomeRate = STARTING_INCOME;
      p.towers = [];
      p.stats = { creepsSent: 0, bossesSent: 0, damageDealt: 0 };
    });

    // Broadcast reset event and state update to all connected clients
    this.broadcast(
      JSON.stringify({
        type: "game-reset",
        state: this.state,
      })
    );
    this.broadcastState();
  }

  // Autonomous bot logic for Solo Practice mode
  tickAiLogic() {
    const bot = this.state.players.find((p) => p.id === "bot_ai");
    const human = this.state.players.find((p) => p.id !== "bot_ai");
    if (!bot || !human || this.state.phase !== "playing") return;

    // AI builds towers
    if (bot.gold >= 100 && bot.towers.length < 10 && Math.random() < 0.3) {
      const types = ["gatling", "cryo", "plasma", "tesla"];
      const affordable = types.filter((t) => TOWERS[t].cost <= bot.gold);
      if (affordable.length > 0) {
        const choice = affordable[Math.floor(Math.random() * affordable.length)];
        const cost = TOWERS[choice].cost;
        bot.gold -= cost;

        const occupied = new Set(bot.towers.map((t) => `${t.gridX},${t.gridY}`));
        const available = [];
        for (let x = 1; x <= 7; x++) {
          for (let y = 1; y <= 5; y++) {
            if (!occupied.has(`${x},${y}`)) available.push({ x, y });
          }
        }

        if (available.length > 0) {
          const spot = available[Math.floor(Math.random() * available.length)];
          const tower = {
            id: `ai_t_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: choice,
            gridX: spot.x,
            gridY: spot.y,
            level: 1,
          };
          bot.towers.push(tower);

          this.broadcast(
            JSON.stringify({
              type: "tower-built",
              playerId: bot.id,
              slot: bot.slot,
              tower: tower,
              remainingGold: bot.gold,
            })
          );
        }
      }
    }

    // AI buys Economy Upgrades
    if (bot.gold >= 120 && Math.random() < 0.2) {
      const affordableEco = ECO_UPGRADES.filter((e) => e.cost <= bot.gold);
      if (affordableEco.length > 0) {
        const eco = affordableEco[0];
        bot.gold -= eco.cost;
        bot.incomeRate += eco.incomeBoost;
        this.broadcast(
          JSON.stringify({
            type: "economy-upgraded",
            playerId: bot.id,
            ecoId: eco.id,
            newIncomeRate: bot.incomeRate,
            remainingGold: bot.gold,
          })
        );
      }
    }

    // AI sends Monster Raids or Bosses after 8s
    if (bot.gold >= 50 && this.state.matchTimeSeconds >= 8 && Math.random() < 0.35) {
      const raidKeys = ["scout_rush", "armored_squad", "drone_swarm"];
      if (bot.gold >= 420 && Math.random() < 0.25) {
        raidKeys.push("cyber_behemoth");
      }
      const affordable = raidKeys.filter((k) => getCreepDefinition(k).cost <= bot.gold);
      if (affordable.length > 0) {
        const choice = affordable[Math.floor(Math.random() * affordable.length)];
        const def = getCreepDefinition(choice);
        bot.gold -= def.cost;

        this.broadcast(
          JSON.stringify({
            type: "spawn-creep-wave",
            senderId: bot.id,
            targetId: human.id,
            targetSlot: human.slot,
            creepType: choice,
            count: def.count || 1,
            isBoss: !!def.isBoss,
            senderGold: bot.gold,
          })
        );
      }
    }

    // AI casts Sabotage (Orbital Strike against human defense turret COMPLETELY RANDOMLY)
    if (
      bot.gold >= 260 &&
      this.state.matchTimeSeconds >= 14 &&
      human.towers.length > 0 &&
      Math.random() < 0.25
    ) {
      bot.gold -= 260;
      const randIdx = Math.floor(Math.random() * human.towers.length);
      const destroyedTower = human.towers[randIdx];
      human.towers = human.towers.filter((t) => t.id !== destroyedTower.id);

      this.broadcast(
        JSON.stringify({
          type: "sabotage-applied",
          sabotageId: "orbital_nuke",
          casterId: bot.id,
          targetId: human.id,
          targetSlot: human.slot,
          casterGold: bot.gold,
          duration: 0,
          destroyedTower: {
            id: destroyedTower.id,
            gridX: destroyedTower.gridX,
            gridY: destroyedTower.gridY,
            type: destroyedTower.type,
          },
        })
      );
    }
  }

  broadcast(data, without = []) {
    try {
      if (typeof super.broadcast === "function") {
        super.broadcast(data, without);
        return;
      }
      this.room?.broadcast?.(data, without);
    } catch (e) {
      try {
        const connections =
          typeof this.getConnections === "function"
            ? this.getConnections()
            : this.room?.getConnections?.() || [];
        for (const conn of connections) {
          if (without.includes(conn.id)) continue;
          try {
            if (conn.readyState === 1) {
              conn.send(data);
            }
          } catch (err) {}
        }
      } catch (err) {}
    }
  }

  broadcastState() {
    this.broadcast(JSON.stringify({ type: "state-update", state: this.state }));
  }
}

export default {
  async fetch(request, env) {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
};
