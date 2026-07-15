import { COLORS } from "../data/balance.js";

const FONT = "monospace";

const POWER_CONFIG = Object.freeze({
  dash: { key: "Q", label: "Dash", max: 3.0, color: 0xa75cff, x: 805, y: 570 },
  whisper: { key: "R", label: "Whisper", max: 4.8, color: 0xff4bd8, x: 870, y: 570 },
  sense: { key: "F", label: "Sense", max: 4.0, color: 0x78c7a3, x: 935, y: 570 }
});

export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
    this.introOpen = true;
    this.pauseOpen = false;
    this.pauseTab = "controls";
  }

  create() {
    this.keys = this.input.keyboard.addKeys({
      help: Phaser.Input.Keyboard.KeyCodes.H,
      escape: Phaser.Input.Keyboard.KeyCodes.ESC,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER
    });

    this.createTopHud();
    this.createPowerOrbs();
    this.createFooter();
    this.createInteractionMenu();
    this.createIntroOverlay();
    this.createPauseOverlay();

    this.phase = this.add.text(14, 606, "PHASE 11: powers + UI pass", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#ffb02e",
      backgroundColor: "rgba(0,0,0,.55)",
      padding: { x: 8, y: 5 }
    }).setScrollFactor(0).setDepth(20);

    this.updateUiPause();
    this.renderOverlays();
  }

  createTopHud() {
    this.topPanel = this.add.rectangle(0, 0, 960, 48, 0x05060b, 0.88).setOrigin(0, 0).setScrollFactor(0).setDepth(10);
    this.topPanel.setStrokeStyle(1, 0x2d3045, 1);

    this.title = this.add.text(16, 10, "Night Blood District", {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#f1e6ff"
    }).setScrollFactor(0).setDepth(11);

    this.hungerBadge = this.add.text(350, 10, "Hunger --", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#ff3b50",
      backgroundColor: "rgba(53,16,27,.72)",
      padding: { x: 8, y: 5 }
    }).setScrollFactor(0).setDepth(11);

    this.exposureBadge = this.add.text(510, 10, "Exposure --", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#ffb02e",
      backgroundColor: "rgba(45,29,10,.72)",
      padding: { x: 8, y: 5 }
    }).setScrollFactor(0).setDepth(11);

    this.menuButton = this.add.rectangle(898, 24, 106, 28, 0x15121d, 0.96).setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.menuButton.setStrokeStyle(1, 0x78c7a3, 0.85);
    this.menuButtonLabel = this.add.text(854, 16, "MENU · H", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#78c7a3"
    }).setScrollFactor(0).setDepth(13);
    this.menuButton.on("pointerdown", () => this.togglePause());
  }

  createPowerOrbs() {
    this.powerGraphics = this.add.graphics().setScrollFactor(0).setDepth(16);
    this.powerTexts = {};
    for (const [id, cfg] of Object.entries(POWER_CONFIG)) {
      this.powerTexts[id] = {
        key: this.add.text(cfg.x, cfg.y - 2, cfg.key, {
          fontFamily: FONT,
          fontSize: "13px",
          color: "#f1e6ff"
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(17),
        label: this.add.text(cfg.x, cfg.y + 26, cfg.label, {
          fontFamily: FONT,
          fontSize: "9px",
          color: "#d7c8ff"
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(17)
      };
    }
  }

  createFooter() {
    this.objective = this.add.text(16, 518, "Objective: booting...", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#ffb02e",
      backgroundColor: "rgba(0,0,0,.55)",
      padding: { x: 8, y: 4 },
      wordWrap: { width: 680 }
    }).setScrollFactor(0).setDepth(15);

    this.prompt = this.add.text(16, 548, "", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#fff2a8",
      backgroundColor: "rgba(0,0,0,.50)",
      padding: { x: 8, y: 4 },
      wordWrap: { width: 720 }
    }).setScrollFactor(0).setDepth(15);

    this.lastAction = this.add.text(16, 592, "", {
      fontFamily: FONT,
      fontSize: "9px",
      color: "#9d93b8",
      backgroundColor: "rgba(0,0,0,.45)",
      padding: { x: 8, y: 4 },
      wordWrap: { width: 720 }
    }).setScrollFactor(0).setDepth(15);
  }

  createInteractionMenu() {
    this.menuBackdrop = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.52).setScrollFactor(0).setDepth(100).setVisible(false);
    this.menuPanel = this.add.rectangle(480, 320, 450, 240, 0x08080e, 0.96).setScrollFactor(0).setDepth(101).setVisible(false);
    this.menuPanel.setStrokeStyle(1, 0xd7c8ff, 0.75);
    this.menuTitle = this.add.text(280, 224, "Choose interaction", {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#f1e6ff"
    }).setScrollFactor(0).setDepth(102).setVisible(false);
    this.menuHint = this.add.text(280, 244, "W/S or arrows · E/Enter confirm · Esc cancel · 1-9 quick select", {
      fontFamily: FONT,
      fontSize: "9px",
      color: "#9d93b8"
    }).setScrollFactor(0).setDepth(102).setVisible(false);

    this.menuRows = [];
    for (let i = 0; i < 9; i++) {
      const y = 270 + i * 18;
      const bg = this.add.rectangle(480, y - 4, 410, 16, 0x78c7a3, 0.0).setScrollFactor(0).setDepth(102).setVisible(false);
      const label = this.add.text(286, y - 10, "", {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#f1e6ff"
      }).setScrollFactor(0).setDepth(103).setVisible(false);
      const detail = this.add.text(560, y - 10, "", {
        fontFamily: FONT,
        fontSize: "9px",
        color: "#9d93b8"
      }).setScrollFactor(0).setDepth(103).setVisible(false);
      this.menuRows.push({ bg, label, detail });
    }
  }

  createIntroOverlay() {
    this.introItems = [];
    const add = item => {
      this.introItems.push(item);
      return item;
    };

    add(this.add.rectangle(480, 320, 960, 640, 0x000000, 0.72).setScrollFactor(0).setDepth(220));
    const panel = add(this.add.rectangle(480, 315, 620, 350, 0x08080e, 0.97).setScrollFactor(0).setDepth(221));
    panel.setStrokeStyle(1, COLORS.magic, 0.95);

    add(this.add.text(236, 166, "Night Blood District", {
      fontFamily: FONT,
      fontSize: "26px",
      color: "#f1e6ff"
    }).setScrollFactor(0).setDepth(222));

    add(this.add.text(236, 205,
      "A journalist is about to expose your clan.\nFind him near the nightclub, isolate him, feed, and clean the scene before the district understands what happened.", {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#d7c8ff",
        lineSpacing: 7,
        wordWrap: { width: 500 }
      }).setScrollFactor(0).setDepth(222));

    add(this.add.text(236, 292,
      "Core loop: roofs/sewers · shadows · hunger · witnesses · evidence cleanup.\nPowers: Q/Space Dash · R Whisper · F Blood Sense · H Menu", {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#78c7a3",
        lineSpacing: 6,
        wordWrap: { width: 500 }
      }).setScrollFactor(0).setDepth(222));

    const startButton = add(this.add.rectangle(480, 421, 210, 38, 0x15121d, 1).setScrollFactor(0).setDepth(222).setInteractive({ useHandCursor: true }));
    startButton.setStrokeStyle(1, 0xffb02e, 1);
    add(this.add.text(414, 410, "Start run · Enter", {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#ffb02e"
    }).setScrollFactor(0).setDepth(223));
    startButton.on("pointerdown", () => this.closeIntro());
  }

  createPauseOverlay() {
    this.pauseItems = [];
    const add = item => {
      this.pauseItems.push(item);
      return item;
    };

    add(this.add.rectangle(480, 320, 960, 640, 0x000000, 0.62).setScrollFactor(0).setDepth(240));
    const panel = add(this.add.rectangle(480, 318, 680, 400, 0x08080e, 0.98).setScrollFactor(0).setDepth(241));
    panel.setStrokeStyle(1, 0x78c7a3, 0.9);

    add(this.add.text(174, 132, "Pause Menu", {
      fontFamily: FONT,
      fontSize: "20px",
      color: "#f1e6ff"
    }).setScrollFactor(0).setDepth(242));

    this.controlsTab = add(this.add.rectangle(264, 176, 130, 28, 0x15121d, 1).setScrollFactor(0).setDepth(242).setInteractive({ useHandCursor: true }));
    this.statsTab = add(this.add.rectangle(404, 176, 130, 28, 0x15121d, 1).setScrollFactor(0).setDepth(242).setInteractive({ useHandCursor: true }));
    this.controlsTabText = add(this.add.text(222, 168, "Controls", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#78c7a3"
    }).setScrollFactor(0).setDepth(243));
    this.statsTabText = add(this.add.text(374, 168, "Stats", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#9d93b8"
    }).setScrollFactor(0).setDepth(243));
    this.controlsTab.on("pointerdown", () => this.setPauseTab("controls"));
    this.statsTab.on("pointerdown", () => this.setPauseTab("stats"));

    this.pauseContent = add(this.add.text(176, 214, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#d7c8ff",
      lineSpacing: 7,
      wordWrap: { width: 610 }
    }).setScrollFactor(0).setDepth(242));

    const closeButton = add(this.add.rectangle(480, 496, 190, 34, 0x15121d, 1).setScrollFactor(0).setDepth(242).setInteractive({ useHandCursor: true }));
    closeButton.setStrokeStyle(1, 0x78c7a3, 1);
    add(this.add.text(426, 486, "Close · H / Esc", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#78c7a3"
    }).setScrollFactor(0).setDepth(243));
    closeButton.on("pointerdown", () => this.togglePause(false));
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.enter) && this.introOpen) this.closeIntro();
    if (Phaser.Input.Keyboard.JustDown(this.keys.help)) this.togglePause();
    if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) {
      if (this.pauseOpen) this.togglePause(false);
      else if (this.introOpen) this.closeIntro();
    }

    const mission = this.registry.get("missionText") || "Objective unavailable";
    const visibility = this.registry.get("visibilityText") || "Visibility unknown";
    const exposureText = this.registry.get("exposureText") || "Exposure unavailable";
    const policeText = this.registry.get("policeText") || "Police unavailable";
    const witnessText = this.registry.get("witnessText") || "Witnesses unavailable";
    const hunterText = this.registry.get("hunterText") || "Hunters dormant";
    const evidenceText = this.registry.get("evidenceText") || "Evidence unavailable";
    const npcText = this.registry.get("npcText") || "NPCs unavailable";
    const hungerText = this.registry.get("hungerText") || "Hunger unavailable";
    const powersText = this.registry.get("powersText") || "Powers unavailable";
    const xy = this.registry.get("playerXY") || "0, 0";
    const menu = this.registry.get("interactionMenu");
    const prompt = menu
      ? "Interaction menu open"
      : this.registry.get("interactionPrompt") || "Q/Space Dash · R Whisper · F Blood Sense · E interact/feed/body/routes";
    const lastAction = this.registry.get("lastActionText") || "";

    this.hungerBadge.setText(this.compactHunger(hungerText));
    this.exposureBadge.setText(this.compactExposure(exposureText));
    this.objective.setText(`Objective: ${mission}`);
    this.prompt.setText(prompt);
    this.lastAction.setText(lastAction);

    this.renderPowerOrbs(powersText);
    this.renderInteractionMenu(menu);
    this.renderPauseContent({ mission, visibility, exposureText, policeText, witnessText, hunterText, evidenceText, npcText, hungerText, powersText, xy, lastAction });
    this.renderOverlays();
  }

  compactHunger(text) {
    const match = String(text).match(/Hunger\s+([^·]+)/i);
    return `Hunger ${match ? match[1].trim() : "--"}`;
  }

  compactExposure(text) {
    const match = String(text).match(/Exposure\s+([^·]+)/i);
    return `Exposure ${match ? match[1].trim() : "--"}`;
  }

  renderPowerOrbs(powersText) {
    this.powerGraphics.clear();
    const text = String(powersText || "");
    for (const [id, cfg] of Object.entries(POWER_CONFIG)) {
      const remaining = this.cooldownFor(text, cfg.label);
      const ready = remaining <= 0;
      const pct = ready ? 1 : Phaser.Math.Clamp(1 - remaining / cfg.max, 0, 1);
      this.drawPowerOrb(cfg.x, cfg.y, 21, cfg.color, pct, ready);
      this.powerTexts[id].label.setText(ready ? cfg.label : remaining.toFixed(1));
      this.powerTexts[id].label.setColor(ready ? "#d7c8ff" : "#9d93b8");
    }
  }

  cooldownFor(text, label) {
    const match = text.match(new RegExp(`${label}\\s+(ready|[0-9.]+)`, "i"));
    if (!match || match[1].toLowerCase() === "ready") return 0;
    return Number.parseFloat(match[1]) || 0;
  }

  drawPowerOrb(x, y, r, color, pct, ready) {
    this.powerGraphics.fillStyle(0x08080e, 0.92).fillCircle(x, y, r + 4);
    this.powerGraphics.lineStyle(2, color, ready ? 0.95 : 0.40).strokeCircle(x, y, r + 4);
    this.powerGraphics.fillStyle(color, ready ? 0.22 : 0.08).fillCircle(x, y, r);

    if (!ready) {
      this.powerGraphics.fillStyle(color, 0.42);
      this.powerGraphics.beginPath();
      this.powerGraphics.moveTo(x, y);
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * pct;
      const steps = Math.max(4, Math.ceil(32 * pct));
      for (let i = 0; i <= steps; i++) {
        const a = start + (end - start) * (i / steps);
        this.powerGraphics.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      this.powerGraphics.closePath();
      this.powerGraphics.fillPath();
    } else {
      this.powerGraphics.lineStyle(1, 0xf1e6ff, 0.45).strokeCircle(x, y, r - 5);
    }
  }

  renderPauseContent(data) {
    if (!this.pauseContent) return;
    if (this.pauseTab === "controls") {
      this.pauseContent.setText(
        "Movement: WASD / arrows · Shift sprint\n" +
        "Interact: E near routes, targets, bodies, witnesses, lamps\n" +
        "Powers: Q/Space Shadow Dash · R Whisper · F Blood Sense\n" +
        "Stealth: rooftops, sewers and deep shadows hide you\n" +
        "Exposure: public feeding, witnesses and impossible movement bring police\n" +
        "Hunters: appear later, follow blood, and may block escape routes\n" +
        "Evidence: drag bodies to dumpsters, sewers, roofs or shadows\n\n" +
        "Use the Stats tab for debug/state info. Press H or Esc to close."
      );
    } else {
      this.pauseContent.setText(
        `Objective: ${data.mission}\n` +
        `Visibility: ${data.visibility}\n` +
        `${data.hungerText}\n` +
        `${data.exposureText}\n` +
        `${data.powersText}\n` +
        `${data.policeText}\n` +
        `${data.hunterText}\n` +
        `${data.witnessText}\n` +
        `${data.evidenceText}\n` +
        `NPCs: ${data.npcText}\n` +
        `Position: ${data.xy}\n` +
        `Last: ${data.lastAction || "--"}`
      );
    }

    this.controlsTab.setFillStyle(this.pauseTab === "controls" ? 0x1b332d : 0x15121d, 1);
    this.statsTab.setFillStyle(this.pauseTab === "stats" ? 0x1b332d : 0x15121d, 1);
    this.controlsTabText.setColor(this.pauseTab === "controls" ? "#78c7a3" : "#9d93b8");
    this.statsTabText.setColor(this.pauseTab === "stats" ? "#78c7a3" : "#9d93b8");
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

  renderOverlays() {
    for (const item of this.introItems || []) item.setVisible(this.introOpen);
    for (const item of this.pauseItems || []) item.setVisible(this.pauseOpen);
  }

  closeIntro() {
    this.introOpen = false;
    this.updateUiPause();
    this.renderOverlays();
  }

  togglePause(force) {
    if (this.introOpen && force !== false) return;
    this.pauseOpen = typeof force === "boolean" ? force : !this.pauseOpen;
    this.updateUiPause();
    this.renderOverlays();
  }

  setPauseTab(tab) {
    this.pauseTab = tab;
    this.renderOverlays();
  }

  updateUiPause() {
    const paused = this.introOpen || this.pauseOpen;
    this.registry.set("uiPaused", paused);
    if (paused) this.scene.pause("GameScene");
    else this.scene.resume("GameScene");
  }
}
