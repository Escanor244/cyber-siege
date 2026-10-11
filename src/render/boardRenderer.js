// Draws one battlefield from a scene description. No game logic lives here: the
// own lane's scene comes from the local simulation, the enemy's from snapshots.
//
// scene = { creeps, towers, projectiles, beams, frenzy, coreHp }
// ui    = { interactive, hover, ghostType, ghostOk, selectedTowerId, scale, lowQuality }

import { TILE_SIZE, BOARD_WIDTH, BOARD_HEIGHT, PIXEL_PATH } from "../shared/config/map.js";
import { getTowerDefinition } from "../shared/config/towers.js";
import { towerRange } from "../shared/balance.js";
import { drawCreepAsset, getEntityTier } from "./gameAssets.js";
import { drawTurret } from "./towerArt.js";
import { groundLayer } from "./staticLayer.js";
import { drawGlow, setGlowEnabled } from "./glow.js";

// Creeps whose art has a "front" and should face their direction of travel
const DIRECTIONAL = new Set(["scout_rush", "cyber_behemoth", "sky_skimmer", "storm_leviathan"]);

// Deterministic crack pattern for the reactor core (angle, length, kink)
const CRACKS = [
  [0.3, 1, 0.4],
  [2.2, 0.85, -0.5],
  [4.0, 0.95, 0.3],
  [1.2, 0.7, -0.3],
  [5.3, 0.8, 0.5],
  [3.1, 0.75, -0.4],
];

function tracePath(ctx) {
  ctx.beginPath();
  PIXEL_PATH.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
}

function drawGround(ctx, time, frenzy, ui) {
  if (ui.scale) {
    ctx.drawImage(groundLayer(ui.scale, !ui.lowQuality), 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  } else {
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  }

  // Energy flowing toward the core (amber and faster during Frenzy)
  const edge = frenzy ? "245, 158, 11" : "0, 240, 255";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([12, 28]);
  ctx.lineDashOffset = -((time * (frenzy ? 0.14 : 0.08)) % 40);
  ctx.strokeStyle = `rgba(${edge}, 0.75)`;
  ctx.lineWidth = 2.5;
  tracePath(ctx);
  ctx.stroke();
  ctx.setLineDash([]);
  if (frenzy) {
    ctx.strokeStyle = "rgba(245, 158, 11, 0.18)";
    ctx.lineWidth = TILE_SIZE * 0.78;
    tracePath(ctx);
    ctx.stroke();
  }
}

function drawPortal(ctx, time) {
  const p = PIXEL_PATH[0];
  ctx.save();
  ctx.translate(p.x, p.y);
  drawGlow(ctx, 0, 0, 34, "#a855f7", 0.6);

  // Swirling arms
  const spin = time * 0.003;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    ctx.strokeStyle = i % 2 ? "#c084fc" : "#a855f7";
    ctx.beginPath();
    ctx.arc(0, 0, 17, a, a + 1.4);
    ctx.stroke();
  }
  ctx.strokeStyle = "#00f0ff";
  ctx.lineWidth = 1.5;
  ctx.save();
  ctx.rotate(-spin * 2);
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.restore();

  // Particles drawn into the vortex
  for (let i = 0; i < 8; i++) {
    const phase = (time * 0.0008 + i / 8) % 1;
    const a = i * 2.39996 + time * 0.002;
    const r = 26 * (1 - phase);
    ctx.fillStyle = `rgba(216, 180, 254, ${phase})`;
    ctx.fillRect(Math.cos(a) * r - 1, Math.sin(a) * r - 1, 2, 2);
  }
  ctx.restore();
}

function drawCore(ctx, time, hp) {
  const core = PIXEL_PATH[PIXEL_PATH.length - 1];
  const ratio = Math.max(0, Math.min(100, hp)) / 100;
  const color = ratio > 0.5 ? "#00f0ff" : ratio > 0.25 ? "#f59e0b" : "#ef4444";
  const urgency = ratio < 0.25 ? 0.02 : 0.005;
  const pulse = Math.sin(time * urgency) * 3;

  ctx.save();
  ctx.translate(core.x, core.y);
  drawGlow(ctx, 0, 0, 44 + pulse * 2, color, 0.55 + (1 - ratio) * 0.3);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 15 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(-3, -4, 5, 0, Math.PI * 2);
  ctx.fill();

  // Cracks spread across the core as it takes damage
  const cracks = Math.round((1 - ratio) * CRACKS.length);
  ctx.strokeStyle = "rgba(10, 4, 4, 0.85)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < cracks; i++) {
    const [a, len, kink] = CRACKS[i];
    const r1 = 7 * len;
    const r2 = 15 * len;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
    ctx.lineTo(Math.cos(a + kink * 0.4) * r1, Math.sin(a + kink * 0.4) * r1);
    ctx.lineTo(Math.cos(a - kink * 0.2) * r2, Math.sin(a - kink * 0.2) * r2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.stroke();
  // Integrity ring
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  ctx.stroke();
  ctx.restore();
}

function drawRange(ctx, x, y, range, fill = "rgba(0, 240, 255, 0.08)", stroke = "rgba(0, 240, 255, 0.45)") {
  ctx.beginPath();
  ctx.arc(x, y, range, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPlacement(ctx, ui, towers, time) {
  const { hover } = ui;
  if (!ui.interactive || !hover) return;
  const px = hover.x * TILE_SIZE;
  const py = hover.y * TILE_SIZE;
  if (ui.ghostType) {
    const ok = ui.ghostOk;
    const def = getTowerDefinition(ui.ghostType);
    ctx.fillStyle = ok ? "rgba(34, 197, 94, 0.18)" : "rgba(239, 68, 68, 0.22)";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = ok ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 0.75, py + 0.75, TILE_SIZE - 1.5, TILE_SIZE - 1.5);
    if (ok && def) {
      drawRange(ctx, px + TILE_SIZE / 2, py + TILE_SIZE / 2, def.range);
      // Translucent ghost of the turret
      ctx.save();
      ctx.globalAlpha = 0.55;
      drawTurret(ctx, { type: def.id, level: 1, targetAngle: -Math.PI / 2 }, def, px + TILE_SIZE / 2, py + TILE_SIZE / 2, false, time);
      ctx.restore();
    }
  } else if (towers.some((t) => t.gridX === hover.x && t.gridY === hover.y)) {
    ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 0.75, py + 0.75, TILE_SIZE - 1.5, TILE_SIZE - 1.5);
  }
}

function drawTowers(ctx, towers, ui, time) {
  for (const tower of towers) {
    const def = getTowerDefinition(tower.type);
    if (!def) continue;
    const tx = tower.gridX * TILE_SIZE + TILE_SIZE / 2;
    const ty = tower.gridY * TILE_SIZE + TILE_SIZE / 2;
    const selected = ui.selectedTowerId === tower.id;
    if (selected) drawRange(ctx, tx, ty, towerRange(def, tower.level), "rgba(0, 240, 255, 0.1)", "rgba(0, 240, 255, 0.6)");

    drawTurret(ctx, tower, def, tx, ty, selected, time);

    if (tower.jammed && !tower.stunned) {
      ctx.strokeStyle = "rgba(253, 224, 71, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(tx, ty, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 8px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("JAMMED", tx, ty - 27);
      ctx.textAlign = "start";
    }
    if (tower.stunned) {
      drawGlow(ctx, tx, ty, 30, "#38bdf8", 0.5);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -time * 0.02;
      ctx.beginPath();
      ctx.arc(tx, ty, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Little arcs of static
      ctx.strokeStyle = "rgba(224, 242, 254, 0.9)";
      ctx.lineWidth = 1.2;
      const a = (time * 0.02) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(a) * 24, ty + Math.sin(a) * 24);
      ctx.lineTo(tx + Math.cos(a + 0.3) * 16, ty + Math.sin(a + 0.3) * 16);
      ctx.lineTo(tx + Math.cos(a + 0.5) * 22, ty + Math.sin(a + 0.5) * 22);
      ctx.stroke();
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("STUNNED", tx, ty - 27);
      ctx.textAlign = "start";
    }

    if (tower.level > 1) {
      const tier = getEntityTier(tower.level);
      const label = `Lv.${tower.level}`;
      ctx.font = "bold 8px Orbitron, sans-serif";
      const w = ctx.measureText(label).width + 8;
      // Small dark tag at the bottom edge of the tile so it never covers the turret
      ctx.fillStyle = "rgba(5, 8, 18, 0.85)";
      ctx.beginPath();
      ctx.roundRect(tx - w / 2, ty + 17, w, 10, 3);
      ctx.fill();
      ctx.fillStyle = tier === 3 ? "#fbbf24" : tier === 2 ? "#7dd3fc" : "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(label, tx, ty + 25);
      ctx.textAlign = "start";
    }
  }
}

function drawCreeps(ctx, creeps, time, ui) {
  // Shadows first so no creep's shadow covers another creep. Flyers cast a
  // smaller, offset shadow to show their altitude.
  for (const c of creeps) {
    ctx.fillStyle = c.flying ? "rgba(0, 0, 0, 0.28)" : "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    if (c.flying) ctx.ellipse(c.x + 9, c.y + c.radius + 10, c.radius * 0.7, c.radius * 0.25, 0, 0, Math.PI * 2);
    else ctx.ellipse(c.x + 2, c.y + c.radius * 0.7, c.radius * 0.9, c.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const creep of creeps) {
    const tier = getEntityTier(creep.level || 1);
    ctx.save();
    ctx.translate(creep.x, creep.y);

    if (!ui.lowQuality) drawGlow(ctx, 0, 0, creep.radius * 1.8, creep.color || "#ffffff", creep.isBoss ? 0.5 : 0.3);

    if (creep.isBoss) {
      const dread = Math.sin(time * 0.008) * 6;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, creep.radius + 8 + dread, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (creep.type === "aegis_vanguard") {
      // Shield aura matches its real gameplay radius
      const shimmer = 0.35 + Math.sin(time * 0.006) * 0.12;
      ctx.fillStyle = `rgba(6, 182, 212, ${shimmer * 0.25})`;
      ctx.strokeStyle = `rgba(6, 182, 212, ${shimmer + 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.save();
    if (DIRECTIONAL.has(creep.type) && creep.angle) ctx.rotate(creep.angle);
    drawCreepAsset(ctx, creep, time);
    ctx.restore();

    // Tier-3 elites: orbiting sparks
    if (tier === 3 && !ui.lowQuality) {
      for (let i = 0; i < 2; i++) {
        const a = time * 0.006 + i * Math.PI;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (creep.radius + 5), Math.sin(a) * (creep.radius + 5), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (creep.flash) {
      // Bright rim on impact (a fill would wash out bosses that are hit constantly)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, creep.radius * 0.95, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (creep.slowed) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, creep.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Health bar
    const hpPct = Math.max(0, creep.hp / creep.maxHp);
    const barW = creep.radius * 2.4;
    const barH = creep.isBoss ? 5 : 3.5;
    const barY = -creep.radius - (creep.isBoss ? 12 : 8);
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = hpPct > 0.5 ? "#22c55e" : hpPct > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

    if (creep.isBoss) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 9px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`BOSS Lv.${creep.level || 1}`, 0, barY - 4);
      ctx.textAlign = "start";
    } else if ((creep.level || 1) > 1) {
      // Elite pip instead of text: crowds stay readable, level shows in the art tier
      ctx.fillStyle = creep.level >= 10 ? "#fbbf24" : creep.level >= 5 ? "#ef4444" : "#f59e0b";
      ctx.beginPath();
      ctx.arc(-barW / 2 - 4, barY + barH / 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawShots(ctx, projectiles, beams, ui) {
  for (const p of projectiles) {
    if (p.kind === "bullet") {
      // Tracer streak behind the round
      if (p.dirX !== undefined) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dirX * 12, p.y - p.dirY * 12);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (!ui.lowQuality) drawGlow(ctx, p.x, p.y, 8, p.color, 0.7);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "mortar") {
      const gx = p.sx + (p.tx - p.sx) * p.progress;
      const gy = p.sy + (p.ty - p.sy) * p.progress;
      const my = gy + Math.sin(p.progress * Math.PI) * -60;
      // Ground shadow and target marker
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(gx, gy, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.25 + p.progress * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.tx, p.ty, p.radius * (1 - p.progress * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      drawGlow(ctx, gx, my, 14, "#f59e0b", 0.8);
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(gx, my, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const b of beams) {
    const alpha = Math.min(1, b.life / 120);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.kind === "laser" ? 4 : 2;
    ctx.beginPath();
    if (b.kind === "chain") {
      const segs = 5;
      ctx.moveTo(b.x1, b.y1);
      for (let i = 1; i < segs; i++) {
        const f = i / segs;
        const jitter = ((i * 7919 + Math.floor(b.life)) % 13) - 6;
        ctx.lineTo(b.x1 + (b.x2 - b.x1) * f + jitter, b.y1 + (b.y2 - b.y1) * f - jitter);
      }
      ctx.lineTo(b.x2, b.y2);
    } else {
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
    }
    ctx.stroke();
    if (b.kind === "laser") {
      // White-hot core of the railgun beam
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (!ui.lowQuality) drawGlow(ctx, b.x2, b.y2, b.kind === "laser" ? 16 : 10, b.color, alpha);
    ctx.globalAlpha = 1;
  }
}

export function drawBoard(ctx, scene, time, ui) {
  setGlowEnabled(!ui.lowQuality);
  drawGround(ctx, time, scene.frenzy, ui);
  drawPortal(ctx, time);
  drawCore(ctx, time, scene.coreHp);
  drawPlacement(ctx, ui, scene.towers, time);
  drawTowers(ctx, scene.towers, ui, time);
  // Ground creeps under the shots, flyers above everything
  drawCreeps(ctx, scene.creeps.filter((c) => !c.flying), time, ui);
  drawShots(ctx, scene.projectiles, scene.beams, ui);
  const flyers = scene.creeps.filter((c) => c.flying);
  if (flyers.length) drawCreeps(ctx, flyers, time, ui);
}
