// Player preferences, saved per browser. Small observable store.

const KEY = "cybersiege_settings";

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const defaults = () => ({
  quality: "auto", // 'high' | 'low' | 'auto'
  damageNumbers: true,
  reducedMotion: prefersReducedMotion(),
  tutorialDone: false,
  playerName: "",
  difficulty: "normal",
});

function load() {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return defaults();
  }
}

let current = load();
const listeners = new Set();

export const settings = {
  get: () => current,
  set(patch) {
    current = { ...current, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* storage unavailable (private mode) */
    }
    for (const l of listeners) l();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
