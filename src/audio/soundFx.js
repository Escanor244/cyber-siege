// Web Audio procedural synthesizer for Cyber Siege.
// The tones are the original ones; this layer adds a master volume, a voice cap and
// per-sound throttling so twenty gatlings firing at once can't flood the audio
// thread (a real problem on phones), plus an unlock on first touch for iOS.

const THROTTLE_MS = {
  laser: 60,
  mortar: 90,
  explosion: 70,
  coin: 120,
  upgrade: 120,
  alarm: 400,
  victory: 1000,
  wave: 800,
  build: 80,
};
const MAX_VOICES = 10;
const STORAGE_KEY = "cybersiege_audio";

class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.isMuted = false;
    this.volume = 0.8;
    this.voices = 0;
    this.lastPlayed = {};
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) {
        this.isMuted = !!saved.muted;
        if (typeof saved.volume === "number") this.volume = Math.min(1, Math.max(0, saved.volume));
      }
    } catch {
      /* storage unavailable */
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: this.isMuted, volume: this.volume }));
    } catch {
      /* storage unavailable */
    }
  }

  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  // Browsers only allow audio after a user gesture; call once at startup.
  installUnlock() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      this.init();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.save();
    return this.isMuted;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.volume;
    this.save();
  }

  // Common gate: muted, throttled or too many voices -> skip.
  begin(name, gainScale = 1) {
    if (this.isMuted || this.volume <= 0) return null;
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return null;
    const t = this.ctx.currentTime * 1000;
    if (t - (this.lastPlayed[name] || -1e9) < (THROTTLE_MS[name] || 0)) return null;
    if (this.voices >= MAX_VOICES) return null;
    this.lastPlayed[name] = t;
    return { ctx: this.ctx, now: this.ctx.currentTime, scale: gainScale };
  }

  track(node) {
    this.voices += 1;
    node.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
    };
  }

  voice({ ctx, now, scale }, { type, freqs, gain, dur, ramp = "exp", start = 0 }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = now + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freqs[0], t);
    if (freqs[1] !== undefined) {
      if (ramp === "exp") osc.frequency.exponentialRampToValueAtTime(freqs[1], t + dur);
      else if (ramp === "lin") osc.frequency.linearRampToValueAtTime(freqs[1], t + (freqs[2] ?? dur));
      else osc.frequency.setValueAtTime(freqs[1], t + ramp);
    }
    g.gain.setValueAtTime(gain * scale, t);
    g.gain.exponentialRampToValueAtTime(0.01 * scale || 0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    this.track(osc);
    osc.start(t);
    osc.stop(t + dur);
  }

  playLaser(scale = 1) {
    const s = this.begin("laser", scale);
    if (s) this.voice(s, { type: "sawtooth", freqs: [880, 110], gain: 0.15, dur: 0.12 });
  }

  playMortar(scale = 1) {
    const s = this.begin("mortar", scale);
    if (s) this.voice(s, { type: "sine", freqs: [150, 40], gain: 0.35, dur: 0.35 });
  }

  playExplosion(scale = 1) {
    const s = this.begin("explosion", scale);
    if (!s) return;
    const { ctx, now } = s;
    if (!this.noise) {
      const size = Math.floor(ctx.sampleRate * 0.25);
      this.noise = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 * scale, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    this.track(src);
    src.start();
    src.stop(now + 0.25);
  }

  playCoin() {
    const s = this.begin("coin");
    if (s) this.voice(s, { type: "sine", freqs: [987.77, 1318.51], ramp: 0.08, gain: 0.12, dur: 0.2 });
  }

  playUpgrade() {
    const s = this.begin("upgrade");
    if (!s) return;
    [440, 554, 659, 880].forEach((f, i) => this.voice(s, { type: "triangle", freqs: [f], gain: 0.15, dur: 0.1, start: i * 0.05 }));
  }

  playBuild() {
    const s = this.begin("build");
    if (!s) return;
    this.voice(s, { type: "square", freqs: [180, 90], gain: 0.12, dur: 0.09 });
    this.voice(s, { type: "triangle", freqs: [660], gain: 0.1, dur: 0.12, start: 0.05 });
  }

  playAlarm() {
    const s = this.begin("alarm");
    if (s) this.voice(s, { type: "sawtooth", freqs: [320, 480, 0.15], ramp: "lin", gain: 0.2, dur: 0.25 });
  }

  playWave() {
    const s = this.begin("wave");
    if (!s) return;
    [392, 523.25].forEach((f, i) => this.voice(s, { type: "triangle", freqs: [f], gain: 0.14, dur: 0.18, start: i * 0.09 }));
  }

  playVictory() {
    const s = this.begin("victory");
    if (!s) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.voice(s, { type: "triangle", freqs: [f], gain: 0.2, dur: 0.35, start: i * 0.12 }));
  }
}

export const sound = new SoundFX();
