import { COLORS } from "../data/balance.js";

export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
  }

  create() {
    this.panel = this.add.rectangle(14, 14, 520, 92, 0x05060b, 0.78).setOrigin(0, 0).setScrollFactor(0);
    this.panel.setStrokeStyle(1, 0x2d3045, 1);

    this.title = this.add.text(26, 24, "Night Blood District · Phaser", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#f1e6ff"
    }).setScrollFactor(0);

    this.status = this.add.text(26, 44, "Booting...", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#78c7a3"
    }).setScrollFactor(0);

    this.prompt = this.add.text(26, 62, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#fff2a8"
    }).setScrollFactor(0);

    this.controls = this.add.text(26, 80, "WASD/arrows move · Shift sprint · E interact · 1/2/3/4 debug layers", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9d93b8"
    }).setScrollFactor(0);

    this.phase = this.add.text(14, 606, "PHASE 1: real traversal routes · fire escapes · rooftop jumps · sewers", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffb02e",
      backgroundColor: "rgba(0,0,0,.55)",
      padding: { x: 8, y: 5 }
    }).setScrollFactor(0);
  }

  update() {
    const build = this.registry.get("buildName") || "Phaser migration";
    const status = this.registry.get("statusText") || "No status";
    const xy = this.registry.get("playerXY") || "0, 0";
    const interaction = this.registry.get("interactionPrompt") || "";
    const lastAction = this.registry.get("lastActionText") || "";

    this.title.setText(`Night Blood District · ${build}`);
    this.status.setText(`${status} · ${xy}`);
    this.prompt.setText(interaction || lastAction || "Explore the district routes.");
    this.prompt.setColor(interaction ? "#fff2a8" : "#9d93b8");
  }
}
