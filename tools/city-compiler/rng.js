export function hashSeed(seed) {
  const text = String(seed || "seed");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return Object.freeze({
    next,
    int(min, max) {
      const lower = Math.ceil(Math.min(min, max));
      const upper = Math.floor(Math.max(min, max));
      return lower + Math.floor(next() * (upper - lower + 1));
    },
    pick(items = []) {
      if (!items.length) return undefined;
      return items[Math.floor(next() * items.length)];
    },
    chance(probability = 0.5) {
      return next() < Math.max(0, Math.min(1, Number(probability) || 0));
    },
    shuffle(items = []) {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index--) {
        const swap = Math.floor(next() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
      }
      return copy;
    }
  });
}