// Sabotage spells cast at the opponent

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

export function getSpellDefinition(spellId) {
  return Object.hasOwn(SABOTAGE_SPELLS, spellId) ? SABOTAGE_SPELLS[spellId] : null;
}
