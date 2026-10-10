// Cyber Siege Multiplayer WebSocket & Local AI Simulation Hook
import { useState, useEffect, useRef, useCallback } from "react";
import PartySocket from "partysocket";
import { sound } from "../lib/soundFx";
import {
  TOWERS,
  CREEP_RAIDS,
  BOSS_SUMMONS,
  SABOTAGE_SPELLS,
  ECO_UPGRADES,
  NATURAL_WAVES,
  NATURAL_WAVE_INTERVAL_SEC,
  getCreepDefinition,
} from "../lib/constants";

const DEFAULT_PARTY_HOST = "localhost:1999";

export function useCyberSocket(roomId, playerName, isSoloAi = false) {
  const [gameState, setGameState] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [mySlot, setMySlot] = useState("p1"); // 'p1' | 'p2'
  const [incomingCreeps, setIncomingCreeps] = useState([]);
  const [opponentIncomingCreeps, setOpponentIncomingCreeps] = useState([]);
  const [activeSabotages, setActiveSabotages] = useState([]); // { type, duration, timestamp, targetSlot }
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [alertBanner, setAlertBanner] = useState(null);

  const socketRef = useRef(null);
  const localAiIntervalRef = useRef(null);
  const localEcoIntervalRef = useRef(null);
  const localWaveTimerRef = useRef(null);

  // Stable refs to prevent tearing down WebSocket on re-renders
  const mySlotRef = useRef(mySlot);
  mySlotRef.current = mySlot;
  const myPlayerIdRef = useRef(myPlayerId);
  myPlayerIdRef.current = myPlayerId;
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const showAlert = (text, type = "info") => {
    setAlertBanner({ text, type });
    setTimeout(() => setAlertBanner(null), 3500);
  };

  // Generate or retrieve persistent session ID (sessionStorage allows 2 tabs to play 1v1 locally)
  const getSessionId = useCallback(() => {
    const key = `cybersiege_session_${roomId}`;
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      sessionStorage.setItem(key, sessionId);
    }
    return sessionId;
  }, [roomId]);

  // Solo AI Local Simulation Engine
  const initLocalAiGame = useCallback(() => {
    if (localEcoIntervalRef.current) clearInterval(localEcoIntervalRef.current);
    if (localAiIntervalRef.current) clearInterval(localAiIntervalRef.current);
    if (localWaveTimerRef.current) clearInterval(localWaveTimerRef.current);

    setIncomingCreeps([]);
    setOpponentIncomingCreeps([]);
    setActiveSabotages([]);
    setConnectionStatus("offline_ai");
    setMyPlayerId("human_player");
    setMySlot("p1");

    const initialState = {
      phase: "playing",
      isAiMatch: true,
      matchTimeSeconds: 0,
      currentWaveNumber: 0,
      nextWaveCountdown: NATURAL_WAVE_INTERVAL_SEC,
      winnerId: null,
      loserId: null,
      players: [
        {
          id: "human_player",
          name: playerName || "Commander",
          slot: "p1",
          isHost: true,
          baseHp: 100,
          gold: 250,
          incomeRate: 15,
          towers: [],
          stats: { creepsSent: 0, bossesSent: 0, damageDealt: 0 },
        },
        {
          id: "bot_ai",
          name: "Vanguard AI",
          slot: "p2",
          isHost: false,
          baseHp: 100,
          gold: 250,
          incomeRate: 15,
          towers: [],
          stats: { creepsSent: 0, bossesSent: 0, damageDealt: 0 },
          isAi: true,
        },
      ],
    };

    setGameState(initialState);

    // 1. Local Eco Loop (every 2s)
    localEcoIntervalRef.current = setInterval(() => {
      setGameState((prev) => {
        if (!prev || prev.phase !== "playing") return prev;
        sound.playCoin();
        return {
          ...prev,
          players: prev.players.map((p) => ({
            ...p,
            gold: p.gold + p.incomeRate,
          })),
        };
      });
    }, 2000);

    // 2. Local Match Clock & Natural Wave Loop (every 1s)
    localWaveTimerRef.current = setInterval(() => {
      setGameState((prev) => {
        if (!prev || prev.phase !== "playing") return prev;
        const newTime = prev.matchTimeSeconds + 1;
        const newCountdown = prev.nextWaveCountdown - 1;

        if (newCountdown <= 0) {
          const nextWaveNum = prev.currentWaveNumber + 1;
          const waveClearBonus = 50 + nextWaveNum * 10;
          sound.playCoin();
          showAlert(`🌊 NATURAL WAVE ${nextWaveNum} ARRIVED! (+${waveClearBonus} Gold Bonus)`, "info");

          const waveDef = NATURAL_WAVES[nextWaveNum - 1] || {
            wave: nextWaveNum,
            creeps: [{ type: "scout_rush", count: 2 }],
          };

          // Spawn natural creeps on BOTH human and bot sectors!
          waveDef.creeps.forEach((entry) => {
            const def = getCreepDefinition(entry.type);
            const count = entry.count * (def.count || 1);
            const waveData = {
              id: `nat_${Date.now()}_${Math.random()}`,
              type: entry.type,
              count,
              isBoss: !!def.isBoss,
            };
            setIncomingCreeps((ic) => [...ic, waveData]);
            setOpponentIncomingCreeps((oic) => [...oic, waveData]);
          });

          return {
            ...prev,
            matchTimeSeconds: newTime,
            currentWaveNumber: nextWaveNum,
            nextWaveCountdown: NATURAL_WAVE_INTERVAL_SEC,
            players: prev.players.map((p) => ({
              ...p,
              gold: p.gold + waveClearBonus,
            })),
          };
        }

        return {
          ...prev,
          matchTimeSeconds: newTime,
          nextWaveCountdown: newCountdown,
        };
      });
    }, 1000);

    // 3. Local Bot Decision Loop (every 2.5s)
    localAiIntervalRef.current = setInterval(() => {
      setGameState((prev) => {
        if (!prev || prev.phase !== "playing") return prev;
        const bot = prev.players.find((p) => p.id === "bot_ai");
        if (!bot) return prev;

        let updatedBot = { ...bot };

        // Bot builds towers
        if (updatedBot.gold >= 100 && updatedBot.towers.length < 9 && Math.random() < 0.4) {
          const types = ["gatling", "cryo", "plasma", "tesla"];
          const choice = types[Math.floor(Math.random() * types.length)];
          const cost = TOWERS[choice].cost;
          if (updatedBot.gold >= cost) {
            updatedBot.gold -= cost;
            const occupied = new Set(updatedBot.towers.map((t) => `${t.gridX},${t.gridY}`));
            const spots = [];
            for (let x = 1; x <= 7; x++) {
              for (let y = 1; y <= 5; y++) {
                if (!occupied.has(`${x},${y}`)) spots.push({ x, y });
              }
            }
            if (spots.length > 0) {
              const spot = spots[Math.floor(Math.random() * spots.length)];
              updatedBot.towers.push({
                id: `ai_t_${Date.now()}`,
                type: choice,
                gridX: spot.x,
                gridY: spot.y,
                level: 1,
              });
            }
          }
        }

        // Bot buys Economy Upgrades
        if (updatedBot.gold >= 140 && Math.random() < 0.25) {
          const affordableEco = ECO_UPGRADES.filter((e) => e.cost <= updatedBot.gold);
          if (affordableEco.length > 0) {
            const eco = affordableEco[0];
            updatedBot.gold -= eco.cost;
            updatedBot.incomeRate += eco.incomeBoost;
          }
        }

        // Bot sends Monster Raids or Boss Summons (after 8s prep)
        if (updatedBot.gold >= 50 && prev.matchTimeSeconds >= 8 && Math.random() < 0.45) {
          const options = ["scout_rush", "armored_squad", "drone_swarm"];
          if (updatedBot.gold >= 420 && Math.random() < 0.3) {
            options.push("cyber_behemoth");
          }

          const choice = options[Math.floor(Math.random() * options.length)];
          const def = getCreepDefinition(choice);

          if (updatedBot.gold >= def.cost) {
            updatedBot.gold -= def.cost;
            if (def.isBoss) {
              sound.playAlarm();
              showAlert(`⚠️ WARNING: AI SUMMONED ${def.name.toUpperCase()}!`, "danger");
            }

            // Spawn on human board
            setIncomingCreeps((ic) => [
              ...ic,
              {
                id: `ai_send_${Date.now()}_${Math.random()}`,
                type: choice,
                count: def.count || 1,
                isBoss: !!def.isBoss,
              },
            ]);
          }
        }

        // Bot casts Sabotage (Orbital Strike against human defense turret COMPLETELY RANDOMLY)
        if (updatedBot.gold >= 260 && prev.matchTimeSeconds >= 12 && Math.random() < 0.25) {
          const human = prev.players.find((p) => p.id === "human_player");
          if (human && human.towers.length > 0) {
            updatedBot.gold -= 260;
            const randIdx = Math.floor(Math.random() * human.towers.length);
            const destroyedTower = human.towers[randIdx];
            const updatedHumanTowers = human.towers.filter((t) => t.id !== destroyedTower.id);

            sound.playAlarm();
            showAlert(`🚨 WARNING: ENEMY FIRED ORBITAL STRIKE AT YOUR TURRET!`, "danger");

            setActiveSabotages((as) => [
              ...as,
              {
                id: `sab_${Date.now()}_${Math.random()}`,
                type: "orbital_nuke",
                targetSlot: "p1",
                duration: 0,
                timestamp: Date.now(),
                destroyedTower: {
                  id: destroyedTower.id,
                  gridX: destroyedTower.gridX,
                  gridY: destroyedTower.gridY,
                  type: destroyedTower.type,
                },
              },
            ]);

            return {
              ...prev,
              players: prev.players.map((p) => {
                if (p.id === "bot_ai") return updatedBot;
                if (p.id === "human_player") return { ...p, towers: updatedHumanTowers };
                return p;
              }),
            };
          }
        }

        return {
          ...prev,
          players: prev.players.map((p) => (p.id === "bot_ai" ? updatedBot : p)),
        };
      });
    }, 2500);
  }, [playerName]);

  // Connect to PartyKit WebSocket
  useEffect(() => {
    if (isSoloAi) {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
      initLocalAiGame();
      return () => {
        if (localEcoIntervalRef.current) clearInterval(localEcoIntervalRef.current);
        if (localAiIntervalRef.current) clearInterval(localAiIntervalRef.current);
        if (localWaveTimerRef.current) clearInterval(localWaveTimerRef.current);
      };
    }

    // Do not connect to any room WebSocket if no roomId is specified (e.g. main menu)
    if (!roomId) {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
      setConnectionStatus("idle");
      return;
    }

    const host =
      import.meta.env.VITE_PARTYKIT_HOST ||
      window.__PARTYKIT_HOST__ ||
      DEFAULT_PARTY_HOST;
    const sessionId = getSessionId();

    try {
      const socket = new PartySocket({
        host,
        room: roomId,
      });
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        setConnectionStatus("connected");
        socket.send(
          JSON.stringify({
            type: "join",
            playerName: playerNameRef.current || "Commander",
            sessionId,
          })
        );
      });

      socket.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "player-id") {
            setMyPlayerId(msg.playerId);
            myPlayerIdRef.current = msg.playerId;
            setMySlot(msg.playerSlot || "p1");
            mySlotRef.current = msg.playerSlot || "p1";
          }

          if (msg.type === "state-update") {
            setGameState(msg.state);
            if (msg.state.phase === "lobby") {
              setIncomingCreeps([]);
              setOpponentIncomingCreeps([]);
              setActiveSabotages([]);
            }
          }

          if (msg.type === "room-closed") {
            sound.playAlarm();
            showAlert(`⚠️ ${msg.reason || "The host left the lobby. Room has been closed."}`, "danger");
            if (socketRef.current) {
              socketRef.current.close();
              socketRef.current = null;
            }
            if (roomId) {
              try {
                sessionStorage.removeItem(`cybersiege_session_${roomId}`);
              } catch (e) {}
            }
            setIncomingCreeps([]);
            setOpponentIncomingCreeps([]);
            setActiveSabotages([]);
            setGameState(null);
            setConnectionStatus("room_closed");
            return;
          }

          if (msg.type === "room-full") {
            sound.playAlarm();
            showAlert("⚠️ Battle room is already full (2/2 commanders)!", "danger");
            if (socketRef.current) {
              socketRef.current.close();
              socketRef.current = null;
            }
            setConnectionStatus("room_full");
            return;
          }

          if (msg.type === "game-reset") {
            setIncomingCreeps([]);
            setOpponentIncomingCreeps([]);
            setActiveSabotages([]);
            setGameState(msg.state);
            showAlert("🔄 REMATCH: RETURNED TO LOBBY. READY FOR COMBAT!", "info");
          }

          if (msg.type === "economy-tick") {
            sound.playCoin();
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) => {
                  const updated = msg.players.find((up) => up.id === p.id);
                  return updated ? { ...p, gold: updated.gold, incomeRate: updated.incomeRate } : p;
                }),
              };
            });
          }

          if (msg.type === "clock-tick") {
            setGameState((prev) =>
              prev
                ? {
                    ...prev,
                    matchTimeSeconds: msg.matchTimeSeconds,
                    currentWaveNumber: msg.currentWaveNumber,
                    nextWaveCountdown: msg.nextWaveCountdown,
                  }
                : prev
            );
          }

          // Natural Wave Spawn (Both Players)
          if (msg.type === "natural-wave-spawn") {
            sound.playCoin();
            showAlert(`🌊 NATURAL WAVE ${msg.waveNumber} INCOMING! (+${msg.bonusGold} Gold)`, "info");

            const waveConfig = msg.waveConfig;
            if (waveConfig && waveConfig.creeps) {
              waveConfig.creeps.forEach((entry) => {
                const def = getCreepDefinition(entry.type);
                const count = entry.count * (def.count || 1);
                const waveData = {
                  id: `p_nat_${Date.now()}_${Math.random()}`,
                  type: entry.type,
                  count,
                  isBoss: !!def.isBoss,
                };
                setIncomingCreeps((ic) => [...ic, waveData]);
                setOpponentIncomingCreeps((oic) => [...oic, waveData]);
              });
            }
          }

          if (msg.type === "tower-built") {
            sound.playUpgrade();
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) =>
                  p.id === msg.playerId
                    ? { ...p, towers: [...p.towers, msg.tower], gold: msg.remainingGold }
                    : p
                ),
              };
            });
          }

          if (msg.type === "tower-upgraded") {
            sound.playUpgrade();
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) =>
                  p.id === msg.playerId
                    ? {
                        ...p,
                        gold: msg.remainingGold,
                        towers: p.towers.map((t) => (t.id === msg.towerId ? { ...t, level: msg.newLevel } : t)),
                      }
                    : p
                ),
              };
            });
          }

          if (msg.type === "tower-sold") {
            sound.playCoin();
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) =>
                  p.id === msg.playerId
                    ? {
                        ...p,
                        gold: msg.remainingGold,
                        towers: p.towers.filter((t) => t.id !== msg.towerId),
                      }
                    : p
                ),
              };
            });
          }

          // Monster Raid or Boss Summon dispatched
          if (msg.type === "spawn-creep-wave") {
            if (msg.isBoss) {
              sound.playAlarm();
              showAlert(`⚠️ WARNING: OPPONENT SUMMONED BOSS!`, "danger");
            }

            const waveData = {
              id: `wave_${Date.now()}_${Math.random()}`,
              type: msg.creepType,
              count: msg.count,
              isBoss: msg.isBoss,
            };

            if (msg.targetSlot === mySlotRef.current) {
              setIncomingCreeps((ic) => [...ic, waveData]);
            } else {
              setOpponentIncomingCreeps((oic) => [...oic, waveData]);
            }

            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) =>
                  p.id === msg.senderId ? { ...p, gold: msg.senderGold } : p
                ),
              };
            });
          }

          // Dedicated Economy Upgraded
          if (msg.type === "economy-upgraded") {
            sound.playUpgrade();
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) =>
                  p.id === msg.playerId
                    ? { ...p, incomeRate: msg.newIncomeRate, gold: msg.remainingGold }
                    : p
                ),
              };
            });
          }

          // Sabotage / Debuff Applied
          if (msg.type === "sabotage-applied") {
            sound.playAlarm();
            if (msg.targetSlot === mySlotRef.current) {
              if (msg.destroyedTower) {
                showAlert(`🚨 ENEMY ORBITAL STRIKE DESTROYED YOUR DEFENSE TURRET!`, "danger");
              } else {
                showAlert(`📡 OPPONENT ACTIVATED SABOTAGE: ${msg.sabotageId.toUpperCase()}!`, "danger");
              }
            } else {
              if (msg.destroyedTower) {
                showAlert(`💥 ORBITAL STRIKE DEMOLISHED AN ENEMY TURRET!`, "success");
              }
            }

            setActiveSabotages((as) => [
              ...as,
              {
                id: `sab_${Date.now()}_${Math.random()}`,
                type: msg.sabotageId,
                targetSlot: msg.targetSlot,
                duration: msg.duration,
                timestamp: Date.now(),
                destroyedTower: msg.destroyedTower,
              },
            ]);

            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) => {
                  if (p.id === msg.casterId) return { ...p, gold: msg.casterGold };
                  if (p.id === msg.targetId) {
                    let updatedTowers = p.towers;
                    if (msg.destroyedTower) {
                      updatedTowers = p.towers.filter((t) => t.id !== msg.destroyedTower.id);
                    }
                    return {
                      ...p,
                      towers: updatedTowers,
                      ...(msg.targetHp !== undefined ? { baseHp: msg.targetHp } : {}),
                    };
                  }
                  return p;
                }),
              };
            });
          }

          if (msg.type === "base-damaged") {
            sound.playAlarm();
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) =>
                  p.id === msg.victimId ? { ...p, baseHp: msg.remainingHp } : p
                ),
              };
            });
          }

          if (msg.type === "game-over") {
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                phase: "game_over",
                winnerId: msg.winnerId,
                loserId: msg.loserId,
              };
            });
          }
        } catch (e) {
          console.error("Message parsing error:", e);
        }
      });

      socket.addEventListener("error", (err) => {
        console.warn("PartyKit connection notice:", err);
      });

      socket.addEventListener("close", () => {
        setConnectionStatus("connecting");
      });

      return () => {
        socket.close();
      };
    } catch (err) {
      console.warn("PartySocket error:", err);
    }
  }, [roomId, isSoloAi]);

  // Client Actions
  const startGame = useCallback(
    (aiMode = false) => {
      if (socketRef.current && connectionStatus === "connected") {
        socketRef.current.send(JSON.stringify({ type: "start-game", aiMode }));
      } else {
        initLocalAiGame();
      }
    },
    [connectionStatus, initLocalAiGame]
  );

  const buildTower = useCallback(
    (towerType, gridX, gridY) => {
      if (socketRef.current && connectionStatus === "connected") {
        socketRef.current.send(JSON.stringify({ type: "build-tower", towerType, gridX, gridY }));
      } else {
        setGameState((prev) => {
          if (!prev) return prev;
          const me = prev.players.find((p) => p.id === myPlayerId);
          const cost = TOWERS[towerType].cost;
          if (!me || me.gold < cost) return prev;
          sound.playUpgrade();
          const newTower = {
            id: `local_t_${Date.now()}`,
            type: towerType,
            gridX,
            gridY,
            level: 1,
          };
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === myPlayerId ? { ...p, gold: p.gold - cost, towers: [...p.towers, newTower] } : p
            ),
          };
        });
      }
    },
    [connectionStatus, myPlayerId]
  );

  const upgradeTower = useCallback(
    (towerId) => {
      if (socketRef.current && connectionStatus === "connected") {
        socketRef.current.send(JSON.stringify({ type: "upgrade-tower", towerId }));
      } else {
        setGameState((prev) => {
          if (!prev) return prev;
          const me = prev.players.find((p) => p.id === myPlayerId);
          const tower = me?.towers.find((t) => t.id === towerId);
          if (!tower) return prev;
          const cost = Math.floor((TOWERS[tower.type]?.cost || 100) * 0.8 * tower.level);
          if (me.gold < cost) return prev;
          sound.playUpgrade();
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === myPlayerId
                ? {
                    ...p,
                    gold: p.gold - cost,
                    towers: p.towers.map((t) => (t.id === towerId ? { ...t, level: t.level + 1 } : t)),
                  }
                : p
            ),
          };
        });
      }
    },
    [connectionStatus, myPlayerId]
  );

  const sellTower = useCallback(
    (towerId) => {
      if (socketRef.current && connectionStatus === "connected") {
        socketRef.current.send(JSON.stringify({ type: "sell-tower", towerId }));
      } else {
        setGameState((prev) => {
          if (!prev) return prev;
          const me = prev.players.find((p) => p.id === myPlayerId);
          const tower = me?.towers.find((t) => t.id === towerId);
          if (!tower) return prev;
          const refund = Math.floor((TOWERS[tower.type]?.cost || 100) * 0.7 * tower.level);
          sound.playCoin();
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === myPlayerId
                ? {
                    ...p,
                    gold: p.gold + refund,
                    towers: p.towers.filter((t) => t.id !== towerId),
                  }
                : p
            ),
          };
        });
      }
    },
    [connectionStatus, myPlayerId]
  );

  // Send Monster Raid or Boss Summon (Pure Offense)
  const sendRaid = useCallback(
    (creepType) => {
      if (socketRef.current && connectionStatus === "connected") {
        socketRef.current.send(JSON.stringify({ type: "send-raid", creepType }));
      } else {
        setGameState((prev) => {
          if (!prev) return prev;
          const me = prev.players.find((p) => p.id === myPlayerId);
          const def = getCreepDefinition(creepType);
          if (!me || me.gold < def.cost) return prev;

          if (def.isBoss) {
            showAlert(`🚀 SUMMONED ${def.name.toUpperCase()} TO ENEMY SECTOR!`, "info");
          }

          setOpponentIncomingCreeps((oic) => [
            ...oic,
            {
              id: `p1_send_${Date.now()}`,
              type: creepType,
              count: def.count || 1,
              isBoss: !!def.isBoss,
            },
          ]);

          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === myPlayerId ? { ...p, gold: p.gold - def.cost } : p
            ),
          };
        });
      }
    },
    [connectionStatus, myPlayerId]
  );

  // Upgrade Dedicated Economy (Power Grid)
  const upgradeEconomy = useCallback(
    (ecoId) => {
      if (socketRef.current && connectionStatus === "connected") {
        socketRef.current.send(JSON.stringify({ type: "upgrade-economy", ecoId }));
      } else {
        setGameState((prev) => {
          if (!prev) return prev;
          const me = prev.players.find((p) => p.id === myPlayerId);
          const eco = ECO_UPGRADES.find((e) => e.id === ecoId);
          if (!me || !eco || me.gold < eco.cost) return prev;
          sound.playUpgrade();
          showAlert(`⚡ UPGRADED POWER GRID: +$${eco.incomeBoost}/2s INCOME!`, "info");

          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === myPlayerId
                ? { ...p, gold: p.gold - eco.cost, incomeRate: p.incomeRate + eco.incomeBoost }
                : p
            ),
          };
        });
      }
    },
    [connectionStatus, myPlayerId]
  );

  // Sabotage Opponent (EMP, Frenzy, Orbital Strike)
  const sabotageOpponent = useCallback(
    (sabotageId) => {
      if (socketRef.current && connectionStatus === "connected") {
        socketRef.current.send(JSON.stringify({ type: "sabotage-opponent", sabotageId }));
      } else {
        setGameState((prev) => {
          if (!prev) return prev;
          const me = prev.players.find((p) => p.id === myPlayerId);
          const spell = SABOTAGE_SPELLS[sabotageId];
          if (!me || !spell || me.gold < spell.cost) return prev;
          sound.playAlarm();

          let destroyedTower = null;
          let bot = prev.players.find((p) => p.id === "bot_ai");
          let updatedBotTowers = bot ? [...bot.towers] : [];

          if (spell.destroysTower) {
            if (updatedBotTowers.length > 0) {
              const randIdx = Math.floor(Math.random() * updatedBotTowers.length);
              destroyedTower = updatedBotTowers[randIdx];
              updatedBotTowers = updatedBotTowers.filter((t) => t.id !== destroyedTower.id);
              showAlert(`💥 ORBITAL STRIKE DEMOLISHED AN ENEMY TURRET!`, "success");
            } else {
              showAlert(`💥 ORBITAL STRIKE: NO ENEMY TURRETS FOUND!`, "info");
            }
          } else {
            showAlert(`📡 SABOTAGE LAUNCHED: ${spell.name.toUpperCase()}!`, "info");
          }

          setActiveSabotages((as) => [
            ...as,
            {
              id: `sab_${Date.now()}_${Math.random()}`,
              type: sabotageId,
              targetSlot: "p2",
              duration: spell.duration || 0,
              timestamp: Date.now(),
              destroyedTower: destroyedTower
                ? {
                    id: destroyedTower.id,
                    gridX: destroyedTower.gridX,
                    gridY: destroyedTower.gridY,
                    type: destroyedTower.type,
                  }
                : null,
            },
          ]);

          return {
            ...prev,
            players: prev.players.map((p) => {
              if (p.id === myPlayerId) return { ...p, gold: me.gold - spell.cost };
              if (p.id === "bot_ai") return { ...p, towers: updatedBotTowers };
              return p;
            }),
          };
        });
      }
    },
    [connectionStatus, myPlayerId]
  );

  const reportLeakDamage = useCallback(
    (damage) => {
      if (socketRef.current && connectionStatus === "connected") {
        socketRef.current.send(JSON.stringify({ type: "leak-damage", damage }));
      } else {
        sound.playAlarm();
        setGameState((prev) => {
          if (!prev) return prev;
          const meIndex = prev.players.findIndex(
            (p) => p.id === myPlayerIdRef.current || p.id === "human_player" || p.slot === "p1" || !p.isAi
          );
          if (meIndex === -1) return prev;

          const me = prev.players[meIndex];
          const newHp = Math.max(0, (me.baseHp || 100) - damage);
          const isDead = newHp <= 0;

          const updatedPlayers = [...prev.players];
          updatedPlayers[meIndex] = { ...me, baseHp: newHp };

          return {
            ...prev,
            phase: isDead ? "game_over" : prev.phase,
            winnerId: isDead ? (prev.players.find((p) => p.isAi)?.id || "bot_ai") : prev.winnerId,
            loserId: isDead ? me.id : prev.loserId,
            players: updatedPlayers,
          };
        });
      }
    },
    [connectionStatus]
  );

  const reportBotLeakDamage = useCallback((damage) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const botIndex = prev.players.findIndex(
        (p) => p.id === "bot_ai" || p.slot === "p2" || p.isAi
      );
      if (botIndex === -1) return prev;

      const bot = prev.players[botIndex];
      const newHp = Math.max(0, (bot.baseHp || 100) - damage);
      const isDead = newHp <= 0;

      const updatedPlayers = [...prev.players];
      updatedPlayers[botIndex] = { ...bot, baseHp: newHp };

      return {
        ...prev,
        phase: isDead ? "game_over" : prev.phase,
        winnerId: isDead ? (prev.players.find((p) => !p.isAi)?.id || "human_player") : prev.winnerId,
        loserId: isDead ? bot.id : prev.loserId,
        players: updatedPlayers,
      };
    });
  }, []);

  const restartGame = useCallback(() => {
    if (socketRef.current && connectionStatus === "connected") {
      socketRef.current.send(JSON.stringify({ type: "restart-game" }));
    } else {
      initLocalAiGame();
    }
  }, [connectionStatus, initLocalAiGame]);

  const leaveRoom = useCallback(() => {
    // 1. Notify server immediately that player is intentionally leaving
    if (socketRef.current) {
      const s = socketRef.current;
      socketRef.current = null;
      try {
        if (s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify({ type: "leave" }));
        }
      } catch (e) {
        console.warn("Notice: Error sending leave event:", e);
      }
      setTimeout(() => {
        try {
          s.close();
        } catch (e) {}
      }, 50);
    }

    // 2. Discard persistent session key for this room
    if (roomId) {
      try {
        sessionStorage.removeItem(`cybersiege_session_${roomId}`);
      } catch (e) {}
    }

    // 3. Stop all local AI timers
    if (localEcoIntervalRef.current) clearInterval(localEcoIntervalRef.current);
    if (localAiIntervalRef.current) clearInterval(localAiIntervalRef.current);
    if (localWaveTimerRef.current) clearInterval(localWaveTimerRef.current);

    // 4. Reset local game state
    setIncomingCreeps([]);
    setOpponentIncomingCreeps([]);
    setActiveSabotages([]);
    setGameState(null);
    setConnectionStatus("idle");
  }, [roomId]);

  return {
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
  };
}
