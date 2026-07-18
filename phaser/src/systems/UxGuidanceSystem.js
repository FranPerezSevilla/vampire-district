import { NPC_TYPES } from "../data/npcs.js";
import {
  UX_STORAGE_KEYS,
  WEAPON_GUIDANCE_STATES,
  normalizeBooleanPreference,
  recoveryGuidanceState,
  weaponGuidanceState
} from "../data/ux-guidance.js";

const RECOVERY_TYPES = new Set([NPC_TYPES.POLICE, NPC_TYPES.HUNTER]);

function installUxStyle() {
  if (typeof document === "undefined" || document.getElementById("nbd-milestone9-style")) return;

  const style = document.createElement("style");
  style.id = "nbd-milestone9-style";
  style.textContent = `
    .ux-guidance {
      position: absolute;
      left: 50%;
      top: 88px;
      width: min(650px, calc(100% - 40px));
      min-height: 42px;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 11px;
      padding: 8px 14px;
      transform: translateX(-50%);
      border: 1px solid rgba(120, 199, 163, .56);
      border-left-width: 3px;
      background: linear-gradient(90deg, rgba(5, 8, 13, .94), rgba(12, 18, 25, .96), rgba(5, 8, 13, .94));
      box-shadow: 0 12px 34px rgba(0, 0, 0, .38);
      color: #eafff5;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.25;
      text-align: center;
      pointer-events: none;
      z-index: 74;
    }
    .ux-guidance.visible { display: flex; animation: nbd-ux-guidance-in .18s ease-out; }
    .ux-guidance.recovery { border-color: rgba(255, 176, 46, .78); color: #fff2c5; }
    .ux-guidance.warning { border-color: rgba(255, 64, 88, .82); color: #ffe2e7; }
    .ux-guidance kbd {
      flex: 0 0 auto;
      min-width: 62px;
      min-height: 27px;
      display: inline-grid;
      place-items: center;
      padding: 4px 8px;
      border: 1px solid currentColor;
      background: rgba(255, 255, 255, .07);
      color: inherit;
      font: 900 12px/1 Inter, system-ui, sans-serif;
      box-shadow: inset 0 -2px rgba(0, 0, 0, .34);
    }
    @keyframes nbd-ux-guidance-in {
      from { opacity: 0; transform: translate(-50%, -5px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }

    .weapon-hud {
      left: auto !important;
      right: 18px !important;
      bottom: 18px !important;
      min-width: 142px !important;
    }
    .weapon-hud small { font-size: 11px !important; }
    .weapon-hud strong { font-size: 14px !important; }
    .weapon-hud span { font-size: 13px !important; }
    .weapon-hud kbd { font-size: 10px !important; }
    .weapon-hud.attention {
      border-color: rgba(255, 242, 168, .78) !important;
      box-shadow: 0 0 0 2px rgba(255, 176, 46, .12), 0 10px 32px rgba(0, 0, 0, .42) !important;
      animation: nbd-weapon-attention 1.35s ease-in-out infinite;
    }
    @keyframes nbd-weapon-attention {
      0%, 100% { transform: translateY(0); filter: brightness(.92); }
      50% { transform: translateY(-2px); filter: brightness(1.16); }
    }

    .nbd-accessibility {
      margin: 16px 0 4px;
      padding: 13px 14px;
      border: 1px solid rgba(215, 200, 255, .20);
      background: rgba(255, 255, 255, .035);
    }
    .nbd-accessibility h3 {
      margin: 0 0 8px;
      color: #fff2a8;
      font-size: 14px;
      letter-spacing: .04em;
    }
    .nbd-accessibility p {
      margin: 8px 0 0 !important;
      color: #bdb3cd;
      font-size: 12px;
      line-height: 1.4;
    }
    .nbd-accessibility-toggle {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      padding: 8px 12px;
      border: 1px solid rgba(241, 230, 255, .34);
      background: rgba(5, 6, 11, .72);
      color: #f4ecff;
      font-size: 12px;
      font-weight: 850;
      cursor: pointer;
    }
    .nbd-accessibility-toggle[aria-pressed="true"] {
      border-color: #fff2a8;
      background: rgba(255, 242, 168, .11);
      color: #fff8dc;
    }
    .hud-button:focus-visible,
    .nbd-accessibility-toggle:focus-visible,
    .resolution-control select:focus-visible {
      outline: 3px solid #fff2a8;
      outline-offset: 3px;
    }

    @media (max-width: 980px) {
      .ux-guidance { top: 152px; }
      .weapon-hud { right: 10px !important; bottom: 10px !important; }
    }
    @media (max-width: 720px) {
      .ux-guidance {
        top: 142px;
        width: calc(100% - 20px);
        min-height: 38px;
        gap: 8px;
        padding: 7px 9px;
        font-size: 12px;
      }
      .ux-guidance kbd { min-width: 52px; font-size: 11px; }
      .weapon-hud { min-width: 118px !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ux-guidance.visible,
      .weapon-hud.attention,
      .hud-toast.visible,
      .task-reveal,
      .tutorial-dialogue {
        animation: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureGuidanceDom() {
  if (typeof document === "undefined") return null;
  installUxStyle();
  const host = document.getElementById("game-ui") || document.querySelector(".game-frame");
  if (!host) return null;

  let root = document.getElementById("ux-guidance");
  if (!root) {
    root = document.createElement("div");
    root.id = "ux-guidance";
    root.className = "ux-guidance";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `<kbd></kbd><span></span>`;
    host.appendChild(root);
  }

  return {
    root,
    key: root.querySelector("kbd"),
    text: root.querySelector("span")
  };
}

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
    this.dom = ensureGuidanceDom();
    this.weaponChanges = 0;
    this.recoveryTipShown = false;
    this.transient = null;
    this.labels = new Map();

    if (typeof scene.registry?.get?.("aimHighContrast") !== "boolean") {
      scene.registry?.set?.("aimHighContrast", storedAimPreference());
    }

    this.onWeaponChanged = payload => this.handleWeaponChanged(payload);
    this.onEntityDowned = payload => this.handleEntityDowned(payload);
    this.onEntityRecovered = payload => this.handleEntityRecovered(payload);
    this.onFeedingStarted = payload => this.handleFeedingStarted(payload);

    scene.events?.on?.("weapon:changed", this.onWeaponChanged);
    scene.events?.on?.("combat:entity-downed", this.onEntityDowned);
    scene.events?.on?.("combat:entity-recovered", this.onEntityRecovered);
    scene.events?.on?.("feeding:started", this.onFeedingStarted);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.uxGuidanceSystem = this;
  }

  update(_dt, frame = this.scene.currentInputFrame) {
    this.updateRecoveryLabels();

    const phase = weaponGuidanceState({
      tutorialComplete: this.tutorialComplete(),
      weaponChanges: this.weaponChanges
    });
    const worldVisible = this.worldGuidanceVisible(frame);
    const now = this.scene.time?.now || 0;

    if (this.transient && now >= this.transient.until) this.transient = null;

    if (!worldVisible) {
      this.renderMessage(null);
      this.setWeaponAttention(false);
      return;
    }

    if (this.transient) {
      this.renderMessage(this.transient);
      this.setWeaponAttention(phase === WEAPON_GUIDANCE_STATES.AWAITING_CYCLE);
      return;
    }

    if (phase === WEAPON_GUIDANCE_STATES.AWAITING_CYCLE) {
      this.renderMessage({
        key: "WHEEL",
        text: "Change weapon. Scroll once to equip the Iron Pipe or Pistol.",
        kind: "weapon"
      });
      this.setWeaponAttention(true);
      return;
    }

    this.renderMessage(null);
    this.setWeaponAttention(false);
  }

  tutorialComplete() {
    const director = this.scene.tutorialDirector;
    if (director) return director.state === "complete";
    return Number(this.scene.missionSystem?.step) > 0;
  }

  worldGuidanceVisible(frame) {
    return Boolean(
      frame?.worldEnabled
      && !this.scene.registry?.get?.("uiPaused")
      && !this.scene.registry?.get?.("taskRevealActive")
      && !this.scene.taskRevealCinematic?.active
      && !this.scene.transitionSystem?.active
      && !this.scene.interactionSystem?.isOpen
      && !this.scene.missionSystem?.failed
      && !this.scene.missionSystem?.completed
    );
  }

  handleWeaponChanged(payload = {}) {
    this.weaponChanges += 1;
    const ammo = payload.ammo == null ? "unlimited use" : `${payload.ammo} rounds`;
    this.showTransient(
      "LMB",
      `${payload.name || "Weapon"} equipped · ${ammo}. Left-click attacks in the aimed direction.`,
      3_800,
      "weapon"
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
    if (!this.dom?.root) return;
    const visible = Boolean(message?.text);
    this.dom.root.classList.toggle("visible", visible);
    this.dom.root.classList.toggle("recovery", message?.kind === "recovery");
    this.dom.root.classList.toggle("warning", message?.kind === "warning");
    this.dom.root.setAttribute("aria-hidden", visible ? "false" : "true");
    if (!visible) return;
    if (this.dom.key) this.dom.key.textContent = message.key || "TIP";
    if (this.dom.text) this.dom.text.textContent = message.text;
  }

  setWeaponAttention(active) {
    if (typeof document === "undefined") return;
    document.querySelector(".weapon-hud")?.classList.toggle("attention", Boolean(active));
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
    this.scene.events?.off?.("weapon:changed", this.onWeaponChanged);
    this.scene.events?.off?.("combat:entity-downed", this.onEntityDowned);
    this.scene.events?.off?.("combat:entity-recovered", this.onEntityRecovered);
    this.scene.events?.off?.("feeding:started", this.onFeedingStarted);
    for (const label of this.labels.values()) label.destroy?.();
    this.labels.clear();
    this.setWeaponAttention(false);
    this.dom?.root?.remove?.();
  }
}

export { installUxStyle };
