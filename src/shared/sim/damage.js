// Damage type vs armor type multipliers. Tuned so each tower's description is
// true: gatlings shred light units but bounce off mech plating, mortars crack
// heavy armor, tesla arcs overload shields, railguns are boss destroyers.

export const DAMAGE_TABLE = {
  //            light  heavy shielded boss
  kinetic: { light: 1.2, heavy: 0.7, shielded: 0.9, boss: 0.8 },
  cryo: { light: 1, heavy: 1, shielded: 1, boss: 1 },
  explosive: { light: 1, heavy: 1.2, shielded: 0.85, boss: 1 },
  energy: { light: 1, heavy: 0.9, shielded: 1.5, boss: 1 },
  pierce: { light: 0.8, heavy: 1.3, shielded: 1, boss: 1.5 },
};

// Creeps inside an Aegis Vanguard's aura take this fraction of damage.
export const AEGIS_DAMAGE_FACTOR = 0.7;

export function damageMultiplier(damageType, armor) {
  return DAMAGE_TABLE[damageType]?.[armor] ?? 1;
}

// For UI hints: armor types a damage type is strong / weak against.
export function matchups(damageType) {
  const row = DAMAGE_TABLE[damageType] || {};
  return {
    strong: Object.keys(row).filter((k) => row[k] > 1),
    weak: Object.keys(row).filter((k) => row[k] < 1),
  };
}
