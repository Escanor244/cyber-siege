// Defense tower definitions

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
    color: "#00f0ff", // Neon Cyan
    accent: "#0088cc",
    projectileType: "bullet",
    desc: "Rapid kinetic fire. Best against fast light units.",
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
    fireRate: 6.0,
    color: "#38bdf8", // Ice Blue
    accent: "#0284c7",
    projectileType: "beam",
    desc: "Continuous freeze ray that slows enemies by 45%.",
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
    color: "#f59e0b", // Amber/Gold
    accent: "#b45309",
    projectileType: "mortar",
    desc: "Long-range explosive shell dealing cluster damage.",
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
    color: "#c084fc", // Electric Violet
    accent: "#7e22ce",
    projectileType: "chain",
    desc: "Arcs lightning across up to 3 adjacent targets.",
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
    color: "#f43f5e", // Crimson Laser
    accent: "#be123c",
    projectileType: "laser",
    desc: "Devastating high-impact blast for heavy armor.",
    hotkey: "5",
  },
};

export function getTowerDefinition(typeId) {
  return Object.hasOwn(TOWERS, typeId) ? TOWERS[typeId] : null;
}
