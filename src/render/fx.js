// Visual + audio effects driven by simulation events. Pooled and capped so long
// matches and big waves can't grow memory or tank the frame rate.

import { sound } from "../audio/soundFx.js";
import { drawGlow } from "./glow.js";
import { BOARD_WIDTH, BOARD_HEIGHT } from "../shared/config/map.js";

const TOWER_FLASH = { gatling: "#00f0ff", cryo: "#38bdf8", plasma: "#f59e0b", tesla: "#c084fc", railgun: "#f43f5e" };

const QUALITY = {
  high: { maxParticles: 320, maxTexts: 50, scale: 1 },
  low: { maxParticles: 90, maxTexts: 20, scale: 0.45 },
};

export function createFx({ audible = true, volume = 1 } = {}) {
  const particles = [];
  const texts = [];
  const rings = [];
  const flashes = [];
  let bossWarning = 0;
  let quality = QUALITY.high;
  let shake = 0;
  let showDamage = true;

  function burst(x, y, color, count) {
    const n = Math.max(1, Math.round(count * quality.scale));
    for (let i = 0; i < n; i++) {
      if (particles.length >= quality.maxParticles) particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 80 + 30;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, size: Math.random() * 3 + 1.5, alpha: 1 });
    }
  }

  function text(str, x, y, color, big = false) {
    if (texts.length >= quality.maxTexts) texts.shift();
    texts.push({ text: str, x, y, color, alpha: 1, big });
  }

  const play = (fn, ...args) => audible && fn.apply(sound, args);

  return {
    setQuality(q) {
      quality = QUALITY[q] || QUALITY.high;
    },
    setShowDamage(v) {
      showDamage = v;
    },
    shake(amount) {
      shake = Math.max(shake, amount);
    },

    consume(events) {
      for (const e of events) {
        switch (e.type) {
          case "fire": {
            if (e.towerType === "plasma") play(sound.playMortar, 0.6 * volume);
            else play(sound.playLaser, 0.7 * volume);
            // Muzzle flash at the barrel tip
            const d = Math.hypot(e.tx - e.x, e.ty - e.y) || 1;
            const reach = e.towerType === "railgun" ? 26 : 20;
            if (flashes.length < 40) {
              flashes.push({ x: e.x + ((e.tx - e.x) / d) * reach, y: e.y + ((e.ty - e.y) / d) * reach, life: 70, color: TOWER_FLASH[e.towerType] || "#ffffff" });
            }
            break;
          }
          case "bossWarning":
            bossWarning = 2600;
            play(sound.playAlarm);
            break;
          case "hit":
            if (showDamage) text(`-${e.amount}`, e.x + (Math.random() * 12 - 6), e.y - 12, e.color || "#ffffff");
            break;
          case "explode":
            play(sound.playMortar, volume);
            burst(e.x, e.y, "#f59e0b", 30);
            rings.push({ x: e.x, y: e.y, r: 6, max: e.radius, alpha: 0.8, color: "245, 158, 11" });
            break;
          case "killed":
            play(sound.playExplosion, volume);
            burst(e.x, e.y, e.color || "#ffffff", e.isBoss ? 40 : 16);
            if (e.bounty) text(`+$${e.bounty}`, e.x, e.y - 18, "#fbbf24", e.isBoss);
            if (e.isBoss) shake = Math.max(shake, 8);
            break;
          case "leaked":
            play(sound.playAlarm);
            burst(e.x, e.y, "#ef4444", e.isBoss ? 45 : 18);
            rings.push({ x: e.x, y: e.y, r: 10, max: e.isBoss ? 90 : 45, alpha: 0.9, color: "239, 68, 68" });
            shake = Math.max(shake, e.isBoss ? 10 : 3);
            break;
          case "demolished":
            play(sound.playExplosion, volume);
            burst(e.x, e.y, "#ef4444", 45);
            burst(e.x, e.y, "#f97316", 30);
            burst(e.x, e.y, "#ffffff", 20);
            text("DEMOLISHED!", e.x - 30, e.y - 18, "#ef4444", true);
            shake = Math.max(shake, 7);
            break;
          case "heal":
            rings.push({ x: e.x, y: e.y, r: 8, max: e.radius, alpha: 0.6, color: "244, 114, 182" });
            text("+", e.x - 3, e.y - 14, "#f9a8d4", true);
            break;
          case "pulse":
            play(sound.playAlarm);
            rings.push({ x: e.x, y: e.y, r: 10, max: e.radius, alpha: 1, color: "163, 230, 53" });
            burst(e.x, e.y, "#bef264", 24);
            shake = Math.max(shake, 4);
            break;
          case "airburst":
            rings.push({ x: e.x, y: e.y, r: 4, max: e.radius, alpha: 0.8, color: "232, 121, 249" });
            burst(e.x, e.y, "#f5d0fe", 10);
            break;
          case "emp":
            burst(e.x, e.y, "#38bdf8", 18);
            break;
          default:
            break;
        }
      }
    },

    update(dtMs) {
      const dt = dtMs / 1000;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= dt * 1.5;
        if (p.alpha <= 0) particles.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.y -= 25 * dt;
        t.alpha -= dt * 1.2;
        if (t.alpha <= 0) texts.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += (r.max - r.r) * Math.min(1, dt * 8);
        r.alpha -= dt * 2.2;
        if (r.alpha <= 0) rings.splice(i, 1);
      }
      shake = Math.max(0, shake - dt * 30);
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].life -= dtMs;
        if (flashes[i].life <= 0) flashes.splice(i, 1);
      }
      bossWarning = Math.max(0, bossWarning - dtMs);
    },

    // Offset to apply to the whole board this frame
    shakeOffset(reducedMotion) {
      if (reducedMotion || shake <= 0) return { x: 0, y: 0 };
      return { x: (Math.random() - 0.5) * shake, y: (Math.random() - 0.5) * shake };
    },

    draw(ctx) {
      for (const f of flashes) {
        const a = f.life / 70;
        drawGlow(ctx, f.x, f.y, 12, f.color, a);
        ctx.globalAlpha = a;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      for (const r of rings) {
        ctx.strokeStyle = `rgba(${r.color}, ${Math.max(0, r.alpha)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const t of texts) {
        ctx.globalAlpha = Math.max(0, t.alpha);
        ctx.font = t.big ? "bold 15px Rajdhani, sans-serif" : "bold 12px Rajdhani, sans-serif";
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },

    // Screen-space overlays (drawn last, unaffected by particles)
    drawOverlay(ctx, time) {
      if (bossWarning <= 0) return;
      const fade = Math.min(1, bossWarning / 400, (2600 - bossWarning) / 200 + 0.2);
      const blink = 0.65 + Math.sin(time * 0.018) * 0.35;
      // Red edge vignette
      const grad = ctx.createRadialGradient(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_HEIGHT * 0.35, BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_WIDTH * 0.62);
      grad.addColorStop(0, "rgba(239, 68, 68, 0)");
      grad.addColorStop(1, `rgba(239, 68, 68, ${0.35 * fade * blink})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      ctx.globalAlpha = fade;
      ctx.fillStyle = "rgba(20, 4, 8, 0.85)";
      ctx.fillRect(BOARD_WIDTH / 2 - 120, 14, 240, 30);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(BOARD_WIDTH / 2 - 120, 14, 240, 30);
      ctx.fillStyle = `rgba(254, 202, 202, ${blink})`;
      ctx.font = "900 15px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠ BOSS INBOUND ⚠", BOARD_WIDTH / 2, 35);
      ctx.textAlign = "start";
      ctx.globalAlpha = 1;
    },

    counts: () => ({ particles: particles.length, texts: texts.length, rings: rings.length }),
  };
}
