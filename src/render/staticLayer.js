// Pre-rendered battlefield: circuit-board terrain, plated path corridor with
// glowing edges, portal and reactor pads. Built once per resolution and drawn
// with a single drawImage each frame.

import { GRID_COLS, GRID_ROWS, TILE_SIZE, BOARD_WIDTH, BOARD_HEIGHT, PIXEL_PATH, PATH_CELLS } from "../shared/config/map.js";
import { makeCanvas } from "./glow.js";

const cache = new Map(); // key: `${scale}|${detail}`

// Small deterministic RNG so the terrain looks the same on every screen
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tracePath(g) {
  g.beginPath();
  PIXEL_PATH.forEach((pt, i) => (i === 0 ? g.moveTo(pt.x, pt.y) : g.lineTo(pt.x, pt.y)));
}

function drawTerrain(g, detail) {
  // Base gradient with a slight vignette
  const bg = g.createRadialGradient(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 60, BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_WIDTH * 0.75);
  bg.addColorStop(0, "#0a1020");
  bg.addColorStop(1, "#04070f");
  g.fillStyle = bg;
  g.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // Build tiles: faint plates with bevels
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (PATH_CELLS.has(`${c},${r}`)) continue;
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;
      g.fillStyle = (c + r) % 2 === 0 ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.008)";
      g.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      g.strokeStyle = "rgba(0, 240, 255, 0.06)";
      g.lineWidth = 1;
      g.strokeRect(x + 2.5, y + 2.5, TILE_SIZE - 5, TILE_SIZE - 5);
    }
  }

  if (!detail) return;

  // Circuit traces between tile corners
  const rnd = seeded(0xc0ffee);
  g.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    const c = Math.floor(rnd() * GRID_COLS);
    const r = Math.floor(rnd() * GRID_ROWS);
    if (PATH_CELLS.has(`${c},${r}`)) continue;
    const x = c * TILE_SIZE + 8 + rnd() * (TILE_SIZE - 16);
    const y = r * TILE_SIZE + 8 + rnd() * (TILE_SIZE - 16);
    const horizontal = rnd() > 0.5;
    const len = 8 + rnd() * 18;
    g.strokeStyle = rnd() > 0.75 ? "rgba(168, 85, 247, 0.16)" : "rgba(0, 240, 255, 0.13)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y);
    const mx = horizontal ? x + len : x;
    const my = horizontal ? y : y + len;
    g.lineTo(mx, my);
    g.lineTo(mx + (horizontal ? 6 : 6), my + (horizontal ? 6 : 6));
    g.stroke();
    g.fillStyle = "rgba(0, 240, 255, 0.22)";
    g.beginPath();
    g.arc(x, y, 1.6, 0, Math.PI * 2);
    g.fill();
  }
}

function drawCorridor(g, detail) {
  g.lineCap = "round";
  g.lineJoin = "round";
  const stroke = (style, width) => {
    g.strokeStyle = style;
    g.lineWidth = width;
    tracePath(g);
    g.stroke();
  };

  stroke("rgba(0, 240, 255, 0.08)", TILE_SIZE * 0.98); // outer haze
  stroke("rgba(0, 240, 255, 0.38)", TILE_SIZE * 0.78 + 3); // neon rails (edges)
  stroke("#0c1426", TILE_SIZE * 0.78); // plated floor
  stroke("#101b31", TILE_SIZE * 0.56); // worn centre lane

  if (!detail) return;

  // Plate seams across the corridor every half tile
  g.strokeStyle = "rgba(0, 0, 0, 0.5)";
  g.lineWidth = 1.5;
  for (let i = 1; i < PIXEL_PATH.length; i++) {
    const a = PIXEL_PATH[i - 1];
    const b = PIXEL_PATH[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const half = TILE_SIZE * 0.36;
    for (let d = TILE_SIZE / 2; d < len; d += TILE_SIZE / 2) {
      const px = a.x + ((b.x - a.x) * d) / len;
      const py = a.y + ((b.y - a.y) * d) / len;
      g.beginPath();
      g.moveTo(px + nx * half, py + ny * half);
      g.lineTo(px - nx * half, py - ny * half);
      g.stroke();
    }
  }
}


// Faint chevrons along the flyers' straight route, so players know where to put anti-air
function drawAirLane(g) {
  const a = PIXEL_PATH[0];
  const b = PIXEL_PATH[PIXEL_PATH.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  g.save();
  g.translate(a.x, a.y);
  g.rotate(ang);
  g.strokeStyle = "rgba(56, 189, 248, 0.16)";
  g.lineWidth = 1.5;
  for (let d = 40; d < len - 30; d += 26) {
    g.beginPath();
    g.moveTo(d - 4, -5);
    g.lineTo(d + 2, 0);
    g.lineTo(d - 4, 5);
    g.stroke();
  }
  g.restore();
}

function drawPads(g) {
  // Portal pad
  const portal = PIXEL_PATH[0];
  g.fillStyle = "rgba(168, 85, 247, 0.12)";
  g.beginPath();
  g.arc(portal.x, portal.y, 24, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(168, 85, 247, 0.4)";
  g.lineWidth = 1.5;
  g.stroke();

  // Reactor pad: hexagonal base plate
  const core = PIXEL_PATH[PIXEL_PATH.length - 1];
  g.fillStyle = "#0b1426";
  g.strokeStyle = "rgba(0, 240, 255, 0.45)";
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    g[i === 0 ? "moveTo" : "lineTo"](core.x + Math.cos(a) * 30, core.y + Math.sin(a) * 30);
  }
  g.closePath();
  g.fill();
  g.stroke();
}

// Returns a canvas of the static board at `scale` (device pixels per world pixel).
export function groundLayer(scale, detail = true) {
  const key = `${scale.toFixed(3)}|${detail}`;
  let layer = cache.get(key);
  if (!layer) {
    if (cache.size > 6) cache.clear();
    layer = makeCanvas(Math.max(1, Math.round(BOARD_WIDTH * scale)), Math.max(1, Math.round(BOARD_HEIGHT * scale)));
    const g = layer.getContext("2d");
    g.setTransform(scale, 0, 0, scale, 0, 0);
    drawTerrain(g, detail);
    drawCorridor(g, detail);
    drawAirLane(g);
    drawPads(g);
    cache.set(key, layer);
  }
  return layer;
}
