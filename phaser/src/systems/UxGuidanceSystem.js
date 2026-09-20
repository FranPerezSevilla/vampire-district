import { NPC_TYPES } from "../data/npcs.js";
import {
  UX_STORAGE_KEYS,
  normalizeBooleanPreference,
  recoveryGuidanceState
} from "../data/ux-guidance.js";

const RECOVERY_TYPES = new Set([NPC_TYPES.POLICE, NPC_TYPES.HUNTER]);

function storedAimPreference() {
  try {
    return normalizeBooleanPreference(window.localStorage.getItem(UX_STORAGE_KEYS.AIM_HIGH_CONTRAST), false);
  } catch {
    return false;
  }
}

export class UxGuidanceSystem {
  constructor(scene) {
    this.scene = scene;
    this.recoveryTipShown = false;
    this.transient = null;
    this.labels = new Map();

    if (typeof scene.registry?.get?.("aimHighContrast") !== "boolean") {
      scene.registry?.set?.("aimHighContrast", storedAimPreference());
    }

    this.onEntityDowned = payload => this.handleEntityDowned(payload);
    this.onEntityRecovered = payload => this.handleEntityRecovered(payload);
    this.onFeedingStarted = payload => this.handleFeedingStarted(payload);

    scene.events?.on?.("combat:entity-downed", this.onEntityDowned);
    scene.events?.on?.("combat:entity-recovered", this.onEntityRecovered);
    scene.events?.on?.("feeding:started", this.onFeedingStarted);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.uxGuidanceSystem = this;
  }

  update(_dt, frame = this.scene.currentInputFrame) {
    this.updateRecoveryLabels();

    const worldVisible = this.worldGuidanceVisible(frame);
    const now = this.scene.time?.now || 0;

    if (this.transient && now >= this.transient.until) this.transient = null;

    if (!worldVisible) {
      this.renderMessage(null);
      return;
    }

    if (this.transient) {
      this.renderMessage(this.transient);
      return;
    }

    this.renderMessage(null);
  }

  tutorialComplete() {
    const director = this.scene.tutorialDirector;
    if (director) return director.state === "complete";
    return Number(this.scene.missionSystem?.step) > 0;
  }

  worldGuidanceVisible(frame) {
    const uiScene = this.scene.scene?.get?.("UIScene");
    return Boolean(
      frame?.worldEnabled
      && !this.scene.registry?.get?.("uiPaused")
      && !this.scene.registry?.get?.("taskRevealActive")
      && !this.scene.taskRevealCinematic?.active
      && !this.scene.transitionSystem?.active
      && !this.scene.interactionSystem?.isOpen
      && !uiScene?.missionOpen
      && !this.scene.missionSystem?.failed
      && !this.scene.missionSystem?.completed
    );
  }

  handleEntityDowned(payload = {}) {
    const npc = this.findNpc(payload.targetId);
    if (!npc || !RECOVERY_TYPES.has(npc.type)) return;
    this.ensureRecoveryLabel(npc);

    if (!this.recoveryTipShown) {
      this.recoveryTipShown = true;
      this.showTransient(
        "DOWN",
        "Police and hunters recover if left down. Drain or finish them before the timer ends.",
        5_400,
        "recovery"
      );
    }
  }

  handleEntityRecovered(payload = {}) {
    const npc = this.findNpc(payload.targetId);
    this.hideRecoveryLabel(payload.targetId);
    const name = payload.type === NPC_TYPES.HUNTER ? "Hunter" : "Police officer";
    this.showTransient(
      "ALERT",
      `${name} recovered and has re-entered the fight.`,
      3_200,
      "warning"
    );
    if (npc) npc.__nbdRecoveryAnnounced = true;
  }

  handleFeedingStarted(payload = {}) {
    this.hideRecoveryLabel(payload.targetId);
  }

  showTransient(key, text, durationMs, kind = "weapon") {
    this.transient = {
      key,
      text,
      kind,
      until: (this.scene.time?.now || 0) + Math.max(0, Number(durationMs) || 0)
    };
  }

  renderMessage(message) {
    const value = message?.text ? { key: message.key || "TIP", text: message.text, kind: message.kind } : null;
    this.scene.statePublisher?.set?.("uiGuidance", value) || this.scene.registry?.set?.("uiGuidance", value);
  }

  updateRecoveryLabels() {
    return null;
  }

  ensureRecoveryLabel(npc) {
    return null;
  }

  hideRecoveryLabel(id) {
    if (!id) return;
    this.labels.get(id)?.setVisible?.(false);
  }

  findNpc(id) {
    if (!id) return null;
    return this.scene.npcSystem?.npcs?.find(npc => npc.id === id) || null;
  }

  destroy() {
    this.scene.events?.off?.("combat:entity-downed", this.onEntityDowned);
    this.scene.events?.off?.("combat:entity-recovered", this.onEntityRecovered);
    this.scene.events?.off?.("feeding:started", this.onFeedingStarted);
    for (const label of this.labels.values()) label.destroy?.();
    this.labels.clear();
  }
}
