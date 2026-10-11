// Defense tower definitions. Every ability listed in `desc` is implemented in
// src/shared/sim/lane.js and covered by tests/shared/abilities.test.js.

export const MAX_TOWER_LEVEL = 100;

export const TOWERS = {
  gatling: {
    id: "gatling",
    damageType: "kinetic",
    name: "Gatling Turret",
    role: "Rapid Anti-Light",
    cost: 100,
    range: 125,
    damage: 16,
    fireRate: 3.8, // shots per sec
    canHitAir: true,
    color: "#00f0ff", // Neon Cyan
    accent: "#0088cc",
    projectileType: "bullet",
    desc: "Rapid kinetic fire. Shreds light units, weak vs mechs. Hits air.",
    hotkey: "1",
  },
  cryo: {
    id: "cryo",
    damageType: "cryo",
    name: "Cryo Emitter",
    role: "Area Slow Beam",
    cost: 150,
    range: 115,
    damage: 8,
    slowPct: 0.45,
    slowRadius: 35, // the frost burst also slows creeps this close to the target
    fireRate: 6.0,
    canHitAir: false,
    color: "#38bdf8", // Ice Blue
    accent: "#0284c7",
    projectileType: "beam",
    desc: "Freeze ray: slows its target and nearby creeps by 45%. Ground only.",
    hotkey: "2",
  },
  plasma: {
    id: "plasma",
    damageType: "explosive",
    name: "Plasma Mortar",
    role: "Heavy Splash AOE",
    cost: 225,
    range: 175,
    damage: 75,
    splashRadius: 65,
    fireRate: 0.8,
    canHitAir: false,
    color: "#f59e0b", // Amber/Gold
    accent: "#b45309",
    projectileType: "mortar",
    desc: "Long-range shell with splash damage. Cracks armor. Ground only.",
    hotkey: "3",
  },
  tesla: {
    id: "tesla",
    damageType: "energy",
    name: "Tesla Arc",
    role: "Chain Lightning",
    cost: 300,
    range: 135,
    damage: 38,
    chainTargets: 3,
    fireRate: 1.6,
    canHitAir: true,
    color: "#c084fc", // Electric Violet
    accent: "#7e22ce",
    projectileType: "chain",
    desc: "Lightning arcs across 3 targets. Breaks shields. Hits air.",
    hotkey: "4",
  },
  railgun: {
    id: "railgun",
    damageType: "pierce",
    name: "Railgun Piercer",
    role: "Boss Destroyer",
    cost: 400,
    range: 240,
    damage: 220,
    fireRate: 0.5,
    pierceWidth: 12, // the slug hits every creep along its line of fire
    canHitAir: true,
    color: "#f43f5e", // Crimson Laser
    accent: "#be123c",
    projectileType: "laser",
    desc: "Slug pierces every creep in a line. Devastating vs bosses. Hits air.",
    hotkey: "5",
  },
  flak: {
    id: "flak",
    damageType: "flak",
    name: "Flak Battery",
    role: "Anti-Air Barrage",
    cost: 175,
    range: 150,
    damage: 22,
    fireRate: 1.6,
    airMultiplier: 2, // x2 damage vs flyers ...
    groundMultiplier: 0.5, // ... half damage vs ground units
    airSplashRadius: 45, // bursts also hit other flyers nearby
    canHitAir: true,
    color: "#e879f9", // Fuchsia
    accent: "#a21caf",
    projectileType: "flak",
    desc: "Air-burst shells: double damage + splash vs flyers, half vs ground.",
    hotkey: "6",
  },
};

export function getTowerDefinition(typeId) {
  return Object.hasOwn(TOWERS, typeId) ? TOWERS[typeId] : null;
}
