const MAX_EXPOSURE = 125;

export class ExposureSystem {
  constructor(scene) {
    this.scene = scene;
    this.value = 0;
    this.lastReason = "No exposure yet.";
  }

  level() {
    return Math.min(5, Math.floor(this.value / 25));
  }

  add(amount, reason = "Exposure rises.") {
    if (!amount || amount <= 0) return;
    const before = this.level();
    this.value = Math.max(0, Math.min(MAX_EXPOSURE, this.value + amount));
    this.lastReason = reason;
    this.scene.policeSystem?.addHeat(this.scene.player.x, this.scene.player.y, amount * 0.55, reason);
    const after = this.level();
    this.scene.lastActionText = after > before
      ? `${reason} Exposure level ${after}.`
      : reason;
  }

  forceLevel(level, reason = "Exposure forced up.") {
    const target = Math.max(0, Math.min(5, level)) * 25;
    if (this.value < target) this.add(target - this.value, reason);
  }

  cool(dt) {
    if (this.scene.currentLayer > 0 || this.scene.currentLayer < 0 || this.scene.currentShadow()) {
      this.value = Math.max(0, this.value - dt * 0.7);
    }
  }

  summary() {
    const pct = Math.round((this.value / MAX_EXPOSURE) * 100);
    return `Exposure Lv ${this.level()} · ${pct}%`;
  }
}
