// Turns match events into toasts and sounds. Side effects run in event handlers,
// never inside React state updaters, so StrictMode can't double them.
import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "../audio/soundFx.js";
import { findCreepDefinition } from "../shared/config/creeps.js";
import { getEcoUpgrade } from "../shared/config/economy.js";

const TOAST_MS = 3200;
const MAX_TOASTS = 3;

export function useMatchAlerts(handle) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const pushToast = useCallback((text, kind = "info") => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-(MAX_TOASTS - 1)), { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  useEffect(() => {
    if (!handle) return undefined;
    const { store } = handle;
    const myId = () => store.getState().playerId;

    const offs = [
      store.on("toast", ({ text, kind }) => {
        sound.playAlarm();
        pushToast(text, kind || "warn");
      }),
      store.on("wave", (w) => {
        sound.playWave();
        pushToast(`🌊 WAVE ${w.wave}: ${w.name} (+$${w.bonus})`, w.isBossWave ? "danger" : "info");
      }),
      store.on("issued", (m) => {
        if (m.source !== "raid") return;
        if (m.senderId === myId()) {
          sound.playCoin();
          if (m.isBoss) pushToast(`🚀 ${findCreepDefinition(m.creepType)?.name.toUpperCase()} DEPLOYED TO ENEMY SECTOR!`, "success");
        } else if (m.isBoss) {
          sound.playAlarm();
          pushToast(`⚠️ INCOMING BOSS: ${findCreepDefinition(m.creepType)?.name.toUpperCase()}!`, "danger");
        }
      }),
      store.on("tower", (m) => {
        if (m.playerId !== myId()) return;
        if (m.op === "built") sound.playBuild();
        else if (m.op === "upgraded") sound.playUpgrade();
        else if (m.op === "sold") sound.playCoin();
      }),
      store.on("eco", (m) => {
        if (m.playerId !== myId()) return;
        sound.playUpgrade();
        pushToast(`⚡ POWER GRID: ${getEcoUpgrade(m.ecoId)?.name} ONLINE (+$${m.income}/2s)`, "success");
      }),
      store.on("spell", (m) => {
        const mine = m.casterId === myId();
        sound.playAlarm();
        if (m.spellId === "orbital_nuke") {
          pushToast(mine ? "💥 ORBITAL STRIKE DEMOLISHED AN ENEMY TURRET!" : "🚨 ENEMY ORBITAL STRIKE DESTROYED YOUR TURRET!", mine ? "success" : "danger");
        } else if (m.spellId === "emp_freeze") {
          pushToast(mine ? `📡 EMP: ${m.towerIds.length} ENEMY TURRETS STUNNED` : `📡 EMP! ${m.towerIds.length} OF YOUR TURRETS STUNNED`, mine ? "success" : "danger");
        } else if (m.spellId === "frenzy_rush") {
          pushToast(mine ? "⚡ FRENZY SURGE: ENEMY CREEPS ACCELERATED" : "⚡ FRENZY! YOUR INCOMING CREEPS ARE FASTER", mine ? "success" : "danger");
        }
      }),
      store.on("resolved", (m) => {
        if (m.laneId === myId() && m.items.some(([, outcome]) => outcome !== "k")) sound.playAlarm();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [handle, pushToast]);

  return { toasts, pushToast };
}
