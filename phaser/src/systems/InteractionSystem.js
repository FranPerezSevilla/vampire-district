import { resolveAction } from "./ActionSystem.js";
import { RawAudio } from "./RawAudioSystem.js";

export class InteractionSystem {
  constructor(scene) {
    this.scene = scene;
    this.menu = null;
  }

  get isOpen() {
    return Boolean(this.menu);
  }

  sortOptions(options) {
    return [...options].sort((a, b) => {
      const priority = (b.priority || 0) - (a.priority || 0);
      if (priority !== 0) return priority;
      return (a.distance || 0) - (b.distance || 0);
    });
  }

  handleAction(options) {
    const sorted = this.sortOptions(options || []);
    if (sorted.length === 0) {
      RawAudio.play("cancel");
      return false;
    }

    if (sorted.length === 1) {
      this.runOption(sorted[0]);
      return true;
    }

    this.open(sorted);
    return true;
  }

  open(options) {
    this.menu = {
      options,
      index: 0
    };
    RawAudio.play("menu");
    this.scene.lastActionText = "Choose interaction.";
    this.publish();
  }

  close(status = "Interaction cancelled.") {
    this.menu = null;
    RawAudio.play("cancel");
    this.scene.lastActionText = status;
    this.publish();
  }

  runOption(option) {
    if (!option || typeof option.run !== "function") return;
    this.menu = null;
    this.publish();
    RawAudio.play(this.soundForOption(option));
    this.classifyOption(option);
    option.run();
  }

  classifyOption(option) {
    const actionId = this.actionIdForOption(option);
    if (!actionId) return;
    resolveAction(this.scene, actionId, {
      x: option.x,
      y: option.y,
      layer: this.scene.currentLayer,
      target: option.target || option.subject || null,
      cooldownKey: option.id ? `interaction:${option.id}` : undefined,
      cooldown: 0.8
    });
  }

  actionIdForOption(option) {
    if (!option) return null;
    if (["breakLight", "roofDrop", "roofJump"].includes(option.type)) return option.type;
    if (option.type === "fireEscapeUp" || option.type === "fireEscapeDown") return "fireEscape";
    if (option.type === "evidence") {
      if (option.id === "hide_dragged_body") return "bodyHide";
      if (option.id === "drop_dragged_body") return "bodyDrop";
      if (String(option.id || "").startsWith("drag_")) return "bodyDrag";
    }
    return null;
  }

  soundForOption(option) {
    switch (option.type) {
      case "breakLight": return "breakLight";
      case "fireEscapeUp":
      case "fireEscapeDown": return "routeClimb";
      case "sewerDown":
      case "sewerUp":
      case "privateShaft": return "routeSewer";
      case "roofDrop":
      case "roofJump": return "routeRoof";
      case "witness": return "stun";
      case "evidence": return option.id === "hide_dragged_body" ? "bodyHide" : option.id === "drop_dragged_body" ? "bodyDrop" : "bodyDrag";
      default: return "confirm";
    }
  }

  runSelected() {
    if (!this.menu) return;
    const option = this.menu.options[this.menu.index];
    this.runOption(option);
  }

  updateInput(keys) {
    if (!this.menu) return false;

    if (this.justDown(keys.escape)) {
      this.close();
      return true;
    }

    if (this.justDown(keys.up) || this.justDown(keys.w)) {
      this.menu.index = (this.menu.index - 1 + this.menu.options.length) % this.menu.options.length;
      RawAudio.play("menu");
      this.publish();
      return true;
    }

    if (this.justDown(keys.down) || this.justDown(keys.s)) {
      this.menu.index = (this.menu.index + 1) % this.menu.options.length;
      RawAudio.play("menu");
      this.publish();
      return true;
    }

    const digitKeys = [
      keys.street,
      keys.roofLow,
      keys.roofHigh,
      keys.sewer,
      keys.five,
      keys.six,
      keys.seven,
      keys.eight,
      keys.nine
    ];

    for (let i = 0; i < digitKeys.length; i++) {
      if (this.justDown(digitKeys[i]) && i < this.menu.options.length) {
        this.runOption(this.menu.options[i]);
        return true;
      }
    }

    if (this.justDown(keys.interact) || this.justDown(keys.enter) || this.justDown(keys.space)) {
      this.runSelected();
      return true;
    }

    return true;
  }

  snapshot() {
    if (!this.menu) return null;
    return {
      index: this.menu.index,
      options: this.menu.options.map(option => ({
        id: option.id,
        label: option.label,
        detail: option.detail || "",
        type: option.type || "action"
      }))
    };
  }

  publish() {
    this.scene.registry.set("interactionMenu", this.snapshot());
  }

  justDown(key) {
    return Boolean(key && Phaser.Input.Keyboard.JustDown(key));
  }
}
