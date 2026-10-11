// Turret art. Every tower has its own base shape and silhouette (not just a new
// colour), and visibly evolves at level 5 (tier 2) and level 10 (tier 3).
//
//   Gatling  - armoured square bunker, rotating multi-barrel drum
//   Cryo     - hexagonal ice dais with shards, floating crystal emitter
//   Plasma   - round artillery pit with struts, wide mortar tube(s)
//   Tesla    - triangular base with three pylons, stacked coil spire, live arcs
//   Railgun  - long braced platform with capacitor cells, twin magnetic rails
//   Flak     - octagonal AA emplacement, spinning radar, quad cannons

import { drawGlow } from "./glow.js";

export function tierOf(level = 1) {
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return 1;
}

const GOLD = "#fbbf24";
const STEEL_DARK = "#0b1220";
const STEEL = "#1e293b";
const STEEL_LIGHT = "#334155";

function poly(ctx, sides, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    ctx[i === 0 ? "moveTo" : "lineTo"](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function plate(ctx, fill, stroke, width) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function tierTrim(ctx, tier, r, time) {
  if (tier < 3) return;
  const pulse = 0.55 + Math.sin(time * 0.006) * 0.25;
  ctx.strokeStyle = `rgba(251, 191, 36, ${pulse})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
  ctx.stroke();
}

// ------------------------------------------------------------------ GATLING
function gatling(ctx, def, tier, angle, time, selected) {
  // Chamfered armoured bunker
  const s = 19;
  const c = 6;
  ctx.beginPath();
  ctx.moveTo(-s + c, -s);
  ctx.lineTo(s - c, -s);
  ctx.lineTo(s, -s + c);
  ctx.lineTo(s, s - c);
  ctx.lineTo(s - c, s);
  ctx.lineTo(-s + c, s);
  ctx.lineTo(-s, s - c);
  ctx.lineTo(-s, -s + c);
  ctx.closePath();
  plate(ctx, STEEL, selected ? "#00f0ff" : tier === 3 ? GOLD : def.accent, selected ? 2.5 : 1.8);
  // Inner armour plate + hazard stripes on the front edge
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-s + 5, -s + 5, (s - 5) * 2, (s - 5) * 2);
  if (tier >= 2) {
    ctx.fillStyle = tier === 3 ? GOLD : "#facc15";
    for (let i = -2; i <= 1; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-s + 4, s - 5, (s - 4) * 2, 3);
      ctx.clip();
      ctx.fillRect(i * 9 + 2, s - 5, 4, 3);
      ctx.restore();
    }
  }
  tierTrim(ctx, tier, s + 1, time);

  // Turret: housing + spinning barrel drum
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = STEEL_DARK;
  ctx.beginPath();
  ctx.roundRect(-9, -9, 16, 18, 4);
  ctx.fill();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Ammo box on the side
  ctx.fillStyle = tier === 3 ? GOLD : STEEL_LIGHT;
  ctx.fillRect(-7, -13, 9, 4);

  const barrels = tier + 1; // 2, 3, 4 barrels
  const spin = time * 0.03;
  const spread = 7;
  ctx.lineCap = "round";
  for (let i = 0; i < barrels; i++) {
    const phase = spin + (i * Math.PI * 2) / barrels;
    const y = Math.sin(phase) * (spread / 2);
    const depth = Math.cos(phase); // barrels behind look darker
    ctx.strokeStyle = depth > 0 ? "#94a3b8" : "#475569";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(5, y);
    ctx.lineTo(22, y);
    ctx.stroke();
  }
  // Muzzle ring
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(22, 0, 2.5, spread / 2 + 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Sight
  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.arc(-3, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --------------------------------------------------------------------- CRYO
function cryo(ctx, def, tier, angle, time, selected) {
  // Hexagonal ice dais
  poly(ctx, 6, 21, Math.PI / 6);
  const grad = ctx.createLinearGradient(-20, -20, 20, 20);
  grad.addColorStop(0, "#0c4a6e");
  grad.addColorStop(1, "#082f49");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = selected ? "#00f0ff" : tier === 3 ? GOLD : "#7dd3fc";
  ctx.lineWidth = selected ? 2.5 : 1.8;
  ctx.stroke();
  poly(ctx, 6, 14, Math.PI / 6);
  ctx.strokeStyle = "rgba(186, 230, 253, 0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Ice shards at the corners (3 / 4 / 6 by tier)
  const shards = tier === 1 ? 3 : tier === 2 ? 4 : 6;
  for (let i = 0; i < shards; i++) {
    const a = Math.PI / 6 + (i * Math.PI * 2) / shards;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(19, 0);
    ctx.fillStyle = "#bae6fd";
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-2, -3.5);
    ctx.lineTo(-2, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  tierTrim(ctx, tier, 22, time);

  // Slowly turning frost ring
  ctx.save();
  ctx.rotate(time * 0.0015);
  ctx.strokeStyle = "rgba(125, 211, 252, 0.6)";
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Floating crystal emitter that faces the target, bobbing slightly
  const bob = Math.sin(time * 0.004) * 1.2;
  ctx.save();
  ctx.rotate(angle);
  ctx.translate(0, bob);
  drawGlow(ctx, 6, 0, 16, "#38bdf8", 0.7);
  ctx.fillStyle = "#e0f2fe";
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(2, -6);
  ctx.lineTo(-6, 0);
  ctx.lineTo(2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(14, 116, 144, 0.8)";
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.lineTo(2, 6);
  ctx.stroke();
  ctx.restore();

  if (tier === 3) {
    for (let i = 0; i < 3; i++) {
      const a = time * 0.002 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = "#f0f9ff";
      ctx.fillRect(Math.cos(a) * 16 - 1, Math.sin(a) * 16 - 1, 2, 2);
    }
  }
}

// ------------------------------------------------------------------- PLASMA
function plasma(ctx, def, tier, angle, time, selected) {
  // Round artillery pit with struts
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate(Math.PI / 4 + (i * Math.PI) / 2);
    ctx.fillStyle = STEEL_LIGHT;
    ctx.fillRect(14, -3, 8, 6);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  plate(ctx, "#1c1408", selected ? "#00f0ff" : tier === 3 ? GOLD : def.accent, selected ? 2.5 : 2);
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  tierTrim(ctx, tier, 19, time);

  // Mortar tube(s): wide and short, with a glowing shell in the mouth
  const tubes = tier;
  const offsets = tubes === 1 ? [0] : tubes === 2 ? [-5.5, 5.5] : [-7, 0, 7];
  const glow = 0.6 + Math.sin(time * 0.008) * 0.3;
  ctx.save();
  ctx.rotate(angle);
  for (const oy of offsets) {
    const w = tubes === 1 ? 12 : tubes === 2 ? 9 : 7;
    const grad = ctx.createLinearGradient(0, oy - w / 2, 0, oy + w / 2);
    grad.addColorStop(0, "#57534e");
    grad.addColorStop(0.5, "#a8a29e");
    grad.addColorStop(1, "#44403c");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-4, oy - w / 2, 19, w, 3);
    ctx.fill();
    ctx.fillStyle = `rgba(253, 230, 138, ${glow})`;
    ctx.beginPath();
    ctx.ellipse(15, oy, 2.5, w / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawGlow(ctx, 15, 0, 12, "#f59e0b", glow * 0.8);
  // Breech block
  ctx.fillStyle = STEEL;
  ctx.beginPath();
  ctx.arc(-3, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// -------------------------------------------------------------------- TESLA
function tesla(ctx, def, tier, angle, time, selected) {
  // Triangular base with three pylons
  poly(ctx, 3, 22, -Math.PI / 2);
  plate(ctx, "#140b24", selected ? "#00f0ff" : tier === 3 ? GOLD : def.accent, selected ? 2.5 : 1.8);
  const pylons = [0, 1, 2].map((i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    return { x: Math.cos(a) * 17, y: Math.sin(a) * 17 };
  });
  for (const p of pylons) {
    drawGlow(ctx, p.x, p.y, 7, "#c084fc", 0.6);
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  tierTrim(ctx, tier, 20, time);

  // Coil spire seen from above: stacked rings
  const rings = tier + 2; // 3, 4, 5
  for (let i = 0; i < rings; i++) {
    const r = 12 - i * (8 / rings);
    ctx.strokeStyle = i % 2 ? "#a78bfa" : "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Charged top sphere
  const charge = 0.6 + Math.sin(time * 0.012) * 0.3;
  drawGlow(ctx, 0, 0, 16, "#c084fc", charge);
  ctx.fillStyle = "#f5f3ff";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Crackling arcs to the pylons (flicker)
  ctx.strokeStyle = "rgba(233, 213, 255, 0.85)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < pylons.length; i++) {
    if (Math.sin(time * 0.03 + i * 2.1) < 0.2) continue;
    const p = pylons[i];
    const jig = Math.sin(time * 0.05 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(p.x * 0.5 + jig, p.y * 0.5 - jig);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  // Small emitter prong points at the current target
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = "#c4b5fd";
  ctx.fillRect(4, -1.2, 9, 2.4);
  ctx.restore();
}

// ------------------------------------------------------------------ RAILGUN
function railgun(ctx, def, tier, angle, time, selected) {
  // Braced square platform with capacitor cells
  const s = 19;
  ctx.beginPath();
  ctx.roundRect(-s, -s, s * 2, s * 2, 5);
  plate(ctx, "#1a0b10", selected ? "#00f0ff" : tier === 3 ? GOLD : def.accent, selected ? 2.5 : 1.8);
  ctx.strokeStyle = "rgba(244, 63, 94, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-s + 3, -s + 3);
  ctx.lineTo(s - 3, s - 3);
  ctx.moveTo(s - 3, -s + 3);
  ctx.lineTo(-s + 3, s - 3);
  ctx.stroke();
  // Capacitor cells fill up in a cycle (charging look)
  const cells = tier + 2;
  const charge = (time * 0.0006) % 1;
  for (let i = 0; i < cells; i++) {
    const lit = i / cells < charge;
    ctx.fillStyle = lit ? "#fb7185" : "#3f1d26";
    ctx.fillRect(-s + 4 + i * ((s * 2 - 8) / cells), s - 7, (s * 2 - 8) / cells - 2, 3.5);
  }
  tierTrim(ctx, tier, s + 2, time);

  // Twin magnetic rails, long barrel
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = STEEL_DARK;
  ctx.beginPath();
  ctx.roundRect(-10, -7, 14, 14, 3);
  ctx.fill();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const length = tier === 3 ? 32 : tier === 2 ? 30 : 27;
  ctx.fillStyle = "#64748b";
  ctx.fillRect(2, -5, length, 2.5);
  ctx.fillRect(2, 2.5, length, 2.5);
  // Energised slug channel between the rails
  drawGlow(ctx, length / 2 + 2, 0, 12, "#f43f5e", 0.4 + charge * 0.5);
  ctx.fillStyle = `rgba(254, 205, 211, ${0.4 + charge * 0.6})`;
  ctx.fillRect(4, -1, length - 4, 2);
  // Coil rings along the rails
  ctx.strokeStyle = tier === 3 ? GOLD : def.color;
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= tier + 1; i++) {
    const x = 4 + (i * (length - 4)) / (tier + 2);
    ctx.strokeRect(x - 1.5, -6.5, 3, 13);
  }
  ctx.restore();
}

// --------------------------------------------------------------------- FLAK
function flak(ctx, def, tier, angle, time, selected) {
  // Octagonal anti-air emplacement
  poly(ctx, 8, 21, Math.PI / 8);
  plate(ctx, "#1d0b22", selected ? "#00f0ff" : tier === 3 ? GOLD : def.accent, selected ? 2.5 : 1.8);
  poly(ctx, 8, 15, Math.PI / 8);
  ctx.strokeStyle = "rgba(232, 121, 249, 0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  tierTrim(ctx, tier, 21, time);

  // Spinning radar dish in the back corner
  ctx.save();
  ctx.translate(-12, 12);
  ctx.rotate(time * 0.004);
  ctx.strokeStyle = "#f5d0fe";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 5, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(5, 0);
  ctx.stroke();
  ctx.restore();

  // Quad cannons in two pairs, pointing at the target
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = STEEL_DARK;
  ctx.beginPath();
  ctx.roundRect(-8, -10, 14, 20, 4);
  ctx.fill();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const rows = tier === 1 ? [-6, 6] : tier === 2 ? [-7, -3, 3, 7] : [-8, -4, 0, 4, 8];
  ctx.fillStyle = "#94a3b8";
  for (const y of rows) ctx.fillRect(4, y - 1, 15, 2);
  ctx.fillStyle = def.color;
  for (const y of rows) ctx.fillRect(18, y - 1.5, 3, 3);
  drawGlow(ctx, -1, 0, 9, "#e879f9", 0.5);
  ctx.fillStyle = "#fae8ff";
  ctx.beginPath();
  ctx.arc(-1, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const ART = { gatling, cryo, plasma, tesla, railgun, flak };

export function drawTurret(ctx, tower, def, x, y, selected, time) {
  const tier = tierOf(tower.level || 1);
  ctx.save();
  ctx.translate(x, y);
  // Energy bleed under the base: brighter as the turret is upgraded
  drawGlow(ctx, 0, 0, tier === 3 ? 34 : tier === 2 ? 30 : 26, tier === 3 ? "#f59e0b" : def.color, tier === 3 ? 0.55 : tier === 2 ? 0.4 : 0.22);
  (ART[tower.type] || gatling)(ctx, def, tier, tower.targetAngle ?? -Math.PI / 2, time, selected);
  ctx.restore();
}
