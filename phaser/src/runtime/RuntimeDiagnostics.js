function clockNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

export class RuntimeDiagnostics {
  constructor({ sampleSize = 120 } = {}) {
    this.sampleSize = Math.max(10, Math.floor(Number(sampleSize) || 120));
    this.owners = new Map();
    this.systems = new Set();
    this.samples = [];
    this.frameStartedAt = 0;
    this.maxFrameMs = 0;
  }

  claim(method, owner) {
    const key = String(method || "");
    const nextOwner = String(owner || "unknown");
    if (!key) return false;
    const existing = this.owners.get(key);
    if (existing && existing !== nextOwner) {
      throw new Error(`Runtime owner conflict for ${key}: ${existing} and ${nextOwner}`);
    }
    this.owners.set(key, nextOwner);
    return !existing;
  }

  registerSystem(name) {
    if (name) this.systems.add(String(name));
  }

  beginFrame() {
    this.frameStartedAt = clockNow();
  }

  endFrame() {
    if (!this.frameStartedAt) return 0;
    const elapsed = Math.max(0, clockNow() - this.frameStartedAt);
    this.frameStartedAt = 0;
    this.samples.push(elapsed);
    if (this.samples.length > this.sampleSize) this.samples.shift();
    this.maxFrameMs = Math.max(this.maxFrameMs, elapsed);
    return elapsed;
  }

  averageFrameMs() {
    if (!this.samples.length) return 0;
    return this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
  }

  recentMaxFrameMs() {
    if (!this.samples.length) return 0;
    return Math.max(...this.samples);
  }

  snapshot() {
    return {
      owners: Object.fromEntries(this.owners),
      systems: [...this.systems].sort(),
      samples: this.samples.length,
      averageFrameMs: Number(this.averageFrameMs().toFixed(3)),
      recentMaxFrameMs: Number(this.recentMaxFrameMs().toFixed(3)),
      maxFrameMs: Number(this.maxFrameMs.toFixed(3)),
      conflicts: []
    };
  }

  expose(target = globalThis) {
    if (!target) return;
    target.NBD_RUNTIME_DIAGNOSTICS = this;
  }

  summary() {
    const avg = this.averageFrameMs();
    const recentMax = this.recentMaxFrameMs();
    return `Runtime ${this.systems.size} systems · frame ${avg.toFixed(2)} ms avg / ${recentMax.toFixed(2)} ms recent max · ${this.owners.size} owned methods`;
  }
}
