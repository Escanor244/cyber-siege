// Hand-authored natural waves (auto-spawn on both lanes)

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
