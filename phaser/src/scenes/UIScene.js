import { COLORS } from "../data/balance.js";

const FONT = "Arial, Helvetica, sans-serif";
const PANEL_BG = 0x070811;

const POWER_CONFIG = Object.freeze({
  dash: { key: "Q", label: "Dash", max: 3.0, color: 0xa75cff, x: 44, y: 158 },
  whisper: { key: "R", label: "Whisper", max: 4.8, color: 0xff4bd8, x: 44, y: 246 },
  sense: { key: "F", label: "Sense", max: 4.0, color: 0x78c7a3, x: 44, y: 334 }
});

export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
    this.introOpen = true;
    this.pauseOpen = false;
    this.pauseTab = "controls";
    this.resultOpen = false;
    this.resultType = null;
    this.resultDismissed = false;
    this.missionOpen = false;
  }

  create() {
    this.keys = this.input.keyboard.addKeys({
      help: Phaser.Input.Keyboard.KeyCodes.H,
      mission: Phaser.Input.Keyboard.KeyCodes.M,
      escape: Phaser.Input.Keyboard.KeyCodes.ESC,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER
    });

    this.createTopHud();
    this.createPowerOrbs();
    this.createMinimalFooter();
    this.createMissionDrawer();
    this.createInteractionMenu();
    this.createIntroOverlay();
    this.createPauseOverlay();
    this.createResultOverlay();

    this.updateUiPause();
    this.renderOverlays();
  }

  uiText(x, y, text, style = {}, depth = 11) {
    return this.add.text(x, y, text, {
      fontFamily: FONT,
      fontSize: style.fontSize || "13px",
      color: style.color || "#f1e6ff",
      backgroundColor: style.backgroundColor,
      padding: style.padding,
      wordWrap: style.wordWrap,
      lineSpacing: style.lineSpacing ?? 4,
      fontStyle: style.fontStyle
    }).setScrollFactor(0).setDepth(depth).setResolution(2);
  }

  createTopHud() {
    this.topPanel = this.add.rectangle(0, 0, 960, 50, PANEL_BG, 0.94).setOrigin(0, 0).setScrollFactor(0).setDepth(10);
    this.topPanel.setStrokeStyle(1, 0x2d3045, 1);

    this.title = this.uiText(16, 13, "Night Blood District", { fontSize: "15px", color: "#f1e6ff", fontStyle: "bold" }, 11);
    this.hungerBadge = this.uiText(274, 12, "Hunger --", { fontSize: "12px", color: "#ff3b50", backgroundColor: "rgba(53,16,27,.75)", padding: { x: 8, y: 5 } }, 11);
    this.exposureBadge = this.uiText(404, 12, "Exposure --", { fontSize: "12px", color: "#ffb02e", backgroundColor: "rgba(45,29,10,.75)", padding: { x: 8, y: 5 } }, 11);

    this.missionButton = this.add.rectangle(650, 25, 190, 30, 0x15121d, 0.96).setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.missionButton.setStrokeStyle(1, 0xffb02e, 0.9);
    this.missionButtonLabel = this.uiText(566, 15, "ACTIVE MISSION · M", { fontSize: "11px", color: "#ffb02e", fontStyle: "bold" }, 13);
    this.missionButton.on("pointerdown", () => this.toggleMissionDrawer());

    this.menuButton = this.add.rectangle(898, 25, 106, 30, 0x15121d, 0.96).setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.menuButton.setStrokeStyle(1, 0x78c7a3, 0.85);
    this.menuButtonLabel = this.uiText(854, 15, "MENU · H", { fontSize: "11px", color: "#78c7a3", fontStyle: "bold" }, 13);
    this.menuButton.on("pointerdown", () => this.togglePause());
  }

  createPowerOrbs() {
    this.powerGraphics = this.add.graphics().setScrollFactor(0).setDepth(16);
    this.powerTexts = {};
    this.powerRailTitle = this.uiText(17, 100, "POWERS", { fontSize: "9px", color: "#9d93b8", fontStyle: "bold" }, 17);
    for (const [id, cfg] of Object.entries(POWER_CONFIG)) {
      this.powerTexts[id] = {
        key: this.uiText(cfg.x - 5, cfg.y - 10, cfg.key, { fontSize: "14px", color: "#f1e6ff", fontStyle: "bold" }, 17),
        label: this.uiText(cfg.x - 21, cfg.y + 26, cfg.label, { fontSize: "10px", color: "#d7c8ff" }, 17)
      };
    }
  }

  createMinimalFooter() {
    this.prompt = this.uiText(90, 548, "", { fontSize: "12px", color: "#fff2a8", backgroundColor: "rgba(0,0,0,.62)", padding: { x: 9, y: 5 }, wordWrap: { width: 760 } }, 15);
    this.actionToast = this.uiText(90, 584, "", { fontSize: "11px", color: "#b8aecf", backgroundColor: "rgba(0,0,0,.46)", padding: { x: 8, y: 4 }, wordWrap: { width: 760 } }, 15);
  }

  createMissionDrawer() {
    this.missionItems = [];
    const add = item => { this.missionItems.push(item); return item; };
    add(this.add.rectangle(670, 174, 430, 218, 0x08080e, 0.97).setScrollFactor(0).setDepth(80));
    this.missionPanelBorder = add(this.add.rectangle(670, 174, 430, 218, 0x000000, 0).setScrollFactor(0).setDepth(81));
    this.missionPanelBorder.setStrokeStyle(1, 0xffb02e, 0.9);
    this.missionTitle = add(this.uiText(476, 82, "ACTIVE MISSION", { fontSize: "15px", color: "#ffb02e", fontStyle: "bold" }, 82));
    this.missionChecklist = add(this.uiText(476, 116, "", { fontSize: "13px", color: "#f1e6ff", lineSpacing: 8, wordWrap: { width: 380 } }, 82));
    this.missionLast = add(this.uiText(476, 282, "", { fontSize: "11px", color: "#9d93b8", wordWrap: { width: 380 } }, 82));
  }

  createInteractionMenu() {
    this.menuBackdrop = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.52).setScrollFactor(0).setDepth(100).setVisible(false);
    this.menuPanel = this.add.rectangle(480, 320, 450, 240, 0x08080e, 0.96).setScrollFactor(0).setDepth(101).setVisible(false);
    this.menuPanel.setStrokeStyle(1, 0xd7c8ff, 0.75);
    this.menuTitle = this.uiText(280, 224, "Choose interaction", { fontSize: "15px", color: "#f1e6ff", fontStyle: "bold" }, 102).setVisible(false);
    this.menuHint = this.uiText(280, 246, "W/S or arrows · E/Enter confirm · Esc cancel · 1-9 quick select", { fontSize: "10px", color: "#9d93b8" }, 102).setVisible(false);
    this.menuRows = [];
    for (let i = 0; i < 9; i++) {
      const y = 274 + i * 19;
      const bg = this.add.rectangle(480, y - 4, 410, 17, 0x78c7a3, 0.0).setScrollFactor(0).setDepth(102).setVisible(false);
      const label = this.uiText(286, y - 11, "", { fontSize: "11px", color: "#f1e6ff" }, 103).setVisible(false);
      const detail = this.uiText(560, y - 11, "", { fontSize: "10px", color: "#9d93b8" }, 103).setVisible(false);
      this.menuRows.push({ bg, label, detail });
    }
  }

  createIntroOverlay() {
    this.introItems = [];
    const add = item => { this.introItems.push(item); return item; };
    add(this.add.rectangle(480, 320, 960, 640, 0x000000, 0.72).setScrollFactor(0).setDepth(220));
    const panel = add(this.add.rectangle(480, 315, 650, 380, 0x08080e, 0.97).setScrollFactor(0).setDepth(221));
    panel.setStrokeStyle(1, COLORS.magic, 0.95);
    add(this.uiText(222, 144, "Night Blood District", { fontSize: "26px", color: "#f1e6ff", fontStyle: "bold" }, 222));
    add(this.uiText(222, 184, "You are a vampire fixer for the clan. A journalist is close to exposing what hunts this district. If civilians understand the truth, the veil breaks and the run is over.", { fontSize: "14px", color: "#d7c8ff", lineSpacing: 8, wordWrap: { width: 540 } }, 222));
    add(this.uiText(222, 280, "First task: cross rooftops, neutralize the thug blocking the jump to the police station roof, and collect the informant tip. Then find the journalist near the nightclub, isolate them, and clean the scene.", { fontSize: "13px", color: "#78c7a3", lineSpacing: 7, wordWrap: { width: 540 } }, 222));
    add(this.uiText(222, 368, "Controls: WASD/arrows move · Shift sprint · E interact · Q/Space Dash · R Whisper · F Blood Sense · M Mission · H Menu", { fontSize: "12px", color: "#ffb02e", lineSpacing: 6, wordWrap: { width: 540 } }, 222));
    const startButton = add(this.add.rectangle(480, 446, 210, 38, 0x15121d, 1).setScrollFactor(0).setDepth(222).setInteractive({ useHandCursor: true }));
    startButton.setStrokeStyle(1, 0xffb02e, 1);
    add(this.uiText(414, 435, "Start run · Enter", { fontSize: "13px", color: "#ffb02e", fontStyle: "bold" }, 223));
    startButton.on("pointerdown", () => this.closeIntro());
  }

  createPauseOverlay() {
    this.pauseItems = [];
    const add = item => { this.pauseItems.push(item); return item; };
    add(this.add.rectangle(480, 320, 960, 640, 0x000000, 0.62).setScrollFactor(0).setDepth(240));
    const panel = add(this.add.rectangle(480, 318, 680, 400, 0x08080e, 0.98).setScrollFactor(0).setDepth(241));
    panel.setStrokeStyle(1, 0x78c7a3, 0.9);
    add(this.uiText(174, 132, "Pause Menu", { fontSize: "20px", color: "#f1e6ff", fontStyle: "bold" }, 242));
    this.controlsTab = add(this.add.rectangle(264, 176, 130, 28, 0x15121d, 1).setScrollFactor(0).setDepth(242).setInteractive({ useHandCursor: true }));
    this.statsTab = add(this.add.rectangle(404, 176, 130, 28, 0x15121d, 1).setScrollFactor(0).setDepth(242).setInteractive({ useHandCursor: true }));
    this.controlsTabText = add(this.uiText(222, 168, "Controls", { fontSize: "12px", color: "#78c7a3", fontStyle: "bold" }, 243));
    this.statsTabText = add(this.uiText(374, 168, "Stats", { fontSize: "12px", color: "#9d93b8", fontStyle: "bold" }, 243));
    this.controlsTab.on("pointerdown", () => this.setPauseTab("controls"));
    this.statsTab.on("pointerdown", () => this.setPauseTab("stats"));
    this.pauseContent = add(this.uiText(176, 214, "", { fontSize: "12px", color: "#d7c8ff", lineSpacing: 7, wordWrap: { width: 610 } }, 242));
    const closeButton = add(this.add.rectangle(480, 496, 190, 34, 0x15121d, 1).setScrollFactor(0).setDepth(242).setInteractive({ useHandCursor: true }));
    closeButton.setStrokeStyle(1, 0x78c7a3, 1);
    add(this.uiText(426, 486, "Close · H / Esc", { fontSize: "12px", color: "#78c7a3", fontStyle: "bold" }, 243));
    closeButton.on("pointerdown", () => this.togglePause(false));
  }

  createResultOverlay() {
    this.resultItems = [];
    const add = item => { this.resultItems.push(item); return item; };
    add(this.add.rectangle(480, 320, 960, 640, 0x000000, 0.72).setScrollFactor(0).setDepth(300));
    this.resultPanel = add(this.add.rectangle(480, 318, 650, 400, 0x08080e, 0.98).setScrollFactor(0).setDepth(301));
    this.resultPanel.setStrokeStyle(1, 0x78c7a3, 0.95);
    this.resultTitle = add(this.uiText(190, 134, "Mission Result", { fontSize: "22px", color: "#f1e6ff", fontStyle: "bold" }, 302));
    this.resultSubtitle = add(this.uiText(190, 166, "", { fontSize: "12px", color: "#9d93b8", wordWrap: { width: 580 } }, 302));
    this.resultStats = add(this.uiText(190, 214, "", { fontSize: "12px", color: "#d7c8ff", lineSpacing: 7, wordWrap: { width: 580 } }, 302));
    this.resultHint = add(this.uiText(190, 492, "", { fontSize: "11px", color: "#78c7a3", fontStyle: "bold" }, 302));
  }

  update() {
    const data = this.currentHudData();
    const menu = this.registry.get("interactionMenu");
    const prompt = menu ? "Interaction menu open" : this.registry.get("interactionPrompt") || "";

    this.updateMissionResult(data.mission);
    if (Phaser.Input.Keyboard.JustDown(this.keys.enter) && this.introOpen) this.closeIntro();
    if (this.resultOpen && Phaser.Input.Keyboard.JustDown(this.keys.enter) && this.resultType === "success") this.closeResult();
    if (!this.resultOpen && !this.introOpen && Phaser.Input.Keyboard.JustDown(this.keys.mission)) this.toggleMissionDrawer();
    if (!this.resultOpen && Phaser.Input.Keyboard.JustDown(this.keys.help)) this.togglePause();
    if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) {
      if (this.resultOpen && this.resultType === "success") this.closeResult();
      else if (this.missionOpen) this.toggleMissionDrawer(false);
      else if (!this.resultOpen && this.pauseOpen) this.togglePause(false);
      else if (!this.resultOpen && this.introOpen) this.closeIntro();
    }

    this.hungerBadge.setText(this.compactHunger(data.hungerText));
    this.exposureBadge.setText(this.compactExposure(data.exposureText));
    this.prompt.setText(this.resultOpen ? "Mission result panel open" : prompt);
    this.prompt.setVisible(Boolean(this.prompt.text));
    this.actionToast.setText(this.missionOpen || this.resultOpen ? "" : this.compactAction(data.lastAction));
    this.actionToast.setVisible(Boolean(this.actionToast.text));

    this.renderPowerOrbs(data.powersText);
    this.renderMissionDrawer(data);
    this.renderInteractionMenu(this.resultOpen || this.missionOpen ? null : menu);
    this.renderPauseContent(data);
    this.renderResultContent(data);
    this.renderOverlays();
  }

  currentHudData() {
    return {
      mission: this.registry.get("missionText") || "Objective unavailable",
      visibility: this.registry.get("visibilityText") || "Visibility unknown",
      exposureText: this.registry.get("exposureText") || "Exposure unavailable",
      policeText: this.registry.get("policeText") || "Police unavailable",
      witnessText: this.registry.get("witnessText") || "Witnesses unavailable",
      hunterText: this.registry.get("hunterText") || "Hunters dormant",
      evidenceText: this.registry.get("evidenceText") || "Evidence unavailable",
      npcText: this.registry.get("npcText") || "NPCs unavailable",
      hungerText: this.registry.get("hungerText") || "Hunger unavailable",
      powersText: this.registry.get("powersText") || "Powers unavailable",
      xy: this.registry.get("playerXY") || "0, 0",
      lastAction: this.registry.get("lastActionText") || ""
    };
  }

  updateMissionResult(missionText) {
    const text = String(missionText || "");
    if (text.startsWith("FAILED")) {
      if (!this.resultOpen || this.resultType !== "failure") this.openResult("failure");
      return;
    }
    if (text.startsWith("COMPLETE") && !this.resultDismissed) {
      if (!this.resultOpen || this.resultType !== "success") this.openResult("success");
    }
  }

  openResult(type) {
    this.resultOpen = true;
    this.resultType = type;
    if (type === "failure") this.resultDismissed = false;
    this.pauseOpen = false;
    this.missionOpen = false;
    this.updateUiPause();
  }

  closeResult() {
    if (this.resultType === "failure") return;
    this.resultOpen = false;
    this.resultType = null;
    this.resultDismissed = true;
    this.updateUiPause();
    this.renderOverlays();
  }

  toggleMissionDrawer(force) {
    if (this.resultOpen || this.introOpen || this.pauseOpen) return;
    this.missionOpen = typeof force === "boolean" ? force : !this.missionOpen;
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

  compactAction(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    return clean.length > 118 ? `${clean.slice(0, 115)}...` : clean;
  }

  renderPowerOrbs(powersText) {
    this.powerGraphics.clear();
    const text = String(powersText || "");
    this.powerGraphics.fillStyle(0x05060b, 0.55).fillRoundedRect(8, 92, 72, 308, 10);
    this.powerGraphics.lineStyle(1, 0x2d3045, 0.75).strokeRoundedRect(8, 92, 72, 308, 10);
    for (const [id, cfg] of Object.entries(POWER_CONFIG)) {
      const remaining = this.cooldownFor(text, cfg.label);
      const ready = remaining <= 0;
      const pct = ready ? 1 : Phaser.Math.Clamp(1 - remaining / cfg.max, 0, 1);
      this.drawPowerOrb(cfg.x, cfg.y, 22, cfg.color, pct, ready);
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

  renderMissionDrawer(data) {
    this.missionChecklist.setText(this.missionChecklistText(data.mission));
    this.missionLast.setText(data.lastAction ? `Last: ${this.compactAction(data.lastAction)}` : "");
  }

  missionChecklistText(mission) {
    const text = String(mission || "");
    const failed = text.startsWith("FAILED");
    const complete = text.startsWith("COMPLETE");
    const step = Number.parseInt(text.match(/^(\d)\//)?.[1] || (complete ? "4" : "0"), 10);
    const lines = [
      [1, "Reach the police-station roof"],
      [2, "Collect the informant tip"],
      [3, "Find and neutralize the journalist"],
      [4, "Return to the rooftop refuge"]
    ];
    if (failed) return `✕ Run failed\n\n${text}`;
    if (complete) return `✓ Mission complete\n\n${text}`;
    return lines.map(([n, label]) => {
      const mark = step > n ? "✓" : step === n ? "▸" : "○";
      return `${mark} ${label}`;
    }).join("\n") + `\n\n${text}`;
  }

  renderPauseContent(data) {
    if (!this.pauseContent) return;
    if (this.pauseTab === "controls") {
      this.pauseContent.setText(
        "Movement: WASD / arrows · Shift sprint\n" +
        "Interact: E near routes, targets, bodies, witnesses, lamps\n" +
        "Mission drawer: M or the ACTIVE MISSION button\n" +
        "Powers: Q/Space Shadow Dash · R Whisper · F Blood Sense\n" +
        "Vampire route: cross rooftops, neutralize the blocker, collect the police-roof tip\n" +
        "The veil: public drains can fail the mission if reported\n" +
        "Evidence: drag bodies to dumpsters, sewers, roofs or shadows"
      );
    } else {
      this.pauseContent.setText(this.statsText(data));
    }
    this.controlsTab.setFillStyle(this.pauseTab === "controls" ? 0x1b332d : 0x15121d, 1);
    this.statsTab.setFillStyle(this.pauseTab === "stats" ? 0x1b332d : 0x15121d, 1);
    this.controlsTabText.setColor(this.pauseTab === "controls" ? "#78c7a3" : "#9d93b8");
    this.statsTabText.setColor(this.pauseTab === "stats" ? "#78c7a3" : "#9d93b8");
  }

  statsText(data) {
    return `Objective: ${data.mission}\n` +
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
      `Last: ${data.lastAction || "--"}`;
  }

  renderResultContent(data) {
    if (!this.resultStats) return;
    const success = this.resultType === "success";
    const failure = this.resultType === "failure";
    this.resultPanel.setStrokeStyle(1, success ? 0x78c7a3 : 0xff3b50, 0.95);
    this.resultTitle.setText(success ? "MISSION COMPLETE" : failure ? "MISSION FAILED" : "Mission Result");
    this.resultTitle.setColor(success ? "#78c7a3" : failure ? "#ff3b50" : "#f1e6ff");
    this.resultSubtitle.setText(success ? "The journalist is handled and the vampire clan can still contain the district." : "The veil is broken. The run is over and control is locked.");
    this.resultStats.setText(this.statsText(data));
    this.resultHint.setText(success ? "Enter / Esc: continue free roam" : "Run interrupted · reload page to restart prototype");
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
    for (const item of this.resultItems || []) item.setVisible(this.resultOpen);
    for (const item of this.missionItems || []) item.setVisible(this.missionOpen && !this.resultOpen && !this.pauseOpen && !this.introOpen);
  }

  closeIntro() {
    this.introOpen = false;
    this.updateUiPause();
    this.renderOverlays();
  }

  togglePause(force) {
    if (this.resultOpen) return;
    if (this.introOpen && force !== false) return;
    this.missionOpen = false;
    this.pauseOpen = typeof force === "boolean" ? force : !this.pauseOpen;
    this.updateUiPause();
    this.renderOverlays();
  }

  setPauseTab(tab) {
    this.pauseTab = tab;
    this.renderOverlays();
  }

  updateUiPause() {
    const paused = this.introOpen || this.pauseOpen || this.resultOpen;
    this.registry.set("uiPaused", paused);
    if (paused) this.scene.pause("GameScene");
    else this.scene.resume("GameScene");
  }
}
