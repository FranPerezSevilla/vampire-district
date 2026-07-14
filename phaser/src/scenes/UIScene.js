import { COLORS } from "../data/balance.js";

export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
  }

  create() {
    this.panel = this.add.rectangle(14, 14, 700, 226, 0x05060b, 0.78).setOrigin(0, 0).setScrollFactor(0);
    this.panel.setStrokeStyle(1, 0x2d3045, 1);

    this.title = this.add.text(26, 24, "Night Blood District · Phaser", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#f1e6ff"
    }).setScrollFactor(0);

    this.objective = this.add.text(26, 44, "Objective: booting...", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#ffb02e"
    }).setScrollFactor(0);

    this.status = this.add.text(26, 63, "Booting...", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#78c7a3"
    }).setScrollFactor(0);

    this.visibility = this.add.text(26, 80, "Visibility: unknown", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#d7c8ff"
    }).setScrollFactor(0);

    this.exposure = this.add.text(26, 97, "Exposure: loading", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffb02e"
    }).setScrollFactor(0);

    this.police = this.add.text(26, 114, "Police: loading", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#4da3ff"
    }).setScrollFactor(0);

    this.witness = this.add.text(26, 131, "Witnesses: loading", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ff3b50"
    }).setScrollFactor(0);

    this.evidence = this.add.text(26, 148, "Evidence: loading", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#78c7a3"
    }).setScrollFactor(0);

    this.npcs = this.add.text(26, 165, "NPCs: loading", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#c8b58a"
    }).setScrollFactor(0);

    this.hunger = this.add.text(26, 182, "Hunger: loading", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ff3b50"
    }).setScrollFactor(0);

    this.prompt = this.add.text(26, 199, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#fff2a8"
    }).setScrollFactor(0);

    this.lastAction = this.add.text(26, 214, "", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9d93b8"
    }).setScrollFactor(0);

    this.phase = this.add.text(14, 606, "PHASE 10: hunters + route blocking", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffb02e",
      backgroundColor: "rgba(0,0,0,.55)",
      padding: { x: 8, y: 5 }
    }).setScrollFactor(0);

    this.menuBackdrop = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.52).setScrollFactor(0).setDepth(100).setVisible(false);
    this.menuPanel = this.add.rectangle(480, 320, 450, 240, 0x08080e, 0.96).setScrollFactor(0).setDepth(101).setVisible(false);
    this.menuPanel.setStrokeStyle(1, 0xd7c8ff, 0.75);
    this.menuTitle = this.add.text(280, 224, "Choose interaction", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#f1e6ff"
    }).setScrollFactor(0).setDepth(102).setVisible(false);
    this.menuHint = this.add.text(280, 244, "W/S or arrows · E/Enter confirm · Esc cancel · 1-9 quick select", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9d93b8"
    }).setScrollFactor(0).setDepth(102).setVisible(false);

    this.menuRows = [];
    for (let i = 0; i < 9; i++) {
      const y = 270 + i * 18;
      const bg = this.add.rectangle(480, y - 4, 410, 16, 0x78c7a3, 0.0).setScrollFactor(0).setDepth(102).setVisible(false);
      const label = this.add.text(286, y - 10, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f1e6ff"
      }).setScrollFactor(0).setDepth(103).setVisible(false);
      const detail = this.add.text(560, y - 10, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#9d93b8"
      }).setScrollFactor(0).setDepth(103).setVisible(false);
      this.menuRows.push({ bg, label, detail });
    }
  }

  update() {
    const build = this.registry.get("buildName") || "Phaser migration";
    const mission = this.registry.get("missionText") || "Objective unavailable";
    const status = this.registry.get("statusText") || "No status";
    const visibility = this.registry.get("visibilityText") || "Visibility unknown";
    const exposureText = this.registry.get("exposureText") || "Exposure unavailable";
    const policeText = this.registry.get("policeText") || "Police unavailable";
    const witnessText = this.registry.get("witnessText") || "Witnesses unavailable";
    const hunterText = this.registry.get("hunterText") || "Hunters dormant";
    const evidenceText = this.registry.get("evidenceText") || "Evidence unavailable";
    const npcText = this.registry.get("npcText") || "NPCs unavailable";
    const hungerText = this.registry.get("hungerText") || "Hunger unavailable";
    const xy = this.registry.get("playerXY") || "0, 0";
    const menu = this.registry.get("interactionMenu");
    const prompt = menu
      ? "Interaction menu open"
      : this.registry.get("interactionPrompt") || "E near routes/lamps/objectives/feed/body/witnesses · movement cancels feeding";
    const lastAction = this.registry.get("lastActionText") || "";

    this.title.setText(`Night Blood District · ${build}`);
    this.objective.setText(`Objective: ${mission}`);
    this.status.setText(`${status} · ${xy}`);
    this.visibility.setText(`Visibility: ${visibility}`);
    this.exposure.setText(exposureText);
    this.police.setText(policeText);
    this.witness.setText(witnessText);
    this.hunter.setText(hunterText);
    this.evidence.setText(evidenceText);
    this.npcs.setText(`NPCs: ${npcText}`);
    this.hunger.setText(hungerText);
    this.prompt.setText(prompt);
    this.lastAction.setText(lastAction);
    this.renderInteractionMenu(menu);
  }

  renderInteractionMenu(menu) {
    const open = Boolean(menu && menu.options && menu.options.length);
    this.menuBackdrop.setVisible(open);
    this.menuPanel.setVisible(open);
    this.menuTitle.setVisible(open);
    this.menuHint.setVisible(open);

    for (const row of this.menuRows) {
      row.bg.setVisible(false);
      row.label.setVisible(false);
      row.detail.setVisible(false);
    }

    if (!open) return;

    const options = menu.options.slice(0, this.menuRows.length);
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const row = this.menuRows[i];
      const selected = i === menu.index;
      row.bg.setVisible(true).setFillStyle(0x78c7a3, selected ? 0.20 : 0.04);
      row.label.setVisible(true).setText(`${i + 1}. ${option.label}`).setColor(selected ? "#78c7a3" : "#f1e6ff");
      row.detail.setVisible(true).setText(option.detail || option.type || "action").setColor(selected ? "#d7ffec" : "#9d93b8");
    }
  }
}
