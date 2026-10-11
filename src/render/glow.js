// Cached glow sprites: a soft radial gradient rendered once per color, then
// stamped with drawImage. Looks like bloom and costs far less than shadowBlur,
// which re-blurs every frame (the main reason the old art was slow on phones).

const SIZE = 64;
const cache = new Map();

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function hexToRgb(color) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "255, 255, 255";
}

export function glowSprite(color) {
  let sprite = cache.get(color);
  if (!sprite) {
    sprite = makeCanvas(SIZE, SIZE);
    const g = sprite.getContext("2d");
    const rgb = hexToRgb(color);
    const grad = g.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    grad.addColorStop(0, `rgba(${rgb}, 0.85)`);
    grad.addColorStop(0.35, `rgba(${rgb}, 0.35)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    cache.set(color, sprite);
  }
  return sprite;
}

let glowEnabled = true;
export function setGlowEnabled(on) {
  glowEnabled = on;
}

// Draws a glow of `radius` centred on (x, y) in the current transform.
export function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  if (!glowEnabled || radius <= 0) return;
  const prevAlpha = ctx.globalAlpha;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalAlpha = prevAlpha * alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevOp;
}

export { makeCanvas };
