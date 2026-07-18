function snapshot(value) {
  if (value == null || typeof value !== "object") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return value;
  }
}

export class RegistryPublisher {
  constructor(registry) {
    this.registry = registry;
    this.cache = new Map();
    this.writes = 0;
    this.skipped = 0;
  }

  set(key, value) {
    const comparable = snapshot(value);
    if (this.cache.has(key) && Object.is(this.cache.get(key), comparable)) {
      this.skipped++;
      return false;
    }
    this.cache.set(key, comparable);
    this.registry?.set?.(key, value);
    this.writes++;
    return true;
  }

  setMany(entries = {}) {
    let changed = 0;
    for (const [key, value] of Object.entries(entries)) {
      if (this.set(key, value)) changed++;
    }
    return changed;
  }

  invalidate(key = null) {
    if (key == null) this.cache.clear();
    else this.cache.delete(key);
  }

  summary() {
    return `Registry writes ${this.writes} · unchanged skipped ${this.skipped}`;
  }
}
