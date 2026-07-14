import { COLORS } from "../data/balance.js";

const FONT = "monospace";
const GAME_SCENE = "GameScene";

export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
    this.introOpen = true;
    this.helpOpen = false;
  }

  create() {
    this.keys = this.input.keyboard.addKeys({
      help: Phaser.Input.Keyboard.KeyCodes.H,
      escape: Phaser.Input.Keyboard.KeyCodes.ESC,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER
    });

    this.createTopMenu();
    this.createFooter();
    this.createInteractionMenu();
    this.createIntroOverlay();
    this.createHelpOverlay();

    this.phase = this.add.text(14, 606, "PHASE 11: powers + Blood Sense polish", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#ffb02e",
      backgroundColor: "rgba(0,0,0,.55)",
      padding: { x: 8, y: 5 }
    }).setScrollFactor(0).setDepth(20);

    this.updateUiPause();
    this.renderOverlays();
  }

  createTopMenu() {
    this.topPanel = this.add.rectangle(0, 0, 960, 78, 0x05060b, 0.86).setOrigin(0, 0).setScrollFactor(0).setDepth(10);
    this.topPanel.setStrokeStyle(1, 0x2d3045, 1);

    this.title = this.add.text(16, 10, "Night Blood District", {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#f1e6ff"
    }).setScrollFactor(0).setDepth(11);

    this.objective = this.add.text(178, 11, "Objective: booting...", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#ffb02e",
      wordWrap: { width: 520 }
    }).setScrollFactor(0).setDepth(11);

    this.helpButton = this.add.rectangle(884, 19, 104, 24, 0x15121d, 0.96).setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.helpButton.setStrokeStyle(1, 0x78c7a3, 0.8);
    this.helpButtonLabel = this.add.text(838, 12, "HELP · H", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#78c7a3"
    }).setScrollFactor(0).setDepth(13);
    this.helpButton.on("pointerdown", () => this.toggleHelp());

    this.statRowA = this.add.text(16, 35, "", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#d7c8ff"
    }).setScrollFactor(0).setDepth(11);

    this.statRowB = this.add.text(16, 54, "", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#9d93b8"
    }).setScrollFactor(0).setDepth(11);
  }

  createFooter() {
    this.prompt = this.add.text(16, 570, "", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#fff2a8",
      backgroundColor: "rgba(0,0,0,.50)",
      padding: { x: 8, y: 4 }
    }).setScrollFactor(0).setDepth(15);

    this.lastAction = this.add.text(16, 590, "", {
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
      "A journalist is about to expose your clan.\nYour order is simple: find him near the nightclub, isolate him, feed, and clean the scene before the district understands what happened.", {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#d7c8ff",
        lineSpacing: 7,
        wordWrap: { width: 500 }
      }).setScrollFactor(0).setDepth(222));

    add(this.add.text(236, 292,
      "Core loop: traverse roofs/sewers · use shadows · manage hunger · avoid witnesses · hide bodies.\nPowers: Q/Space Dash · R Whisper · F Blood Sense · H Help", {
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

  createHelpOverlay() {
    this.helpItems = [];
    const add = item => {
      this.helpItems.push(item);
      return item;
    };

    add(this.add.rectangle(480, 320, 960, 640, 0x000000, 0.62).setScrollFactor(0).setDepth(240));
    const panel = add(this.add.rectangle(480, 318, 650, 385, 0x08080e, 0.98).setScrollFactor(0).setDepth(241));
    panel.setStrokeStyle(1, 0x78c7a3, 0.9);

    add(this.add.text(198, 142, "Help / Controls", {
      fontFamily: FONT,
      fontSize: "20px",
      color: "#f1e6ff"
    }).setScrollFactor(0).setDepth(242));

    add(this.add.text(198, 182,
      "Movement: WASD / arrows · Shift sprint\nInteract: E near routes, targets, bodies, witnesses, lamps\nPowers: Q/Space Shadow Dash · R Whisper · F Blood Sense\nStealth: rooftops, sewers and deep shadows hide you\nExposure: public feeding, witnesses and impossible movement bring police\nHunters: appear later, follow blood, and may block escape routes\nEvidence: drag bodies to dumpsters, sewers, roofs or shadows\n\nPress H or Esc to close this help.", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#d7c8ff",
        lineSpacing: 7,
        wordWrap: { width: 560 }
      }).setScrollFactor(0).setDepth(242));

    const closeButton = add(this.add.rectangle(480, 485, 190, 34, 0x15121d, 1).setScrollFactor(0).setDepth(242).setInteractive({ useHandCursor: true }));
    closeButton.setStrokeStyle(1, 0x78c7a3, 1);
    add(this.add.text(424, 475, "Close help · H", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#78c7a3"
    }).setScrollFactor(0).setDepth(243));
    closeButton.on("pointerdown", () => this.toggleHelp(false));
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.help) && !this.introOpen) this.toggleHelp();
    if (Phaser.Input.Keyboard.JustDown(this.keys.escape) && this.helpOpen) this.toggleHelp(false);
    if (Phaser.Input.Keyboard.JustDown(this.keys.enter) && this.introOpen) this.closeIntro();

    const build = this.registry.get("buildName") || "Phaser";
    const mission = this.registry.get("missionText") || "Objective unavailable";
    const status = this.registry.get("statusText") || "No status";
    const visibility = this.registry.get("visibilityText") || "Visibility unknown";
    const exposureText = this.registry.get("exposureText") || "Exposure unavailable";
    const policeText = this.registry.get("policeText") || "Police unavailable";
    const witnessText = this.registry.get("witnessText") || "Witnesses unavailable";
    const hunterText = this.registry.get("hunterText") || "Hunters dormant";
    const evidenceText = this.registry.get("evidenceText") || "Evidence unavailable";
    const hungerText = this.registry.get("hungerText") || "Hunger unavailable";
    const powersText = this.registry.get("powersText") || "Powers unavailable";
    const menu = this.registry.get("interactionMenu");
    const prompt = menu
      ? "Interaction menu open"
      : this.registry.get("interactionPrompt") || "Q/Space Dash · R Whisper · F Blood Sense · E interact · H Help";
    const lastAction = this.registry.get("lastActionText") || "";

    this.title.setText(`Night Blood District · ${build}`);
    this.objective.setText(`Objective: ${mission}`);
    this.statRowA.setText(`${hungerText}   |   ${exposureText}   |   ${visibility}`);
    this.statRowB.setText(`${policeText}   |   ${hunterText}   |   ${witnessText}   |   ${evidenceText}   |   ${powersText}`);
    this.prompt.setText(prompt);
    this.lastAction.setText(`${status}${lastAction ? " · " + lastAction : ""}`);

    this.renderInteractionMenu(menu);
    this.renderOverlays();
    this.updateUiPause();
  }

  closeIntro() {
    this.introOpen = false;
    this.renderOverlays();
    this.updateUiPause();
  }

  toggleHelp(force) {
    this.helpOpen = typeof force === "boolean" ? force : !this.helpOpen;
    this.renderOverlays();
    this.updateUiPause();
  }

  renderOverlays() {
    for (const item of this.introItems) item.setVisible(this.introOpen);
    for (const item of this.helpItems) item.setVisible(this.helpOpen && !this.introOpen);
  }

  updateUiPause() {
    const shouldPause = this.introOpen || this.helpOpen;
    if (shouldPause && !this.scene.isPaused(GAME_SCENE)) this.scene.pause(GAME_SCENE);
    if (!shouldPause && this.scene.isPaused(GAME_SCENE)) this.scene.resume(GAME_SCENE);
  }

  renderInteractionMenu(menu) {
    const open = Boolean(menu && menu.options && menu.options.length) && !this.introOpen && !this.helpOpen;
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
