// Draws one battlefield from a scene description. No game logic lives here: the
// own lane's scene comes from the local simulation, the enemy's from snapshots.
//
// scene = { creeps, towers, projectiles, beams, frenzy, coreHp }
// ui    = { interactive, hover: {x,y}|null, ghostType, ghostOk, selectedTowerId, showRanges }

import { GRID_COLS, GRID_ROWS, TILE_SIZE, BOARD_WIDTH, BOARD_HEIGHT, PIXEL_PATH } from "../shared/config/map.js";
import { getTowerDefinition } from "../shared/config/towers.js";
import { towerRange } from "../shared/balance.js";
import { drawTowerAsset, drawCreepAsset, getEntityTier } from "./gameAssets.js";

function tracePath(ctx) {
  ctx.beginPath();
  PIXEL_PATH.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
}

function drawGround(ctx, time, frenzy) {
  ctx.fillStyle = "#070b14";
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.strokeStyle = "rgba(0, 240, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= GRID_COLS; c++) {
    ctx.moveTo(c * TILE_SIZE, 0);
    ctx.lineTo(c * TILE_SIZE, BOARD_HEIGHT);
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    ctx.moveTo(0, r * TILE_SIZE);
    ctx.lineTo(BOARD_WIDTH, r * TILE_SIZE);
  }
  ctx.stroke();

  // Path corridor
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = TILE_SIZE * 0.72;
  ctx.strokeStyle = "rgba(15, 23, 42, 0.95)";
  tracePath(ctx);
  ctx.stroke();

  const edge = frenzy ? "245, 158, 11" : "0, 240, 255";
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(${edge}, 0.35)`;
  tracePath(ctx);
  ctx.stroke();

  // Animated energy pulse along the path
  ctx.setLineDash([12, 28]);
  ctx.lineDashOffset = -((time * (frenzy ? 0.14 : 0.08)) % 40);
  ctx.strokeStyle = `rgba(${edge}, 0.7)`;
  ctx.lineWidth = 2.5;
  tracePath(ctx);
  ctx.stroke();
  ctx.setLineDash([]);

  // Spawn portal
  const portal = PIXEL_PATH[0];
  const spin = time * 0.003;
  ctx.save();
  ctx.translate(portal.x, portal.y);
  ctx.rotate(spin);
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(-spin * 2);
  ctx.strokeStyle = "#00f0ff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-10, -10, 20, 20);
  ctx.restore();
}

function drawCore(ctx, time, hp) {
  const core = PIXEL_PATH[PIXEL_PATH.length - 1];
  const ratio = Math.max(0, hp) / 100;
  const color = ratio > 0.5 ? "#00f0ff" : ratio > 0.25 ? "#f59e0b" : "#ef4444";
  const pulse = Math.sin(time * 0.005) * 3;
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 16 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
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
  ctx.stroke();
}

function drawPlacement(ctx, ui, towers) {
  const { hover } = ui;
  if (!ui.interactive || !hover) return;
  const px = hover.x * TILE_SIZE;
  const py = hover.y * TILE_SIZE;
  if (ui.ghostType) {
    const ok = ui.ghostOk;
    ctx.fillStyle = ok ? "rgba(34, 197, 94, 0.22)" : "rgba(239, 68, 68, 0.22)";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = ok ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 0.75, py + 0.75, TILE_SIZE - 1.5, TILE_SIZE - 1.5);
    const def = getTowerDefinition(ui.ghostType);
    if (ok && def) drawRange(ctx, px + TILE_SIZE / 2, py + TILE_SIZE / 2, def.range);
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

    drawTowerAsset(ctx, tower, def, tx, ty, selected, time);

    if (tower.stunned) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -time * 0.02;
      ctx.beginPath();
      ctx.arc(tx, ty, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("STUNNED", tx, ty - 26);
      ctx.textAlign = "start";
    }

    if (tower.level > 1) {
      const tier = getEntityTier(tower.level);
      ctx.fillStyle = tier === 3 ? "#f59e0b" : tier === 2 ? "#38bdf8" : "#fbbf24";
      ctx.font = `bold ${tier === 3 ? 11 : 10}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`Lv.${tower.level}`, tx, ty + 22);
      ctx.textAlign = "start";
    }
  }
}

function drawCreeps(ctx, creeps, time) {
  for (const creep of creeps) {
    ctx.save();
    ctx.translate(creep.x, creep.y);

    if (creep.isBoss) {
      const dread = Math.sin(time * 0.008) * 6;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, creep.radius + 8 + dread, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (creep.type === "aegis_vanguard") {
      ctx.strokeStyle = "rgba(6, 182, 212, 0.55)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawCreepAsset(ctx, creep, time);

    if (creep.flash) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, creep.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    if (creep.slowed) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, creep.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Health bar
    const hpPct = Math.max(0, creep.hp / creep.maxHp);
    const barW = creep.radius * 2.4;
    const barH = creep.isBoss ? 5 : 3.5;
    const barY = -creep.radius - (creep.isBoss ? 12 : 8);
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(-barW / 2, barY, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? "#22c55e" : hpPct > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

    if (creep.isBoss) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 9px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`BOSS Lv.${creep.level || 1}`, 0, barY - 4);
      ctx.textAlign = "start";
    } else if ((creep.level || 1) > 1) {
      ctx.fillStyle = creep.level >= 3 ? "#ef4444" : "#f59e0b";
      ctx.font = "bold 8px Orbitron, sans-serif";
      ctx.fillText(`Lv.${creep.level}`, -barW / 2, barY - 3);
    }
    ctx.restore();
  }
}

function drawShots(ctx, projectiles, beams) {
  for (const p of projectiles) {
    if (p.kind === "bullet") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "mortar") {
      const mx = p.sx + (p.tx - p.sx) * p.progress;
      const arc = Math.sin(p.progress * Math.PI) * -60;
      const my = p.sy + (p.ty - p.sy) * p.progress + arc;
      // Ground shadow shows where the shell will land
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(p.sx + (p.tx - p.sx) * p.progress, p.sy + (p.ty - p.sy) * p.progress, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const b of beams) {
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = Math.min(1, b.life / 120);
    ctx.lineWidth = b.kind === "laser" ? 4 : 2;
    ctx.beginPath();
    if (b.kind === "chain") {
      // Jagged lightning
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
    ctx.globalAlpha = 1;
  }
}

export function drawBoard(ctx, scene, time, ui) {
  drawGround(ctx, time, scene.frenzy);
  drawCore(ctx, time, scene.coreHp);
  drawPlacement(ctx, ui, scene.towers);
  drawTowers(ctx, scene.towers, ui, time);
  drawCreeps(ctx, scene.creeps, time);
  drawShots(ctx, scene.projectiles, scene.beams);
}
