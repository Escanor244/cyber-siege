// Economy and match pacing

export const STARTING_GOLD = 250;
export const STARTING_HP = 100;
export const STARTING_INCOME = 15;
export const INCOME_INTERVAL_SEC = 2; // Passive income is paid every 2 seconds
export const NATURAL_WAVE_INTERVAL_SEC = 22; // A natural wave arrives every 22 seconds

// Power grid (dedicated income upgrades)
export const ECO_UPGRADES = [
  {
    tier: 1,
    id: "solar_core",
    name: "Solar Array",
    cost: 80,
    incomeBoost: 5,
    icon: "☀️",
    desc: "Harness atmospheric solar radiation. (+5 Income)",
  },
  {
    tier: 2,
    id: "quantum_dynamo",
    name: "Quantum Dynamo",
    cost: 175,
    incomeBoost: 12,
    icon: "🔮",
    desc: "Sub-atomic particle generator. (+12 Income)",
  },
  {
    tier: 3,
    id: "fusion_battery",
    name: "Fusion Reactor",
    cost: 350,
    incomeBoost: 26,
    icon: "⚛️",
    desc: "High-yield plasma fusion core. (+26 Income)",
  },
  {
    tier: 4,
    id: "antimatter_tap",
    name: "Antimatter Tap",
    cost: 700,
    incomeBoost: 55,
    icon: "🌌",
    desc: "Deep-space vacuum energy extraction. (+55 Income)",
  },
];

export function getEcoUpgrade(ecoId) {
  return ECO_UPGRADES.find((e) => e.id === ecoId) || null;
}
