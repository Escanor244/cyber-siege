// Builds the renderer's scene for the local player's own lane.

import { isTowerStunned } from "../shared/sim/lane.js";

export function ownScene(laneCtrl, coreHp) {
  const lane = laneCtrl.lane;
  for (const c of lane.creeps) {
    c.slowed = c.slowUntil > lane.t;
    c.flash = c.hitFlashUntil > lane.t;
  }
  return {
    creeps: lane.creeps,
    towers: lane.towers.map((t) => ({ ...t, targetAngle: t.angle, stunned: isTowerStunned(lane, t.id) })),
    projectiles: lane.projectiles,
    beams: lane.beams,
    frenzy: lane.t < lane.frenzyUntil,
    coreHp,
  };
}
