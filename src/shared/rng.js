// Seeded random numbers (mulberry32). State lives in a plain object so it can be
// persisted with the match and replayed exactly.

export function nextRandom(holder) {
  holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(holder, n) {
  return Math.floor(nextRandom(holder) * n);
}

// Picks `count` distinct items in random order.
export function sampleDistinct(holder, items, count) {
  const pool = items.slice();
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    picked.push(pool.splice(randomInt(holder, pool.length), 1)[0]);
  }
  return picked;
}

export function createRng(seed) {
  const holder = { rngState: seed >>> 0 };
  return {
    holder,
    next: () => nextRandom(holder),
    int: (n) => randomInt(holder, n),
    pick: (arr) => arr[randomInt(holder, arr.length)],
  };
}

// FNV-1a 32-bit hash, for turning strings (room codes) into seeds.
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
