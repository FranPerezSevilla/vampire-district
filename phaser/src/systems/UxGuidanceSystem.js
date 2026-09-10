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
    const now = this.scene.time?.now || 0;
    const hideAll = Boolean(
      this.scene.registry?.get?.("uiPaused")
      || this.scene.registry?.get?.("taskRevealActive")
      || this.scene.taskRevealCinematic?.active
    );

    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!RECOVERY_TYPES.has(npc.type)) continue;
      const state = recoveryGuidanceState(npc, now);
      const label = state.visible ? this.ensureRecoveryLabel(npc) : this.labels.get(npc.id);
      if (!label) continue;

      const visible = state.visible
        && !hideAll
        && npc.layer === this.scene.currentLayer
        && !npc.hiddenBody;
      label.setVisible(visible);
      if (!visible) continue;

      label
        .setText(state.label)
        .setPosition(npc.x, npc.y - 30)
        .setColor(state.urgent ? "#ffe2e7" : npc.type === NPC_TYPES.HUNTER ? "#ffd6a3" : "#d9ecff");
      label.setBackgroundColor?.(state.urgent ? "rgba(48, 5, 13, .90)" : "rgba(5, 8, 14, .86)");
    }
  }

  ensureRecoveryLabel(npc) {
    if (!npc?.id) return null;
    if (this.labels.has(npc.id)) return this.labels.get(npc.id);

    const label = this.scene.add.text(npc.x, npc.y - 30, "", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: npc.type === NPC_TYPES.HUNTER ? "#ffd6a3" : "#d9ecff",
      backgroundColor: "rgba(5, 8, 14, .86)",
      padding: { x: 5, y: 3 }
    }).setOrigin(0.5, 1).setDepth(76).setVisible(false);
    label.setResolution?.(3);
    label.setStroke?.("#05060b", 3);
    this.labels.set(npc.id, label);
    return label;
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
