// Game Constants & Configuration for Cyber Siege: Line Wars

export const GRID_COLS = 10;
export const GRID_ROWS = 8;
export const TILE_SIZE = 52; // Canvas renders 520px x 416px

// Path Waypoints (Col, Row) for both players' mirror battlegrounds
export const PATH_WAYPOINTS = [
  { x: 0, y: 1 },  // Portal Spawn
  { x: 7, y: 1 },
  { x: 7, y: 3 },
  { x: 2, y: 3 },
  { x: 2, y: 6 },
  { x: 9, y: 6 },  // Base Energy Core
];

export const STARTING_GOLD = 250;
export const STARTING_HP = 100;
export const STARTING_INCOME = 15;
export const NATURAL_WAVE_INTERVAL_SEC = 22; // Natural timed wave arrives every 22s
export const MAX_TOWER_LEVEL = 100;
export const MAX_CREEP_LEVEL = 100;

// 1. DEFENSE TOWERS
export const TOWERS = {
  gatling: {
    id: "gatling",
    name: "Gatling Turret",
    role: "Rapid Anti-Light",
    cost: 100,
    range: 125,
    damage: 16,
    fireRate: 3.8, // shots per sec
    color: "#00f0ff", // Neon Cyan
    accent: "#0088cc",
    projectileType: "bullet",
    desc: "Rapid kinetic fire. Best against fast light units.",
    hotkey: "1",
  },
  cryo: {
    id: "cryo",
    name: "Cryo Emitter",
    role: "Area Slow Beam",
    cost: 150,
    range: 115,
    damage: 8,
    slowPct: 0.45,
    fireRate: 6.0,
    color: "#38bdf8", // Ice Blue
    accent: "#0284c7",
    projectileType: "beam",
    desc: "Continuous freeze ray that slows enemies by 45%.",
    hotkey: "2",
  },
  plasma: {
    id: "plasma",
    name: "Plasma Mortar",
    role: "Heavy Splash AOE",
    cost: 225,
    range: 175,
    damage: 75,
    splashRadius: 65,
    fireRate: 0.8,
    color: "#f59e0b", // Amber/Gold
    accent: "#b45309",
    projectileType: "mortar",
    desc: "Long-range explosive shell dealing cluster damage.",
    hotkey: "3",
  },
  tesla: {
    id: "tesla",
    name: "Tesla Arc",
    role: "Chain Lightning",
    cost: 300,
    range: 135,
    damage: 38,
    chainTargets: 3,
    fireRate: 1.6,
    color: "#c084fc", // Electric Violet
    accent: "#7e22ce",
    projectileType: "chain",
    desc: "Arcs lightning across up to 3 adjacent targets.",
    hotkey: "4",
  },
  railgun: {
    id: "railgun",
    name: "Railgun Piercer",
    role: "Boss Destroyer",
    cost: 400,
    range: 240,
    damage: 220,
    fireRate: 0.5,
    color: "#f43f5e", // Crimson Laser
    accent: "#be123c",
    projectileType: "laser",
    desc: "Devastating high-impact blast for heavy armor.",
    hotkey: "5",
  },
};

// 2. MONSTER RAIDS (PLAYER-SENT SPAM ATTACKS)
export const CREEP_RAIDS = {
  scout_rush: {
    id: "scout_rush",
    name: "Cyber Sprinters (x3)",
    cost: 50,
    hp: 60,
    speed: 2.3,
    size: 13,
    bounty: 10,
    count: 3,
    color: "#22c55e",
    desc: "Squad of 3 fast sprinters to rush past mortars.",
  },
  armored_squad: {
    id: "armored_squad",
    name: "Mech Enforcers (x2)",
    cost: 100,
    hp: 260,
    speed: 1.15,
    size: 19,
    bounty: 24,
    count: 2,
    color: "#f97316",
    desc: "Heavy plate armor mechs that soak kinetic bullets.",
  },
  drone_swarm: {
    id: "drone_swarm",
    name: "Drone Swarm (x6)",
    cost: 160,
    hp: 45,
    speed: 2.6,
    size: 9,
    bounty: 7,
    count: 6,
    color: "#a855f7",
    desc: "6 erratic micro-drones designed to distract turrets.",
  },
  aegis_vanguard: {
    id: "aegis_vanguard",
    name: "Aegis Vanguard",
    cost: 240,
    hp: 550,
    speed: 0.95,
    size: 22,
    bounty: 65,
    count: 1,
    shieldAuraRadius: 65,
    color: "#06b6d4",
    desc: "Projects an energy shield protecting surrounding creeps.",
  },
};

// 3. BOSS SUMMONS
export const BOSS_SUMMONS = {
  cyber_behemoth: {
    id: "cyber_behemoth",
    name: "Cyber Behemoth",
    cost: 420,
    hp: 2400,
    speed: 0.65,
    size: 32,
    bounty: 180,
    leakDamage: 25,
    isBoss: true,
    color: "#ef4444",
    desc: "Terrifying war boss. Leaks 25 Core HP if unkilled!",
  },
  void_reaver: {
    id: "void_reaver",
    name: "Void Reaver (Omega)",
    cost: 750,
    hp: 4800,
    speed: 0.75,
    size: 36,
    bounty: 300,
    leakDamage: 40,
    isBoss: true,
    color: "#e11d48",
    desc: "Colossal dread titan. Devastating endgame strike.",
  },
};

// 4. SABOTAGE & DEBUFFS (OFFENSIVE SPELLS TARGETING OPPONENT)
export const SABOTAGE_SPELLS = {
  emp_freeze: {
    id: "emp_freeze",
    name: "EMP Blackout",
    cost: 140,
    cooldown: 35,
    duration: 4.5,
    icon: "📡",
    desc: "Stuns 2 random enemy towers for 4.5 seconds.",
  },
  frenzy_rush: {
    id: "frenzy_rush",
    name: "Frenzy Surge",
    cost: 175,
    cooldown: 40,
    duration: 6.0,
    icon: "⚡",
    desc: "+50% movement speed to all creeps on opponent's lane!",
  },
  orbital_nuke: {
    id: "orbital_nuke",
    name: "Orbital Strike",
    cost: 260,
    cooldown: 40,
    destroysTower: true,
    icon: "🚀",
    desc: "Targeted missile that demolishes an enemy defense turret!",
  },
};

// 5. POWER GRID (DEDICATED INCOME UPGRADES)
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

// 6. NATURAL TIMED WAVES (AUTO-SPAWN FOR BOTH PLAYERS)
export const NATURAL_WAVES = [
  { wave: 1, time: 22, name: "Scout Recon", creeps: [{ type: "scout_rush", count: 1 }] },
  { wave: 2, time: 44, name: "Armored Patrol", creeps: [{ type: "scout_rush", count: 1 }, { type: "armored_squad", count: 1 }] },
  { wave: 3, time: 66, name: "Drone Incursion", creeps: [{ type: "drone_swarm", count: 1 }] },
  { wave: 4, time: 88, name: "Heavy Vanguard", creeps: [{ type: "armored_squad", count: 2 }, { type: "aegis_vanguard", count: 1 }] },
  { wave: 5, time: 110, name: "⚠️ BOSS STRIKE: BEHEMOTH", creeps: [{ type: "cyber_behemoth", count: 1 }], isBossWave: true },
  { wave: 6, time: 132, name: "Swarm Armada", creeps: [{ type: "drone_swarm", count: 2 }, { type: "armored_squad", count: 1 }] },
  { wave: 7, time: 154, name: "Siege Division", creeps: [{ type: "aegis_vanguard", count: 2 }, { type: "scout_rush", count: 2 }] },
  { wave: 8, time: 176, name: "⚠️ OMEGA BOSS: VOID REAVER", creeps: [{ type: "void_reaver", count: 1 }], isBossWave: true },
];

// Helper to look up any creep definition
export function getCreepDefinition(typeId) {
  if (CREEP_RAIDS[typeId]) return CREEP_RAIDS[typeId];
  if (BOSS_SUMMONS[typeId]) return BOSS_SUMMONS[typeId];
  // Fallbacks
  return CREEP_RAIDS.scout_rush;
}
