function clockNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maximum(values = []) {
  if (!values.length) return 0;
  return Math.max(...values);
}

export class RuntimeDiagnostics {
  constructor({
    sampleSize = 120,
    systemSampleStride = 6,
    snapshotCacheMs = 250,
    clock = clockNow
  } = {}) {
    this.sampleSize = Math.max(10, Math.floor(Number(sampleSize) || 120));
    this.systemSampleStride = Math.max(1, Math.floor(Number(systemSampleStride) || 6));
    this.snapshotCacheMs = Math.max(0, Number(snapshotCacheMs) || 0);
    this.clock = typeof clock === "function" ? clock : clockNow;
    this.owners = new Map();
    this.systems = new Set();
    this.samples = [];
    this.frameStartedAt = null;
    this.maxFrameMs = 0;
    this.systemCallCounts = new Map();
    this.systemSamples = new Map();
    this.systemMaxMs = new Map();
    this.cachedSnapshot = null;
    this.cachedSnapshotAt = Number.NEGATIVE_INFINITY;
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

  beginSystem(name) {
    const key = String(name || "");
    if (!key) return null;
    this.registerSystem(key);
    const calls = (this.systemCallCounts.get(key) || 0) + 1;
    this.systemCallCounts.set(key, calls);
    if ((calls - 1) % this.systemSampleStride !== 0) return null;
    return this.clock();
  }

  endSystem(name, startedAt) {
    if (startedAt == null) return 0;
    const key = String(name || "");
    if (!key) return 0;
    const elapsed = Math.max(0, this.clock() - startedAt);
    const samples = this.systemSamples.get(key) || [];
    samples.push(elapsed);
    if (samples.length > this.sampleSize) samples.shift();
    this.systemSamples.set(key, samples);
    this.systemMaxMs.set(key, Math.max(this.systemMaxMs.get(key) || 0, elapsed));
    return elapsed;
  }

  beginFrame() {
    this.frameStartedAt = this.clock();
  }

  endFrame() {
    if (this.frameStartedAt == null) return 0;
    const elapsed = Math.max(0, this.clock() - this.frameStartedAt);
    this.frameStartedAt = null;
    this.samples.push(elapsed);
    if (this.samples.length > this.sampleSize) this.samples.shift();
    this.maxFrameMs = Math.max(this.maxFrameMs, elapsed);
    return elapsed;
  }

  averageFrameMs() {
    return average(this.samples);
  }

  recentMaxFrameMs() {
    return maximum(this.samples);
  }

  systemTimingSnapshot() {
    const timings = {};
    for (const name of [...this.systems].sort()) {
      const samples = this.systemSamples.get(name) || [];
      if (!samples.length) continue;
      timings[name] = {
        calls: this.systemCallCounts.get(name) || 0,
        samples: samples.length,
        averageMs: Number(average(samples).toFixed(3)),
        recentMaxMs: Number(maximum(samples).toFixed(3)),
        maxMs: Number((this.systemMaxMs.get(name) || 0).toFixed(3))
      };
    }
    return timings;
  }

  rankedSystems(timings = this.systemTimingSnapshot(), limit = 5) {
    return Object.entries(timings)
      .map(([name, timing]) => ({ name, ...timing }))
      .sort((a, b) => (
        b.averageMs - a.averageMs
        || b.recentMaxMs - a.recentMaxMs
        || a.name.localeCompare(b.name)
      ))
      .slice(0, Math.max(0, Math.floor(Number(limit) || 0)));
  }

  snapshot({ force = false } = {}) {
    const now = this.clock();
    if (
      !force
      && this.cachedSnapshot
      && now - this.cachedSnapshotAt < this.snapshotCacheMs
    ) return this.cachedSnapshot;

    const systemTimings = this.systemTimingSnapshot();
    this.cachedSnapshot = {
      owners: Object.fromEntries(this.owners),
      systems: [...this.systems].sort(),
      samples: this.samples.length,
      averageFrameMs: Number(this.averageFrameMs().toFixed(3)),
      recentMaxFrameMs: Number(this.recentMaxFrameMs().toFixed(3)),
      maxFrameMs: Number(this.maxFrameMs.toFixed(3)),
      systemSampleStride: this.systemSampleStride,
      snapshotCacheMs: this.snapshotCacheMs,
      systemTimings,
      slowestSystems: this.rankedSystems(systemTimings),
      conflicts: []
    };
    this.cachedSnapshotAt = now;
    return this.cachedSnapshot;
  }

  expose(target = globalThis) {
    if (!target) return;
    target.NBD_RUNTIME_DIAGNOSTICS = this;
  }

  summary() {
    const snapshot = this.snapshot();
    const hot = snapshot.slowestSystems[0];
    const hotspot = hot ? ` · hot ${hot.name} ${hot.averageMs.toFixed(2)} ms` : "";
    return `Runtime ${this.systems.size} systems · frame ${snapshot.averageFrameMs.toFixed(2)} ms avg / ${snapshot.recentMaxFrameMs.toFixed(2)} ms recent max · ${this.owners.size} owned methods${hotspot}`;
  }
}
