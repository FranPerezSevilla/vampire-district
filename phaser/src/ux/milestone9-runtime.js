import { CombatSystem } from "../combat/CombatSystem.js";
import { UX_STORAGE_KEYS, aimPresentation, normalizeBooleanPreference } from "../data/ux-guidance.js";
import { GameScene } from "../scenes/GameScene.js";
import { UIScene } from "../scenes/UIScene.js";
import { UxGuidanceSystem, installUxStyle } from "../systems/UxGuidanceSystem.js";

function readStoredAimContrast() {
  try {
    return normalizeBooleanPreference(window.localStorage.getItem(UX_STORAGE_KEYS.AIM_HIGH_CONTRAST), false);
  } catch {
    return false;
  }
}

function writeStoredAimContrast(enabled) {
  try {
    window.localStorage.setItem(UX_STORAGE_KEYS.AIM_HIGH_CONTRAST, enabled ? "true" : "false");
  } catch {
    // The preference still applies for the current page when storage is unavailable.
  }
}

function setAttributeIfChanged(node, name, value) {
  if (!node) return;
  const text = String(value);
  if (node.getAttribute?.(name) !== text) node.setAttribute?.(name, text);
}

function hideGuidanceForWorldLock(scene) {
  const system = scene?.uxGuidanceSystem;
  if (!system) return;
  system.renderMessage?.(null);
  system.setWeaponAttention?.(false);
  for (const label of system.labels?.values?.() || []) label.setVisible?.(false);
}

function installGameSceneUxRuntime() {
  if (GameScene.prototype.__nbdMilestone9UxPatch) return;

  const originalCreate = GameScene.prototype.create;
  const originalUpdate = GameScene.prototype.update;

  GameScene.prototype.create = function createWithMilestone9Ux(...args) {
    const result = originalCreate.apply(this, args);
    this.uxGuidanceSystem?.destroy?.();
    this.uxGuidanceSystem = new UxGuidanceSystem(this);

    this.__nbdUxWorldLockHandler = (_parent, value) => {
      if (value) hideGuidanceForWorldLock(this);
    };
    this.registry?.events?.on?.("changedata-uiPaused", this.__nbdUxWorldLockHandler);
    this.registry?.events?.on?.("changedata-taskRevealActive", this.__nbdUxWorldLockHandler);
    this.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry?.events?.off?.("changedata-uiPaused", this.__nbdUxWorldLockHandler);
      this.registry?.events?.off?.("changedata-taskRevealActive", this.__nbdUxWorldLockHandler);
      this.__nbdUxWorldLockHandler = null;
    });
    return result;
  };

  GameScene.prototype.update = function updateWithMilestone9Ux(time, deltaMs) {
    const result = originalUpdate.call(this, time, deltaMs);
    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);
    this.uxGuidanceSystem?.update?.(dt, this.currentInputFrame);
    return result;
  };

  GameScene.prototype.__nbdMilestone9UxPatch = true;
}

function installHighContrastAimOverlay() {
  if (CombatSystem.prototype.__nbdMilestone9AimPatch) return;

  const originalDraw = CombatSystem.prototype.draw;
  CombatSystem.prototype.draw = function drawWithHighContrastAim(frame) {
    const result = originalDraw.call(this, frame);
    if (!frame?.worldEnabled || !frame.pointerInside || !this.scene.registry?.get?.("aimHighContrast")) {
      return result;
    }

    const presentation = aimPresentation(true);
    const config = this.attack?.config || this.currentAttackConfig?.() || {};
    const distance = Math.max(32, Number(config.reticleDistance) || 27);
    const px = this.scene.player.x;
    const py = this.scene.player.y;
    const sx = px + this.aimDirection.x * 9;
    const sy = py + this.aimDirection.y * 9;
    const ax = px + this.aimDirection.x * distance;
    const ay = py + this.aimDirection.y * distance;
    const perpendicularX = -this.aimDirection.y;
    const perpendicularY = this.aimDirection.x;
    const graphics = this.graphics;

    graphics.lineStyle(presentation.outerWidth, presentation.outerColor, presentation.alpha);
    graphics.beginPath();
    graphics.moveTo(sx, sy);
    graphics.lineTo(ax, ay);
    graphics.strokePath();
    graphics.lineStyle(presentation.innerWidth, presentation.innerColor, presentation.alpha);
    graphics.beginPath();
    graphics.moveTo(sx, sy);
    graphics.lineTo(ax, ay);
    graphics.strokePath();

    graphics.lineStyle(5, presentation.outerColor, 1).strokeCircle(ax, ay, presentation.reticleRadius + 2);
    graphics.lineStyle(2, presentation.innerColor, 1).strokeCircle(ax, ay, presentation.reticleRadius);

    graphics.lineStyle(5, presentation.outerColor, 1);
    graphics.beginPath();
    graphics.moveTo(ax - perpendicularX * presentation.crossRadius, ay - perpendicularY * presentation.crossRadius);
    graphics.lineTo(ax + perpendicularX * presentation.crossRadius, ay + perpendicularY * presentation.crossRadius);
    graphics.strokePath();
    graphics.lineStyle(2, presentation.innerColor, 1);
    graphics.beginPath();
    graphics.moveTo(ax - perpendicularX * presentation.crossRadius, ay - perpendicularY * presentation.crossRadius);
    graphics.lineTo(ax + perpendicularX * presentation.crossRadius, ay + perpendicularY * presentation.crossRadius);
    graphics.strokePath();
    return result;
  };

  CombatSystem.prototype.__nbdMilestone9AimPatch = true;
}

function accessibilityMarkup(enabled) {
  return `
    <section class="nbd-accessibility" aria-label="Accessibility settings">
      <h3>Accessibility</h3>
      <button
        class="nbd-accessibility-toggle"
        type="button"
        data-aim-contrast-toggle
        aria-pressed="${enabled ? "true" : "false"}"
      >High-contrast aim: ${enabled ? "On" : "Off"}</button>
      <p>Uses a larger black-and-white reticle that does not rely on weapon colour. This setting is saved on this device.</p>
    </section>
  `;
}

function installUiAccessibilityRuntime() {
  if (UIScene.prototype.__nbdMilestone9UxPatch) return;

  const originalBindDom = UIScene.prototype.bindDom;
  const originalRenderHud = UIScene.prototype.renderHud;

  UIScene.prototype.bindDom = function bindDomWithAccessibility(...args) {
    const result = originalBindDom.apply(this, args);
    installUxStyle();

    if (typeof this.registry?.get?.("aimHighContrast") !== "boolean") {
      this.registry?.set?.("aimHighContrast", readStoredAimContrast());
    }

    const modalPanel = this.dom.modal?.querySelector?.(".ui-modal-panel");
    if (modalPanel) {
      modalPanel.style.maxHeight = "calc(100% - 32px)";
      modalPanel.style.overflowY = "auto";
    }

    setAttributeIfChanged(this.dom.vitals, "role", "progressbar");
    setAttributeIfChanged(this.dom.vitals, "aria-valuemin", "0");
    setAttributeIfChanged(this.dom.vitals, "aria-valuemax", "100");
    setAttributeIfChanged(this.dom.wanted, "role", "status");
    setAttributeIfChanged(this.dom.wanted, "aria-live", "polite");
    setAttributeIfChanged(this.dom.prompt, "role", "status");
    setAttributeIfChanged(this.dom.prompt, "aria-live", "polite");
    setAttributeIfChanged(this.dom.toast, "role", "status");
    setAttributeIfChanged(this.dom.toast, "aria-live", "polite");
    setAttributeIfChanged(this.dom.weapon, "role", "status");
    setAttributeIfChanged(this.dom.weapon, "aria-live", "polite");

    if (this.dom.root && !this.__nbdAccessibilityClickHandler) {
      this.__nbdAccessibilityClickHandler = event => {
        const button = event.target?.closest?.("[data-aim-contrast-toggle]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const enabled = !Boolean(this.registry.get("aimHighContrast"));
        this.registry.set("aimHighContrast", enabled);
        writeStoredAimContrast(enabled);
        setAttributeIfChanged(button, "aria-pressed", enabled ? "true" : "false");
        button.textContent = `High-contrast aim: ${enabled ? "On" : "Off"}`;
      };
      this.dom.root.addEventListener("click", this.__nbdAccessibilityClickHandler);
      this.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.dom.root?.removeEventListener?.("click", this.__nbdAccessibilityClickHandler);
        this.__nbdAccessibilityClickHandler = null;
      });
    }

    return result;
  };

  UIScene.prototype.setModal = function setModalWithAccessibility(title, bodyHtml, actionLabel) {
    const enabled = Boolean(this.registry?.get?.("aimHighContrast"));
    const visibleTitle = title === "Night Blood District" ? "Vampire District" : title;
    const body = visibleTitle === "Pause Menu"
      ? `${String(bodyHtml || "")}${accessibilityMarkup(enabled)}`
      : String(bodyHtml || "");

    this.setText(this.dom.modalTitle, visibleTitle);
    if (this.dom.modalBody && this.dom.modalBody.innerHTML !== body) {
      this.dom.modalBody.innerHTML = body;
    }
    this.setText(this.dom.modalAction, actionLabel);
  };

  UIScene.prototype.renderHud = function renderAccessibleHud(data) {
    const result = originalRenderHud.call(this, data);
    const hunger = Math.round(this.hungerPercent(data?.hungerText));
    const wanted = this.wantedLevel(data?.exposureText);
    const wantedState = this.dom.wantedState?.textContent || "CLEAR";
    const weapon = data?.weapon || {};
    const inventory = Array.isArray(weapon.inventory) ? weapon.inventory : [];
    const slot = Math.max(1, inventory.indexOf(weapon.id) + 1);
    const slotText = inventory.length ? `, slot ${slot} of ${inventory.length}` : "";

    setAttributeIfChanged(this.dom.vitals, "aria-valuenow", hunger);
    setAttributeIfChanged(this.dom.vitals, "aria-label", `Vampire Hunger ${hunger} percent`);
    setAttributeIfChanged(this.dom.wanted, "aria-label", `Police alert level ${wanted}: ${wantedState}`);
    setAttributeIfChanged(this.dom.missionButton, "aria-expanded", this.missionOpen ? "true" : "false");
    setAttributeIfChanged(this.dom.menuButton, "aria-expanded", this.pauseOpen ? "true" : "false");
    setAttributeIfChanged(
      this.dom.weapon,
      "aria-label",
      `Equipped weapon ${weapon.name || "Unarmed"}, ammunition ${weapon.ammoText || "unlimited"}${slotText}`
    );
    return result;
  };

  UIScene.prototype.__nbdMilestone9UxPatch = true;
}

installGameSceneUxRuntime();
installHighContrastAimOverlay();
installUiAccessibilityRuntime();
