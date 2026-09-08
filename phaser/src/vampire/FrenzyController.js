import { NPC_TYPES } from "../data/npcs.js";
import { VAMPIRE_RULES as R } from "./VampireCatalog.js";

const PREY = new Set([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET, NPC_TYPES.THUG, NPC_TYPES.POLICE]);

export function frenzyLockedFrame(frame, move = { x: 0, y: 0 }) {
  return { ...frame, move, hasMovementIntent: Math.hypot(move.x, move.y) > 0,
    primaryHeld: false, primaryPressed: false, drainHeld: false, drainPressed: false,
    interactPressed: false, traversePressed: false, vehicleActionPressed: false,
    handbrakeHeld: false, hornPressed: false, weaponStep: 0, quietHeld: false,
    sprintHeld: false, dashPressed: false, whisperPressed: false,
    bloodSensePressed: false, beastPressed: false, debugLayerPressed: 0 };
}

export class FrenzyController {
  constructor(scene, { state, now, notify }) {
    this.scene = scene;
    this.state = state;
    this.now = now;
    this.notify = notify;
    this.active = false;
    this.remaining = 0;
    this.target = null;
    this.warning = 0;
    this.thresholdListener = event => this.onThreshold(event);
    scene.events?.on?.("feeding:threshold-reached", this.thresholdListener);
  }
  hunger() { return Number(this.scene.feedingSystem?.hunger) || 0; }
  exhausted() { return this.now() < (this.state().exhaustedUntil || 0); }
  allowsPowers() { return !this.active && !this.exhausted() && this.hunger() < 100; }
  enabled(frame) {
    return Boolean(frame?.worldEnabled && !this.scene.transitionSystem?.active && !this.scene.interactionSystem?.isOpen && !this.scene.playerDamageSystem?.isDead?.());
  }
  update(dt, frame) {
    if (!this.enabled(frame)) return frame;
    if (this.hunger() < 85) this.warning = 0;
    const warning = this.hunger() >= 95 ? 95 : this.hunger() >= 85 ? 85 : 0;
    if (warning > this.warning && !this.active) {
      this.warning = warning;
      this.notify(warning === 95 ? "HUNGER 95 · At 100 the Beast takes control. Feed or use a blood bag now." : "HUNGER 85 · The Beast is close. Find blood before using more powers.");
    }
    if (this.active) {
      this.remaining -= Math.max(0, dt);
      if (this.hunger() < R.frenzyRecoveryHunger) this.finish(false);
      else if (this.remaining <= 0) this.finish(true);
    }
    return this.filterFrame(frame);
  }
  filterFrame(frame) {
    if (!this.enabled(frame)) return frame;
    if (!this.active && this.hunger() >= 100 && this.now() >= (this.state().retryAt || 0)) this.start();
    if (!this.active) {
      if (!this.exhausted() && this.hunger() < 100) return frame;
      return { ...frame, sprintHeld: false, dashPressed: false, whisperPressed: false, bloodSensePressed: false, beastPressed: false };
    }
    const locked = frenzyLockedFrame(frame);
    locked.aimWorld = { x: this.scene.player.x, y: this.scene.player.y };
    if (this.scene.playerDamageSystem?.isHitStunned?.()) return locked;
    const vehicle = this.scene.vehicleSystem?.currentVehicle?.();
    if (vehicle) {
      locked.handbrakeHeld = true;
      if (Math.abs(vehicle.speed || 0) <= 3) this.scene.vehicleSystem.exitVehicle();
      return locked;
    }
    if (this.scene.transitSystem?.isRiding?.()) {
      this.scene.transitSystem.exitRequested = true;
      return locked;
    }
    if (this.scene.feedingSystem?.isActive?.()) return locked;
    if (!this.validTarget(this.target)) this.target = this.findTarget();
    if (!this.target) return locked;
    const player = this.scene.player;
    const dx = this.target.x - player.x, dy = this.target.y - player.y;
    const distance = Math.hypot(dx, dy);
    locked.aimWorld = { x: this.target.x, y: this.target.y };
    if (distance <= 30) {
      this.scene.feedingSystem.startDrain(this.target, { source: "frenzy", eligibility: "frenzy_grapple" });
      return locked;
    }
    const direction = { x: dx / distance, y: dy / distance };
    if (this.scene.combatSystem) this.scene.combatSystem.aimDirection = direction;
    return { ...locked, move: direction, hasMovementIntent: true };
  }
  validTarget(npc) {
    if (!npc || !PREY.has(npc.type) || npc.vampire || npc.missionInformant || npc.noHeartbeat || npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted || npc.whisperPassengerBoarded || npc.layer !== this.scene.currentLayer) return false;
    const player = this.scene.player;
    const distance = Math.hypot(npc.x - player.x, npc.y - player.y);
    if (distance > 360) return false;
    // A conservative reachable corridor: no supernatural knowledge through walls
    // and no new pathfinding/movement owner for a short emergency action.
    if (this.scene.npcSystem?.lineClear?.(npc, npc.x, npc.y, player.x, player.y) === false) return false;
    const steps = Math.max(1, Math.ceil(distance / 12));
    for (let step = 1; step <= steps; step++) {
      if (this.scene.canStandAt?.(player.x + (npc.x - player.x) * step / steps, player.y + (npc.y - player.y) * step / steps) === false) return false;
    }
    return true;
  }
  findTarget() {
    const player = this.scene.player;
    const candidates = this.scene.npcSystem?.queryRadius?.(player.x, player.y, 360, this.scene.currentLayer) || this.scene.npcSystem?.npcs || [];
    return candidates.filter(npc => this.validTarget(npc)).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y) || String(a.id).localeCompare(String(b.id)))[0] || null;
  }
  start() {
    this.active = true;
    this.remaining = R.frenzySeconds;
    this.target = null;
    if (this.scene.combatSystem) this.scene.combatSystem.attack = null;
    const feed = this.scene.feedingSystem?.active;
    if (feed) feed.source = "frenzy";
    this.notify("FRENZY · The Beast controls movement and feeding. Blood below 70 restores control. Your victim and witnesses still matter.");
    this.scene.events?.emit?.("beast:frenzy-started", { hunger: this.hunger() });
  }
  onThreshold(event) {
    if (!this.active || event.source !== "frenzy" || event.depth !== "full_feed") return;
    const feeding = this.scene.feedingSystem, feed = feeding.active;
    if (feed && this.hunger() - feeding.reliefFor(feed.npc, "full_feed", feed.startingDepth) < R.frenzyRecoveryHunger) feeding.release("frenzy_sated");
  }
  finish(exhausted) {
    if (this.scene.feedingSystem?.active?.source === "frenzy") this.scene.feedingSystem.release("frenzy_ended");
    this.active = false;
    this.target = null;
    this.state().exhaustedUntil = exhausted ? this.now() + R.frenzyExhaustion : 0;
    this.state().retryAt = exhausted ? this.now() + R.frenzyRetry : 0;
    this.notify(exhausted ? "Control returns, exhausted. You still need blood; powers are unavailable at Hunger 100. Another crisis follows if you remain starving." : "Control returns. The Beast is sated; deal with the victim and any witnesses.");
    this.scene.events?.emit?.("beast:frenzy-ended", { exhausted, hunger: this.hunger() });
  }
  reset() { this.active = false; this.remaining = 0; this.target = null; this.warning = 0; }
  destroy() { this.scene.events?.off?.("feeding:threshold-reached", this.thresholdListener); }
}
