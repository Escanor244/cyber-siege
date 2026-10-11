// "Auto" graphics quality: if frames stay slow, switch to the light profile
// (fewer particles, 1x canvas resolution). Once lowered it stays low for the session.

import { settings } from "../lib/settings.js";

const SLOW_FRAME_MS = 24;
const SLOW_STREAK = 150; // ~3-4 seconds of struggling before downgrading

let autoLow = false;
let ema = 16;
let slowFrames = 0;
const listeners = new Set();

export function isLowQuality() {
  const q = settings.get().quality;
  return q === "low" || (q === "auto" && autoLow);
}

export function reportFrame(dtMs) {
  if (autoLow || settings.get().quality !== "auto" || dtMs <= 0 || dtMs > 250) return;
  ema = ema * 0.95 + dtMs * 0.05;
  slowFrames = ema > SLOW_FRAME_MS ? slowFrames + 1 : 0;
  if (slowFrames > SLOW_STREAK) {
    autoLow = true;
    for (const l of listeners) l();
  }
}

export function onQualityChange(fn) {
  listeners.add(fn);
  const off = settings.subscribe(fn);
  return () => {
    listeners.delete(fn);
    off();
  };
}
