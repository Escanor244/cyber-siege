// Monster raid and boss definitions

export const MAX_CREEP_LEVEL = 100;

// Player-sent raids
export const CREEP_RAIDS = {
  scout_rush: {
    id: "scout_rush",
    armor: "light",
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
    armor: "heavy",
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
    armor: "light",
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
    armor: "shielded",
    name: "Aegis Vanguard",
    cost: 240,
    hp: 550,
    speed: 0.95,
    size: 22,
    bounty: 65,
    count: 1,
    shieldAuraRadius: 65,
    color: "#06b6d4",
    desc: "Shield aura: nearby creeps take 30% less damage. Tesla breaks it.",
  },
};

// Boss summons
export const BOSS_SUMMONS = {
  cyber_behemoth: {
    id: "cyber_behemoth",
    armor: "boss",
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
    armor: "boss",
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

// Returns the definition for a creep or boss id, or null for unknown ids.
export function findCreepDefinition(typeId) {
  if (Object.hasOwn(CREEP_RAIDS, typeId)) return CREEP_RAIDS[typeId];
  if (Object.hasOwn(BOSS_SUMMONS, typeId)) return BOSS_SUMMONS[typeId];
  return null;
}
