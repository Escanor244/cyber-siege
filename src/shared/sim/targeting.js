// Picks a tower's target among live creeps in range.

export function pickTarget(creeps, x, y, range, mode, canHitAir = true) {
  let best = null;
  let bestScore = -Infinity;
  const rangeSq = range * range;

  for (const c of creeps) {
    if (c.dead || !c.spawned) continue;
    if (c.flying && !canHitAir) continue;
    const dx = c.x - x;
    const dy = c.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq > rangeSq) continue;

    let score;
    switch (mode) {
      case "last":
        score = -c.progress;
        break;
      case "strongest":
        score = c.hp;
        break;
      case "closest":
        score = -distSq;
        break;
      case "first":
      default:
        score = c.progress;
    }
    // Ties resolve by lower id, so every client picks the same target
    if (score > bestScore || (score === bestScore && best && c.id < best.id)) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
