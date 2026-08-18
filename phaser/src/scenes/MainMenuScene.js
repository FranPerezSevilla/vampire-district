const MENU_ITEMS = Object.freeze([
  { id: "continue", label: "CONTINUE", enabled: false },
  { id: "new-night", label: "NEW NIGHT", enabled: true },
  { id: "options", label: "OPTIONS", enabled: true },
  { id: "credits", label: "CREDITS", enabled: true }
]);

const QUALITY_OPTIONS = Object.freeze([
  { key: "compact", label: "LOW", detail: "960 × 640" },
  { key: "large", label: "HIGH", detail: "1280 × 853" },
  { key: "qhd", label: "VERY HIGH", detail: "1440 × 960" },
  { key: "ultra", label: "ULTRA", detail: "1920 × 1280" }
]);

const RESOLUTION_STORAGE_KEY = "nbd-resolution-preset";
const MENU_BODY_CLASS = "viceblood-menu-active";
const MENU_STYLE_ID = "viceblood-main-menu-shell";

const UI = Object.freeze({
  white: "#f1ede6",
  muted: "#89848a",
  faint: "#5e5960",
  red: "#a8141c",
  redBright: "#ff3d46",
  black: 0x020306,
  panel: 0x07080c
});

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.selectedIndex = 1;
    this.optionIndex = 0;
    this.menuRows = [];
    this.qualityRows = [];
    this.panelMode = null;
    this.previewInputWasEnabled = true;
    this.transitioning = false;
  }

  preload() {
    this.load.svg("viceblood-logo", "phaser/assets/ui/viceblood-logo.svg");
  }

  create() {
    this.installFullscreenShell();
    this.startWorldPreview();
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    this.overlay = this.add.graphics().setDepth(1000).setScrollFactor(0);
    this.selectionBack = this.add.rectangle(0, 0, 10, 10, UI.red, 0.12)
      .setOrigin(0, 0.5)
      .setDepth(1007)
      .setScrollFactor(0);
    this.selectionRule = this.add.rectangle(0, 0, 4, 10, 0xff303a, 1)
      .setOrigin(0, 0.5)
      .setDepth(1008)
      .setScrollFactor(0);

    // Black transition layer deliberately sits below the logo. During NEW NIGHT
    // the city can disappear into black while the ViceBlood wordmark remains on top.
    this.transitionCurtain = this.add.rectangle(0, 0, 10, 10, 0x000000, 1)
      .setOrigin(0, 0)
      .setDepth(1009)
      .setScrollFactor(0)
      .setAlpha(0);

    this.logo = this.add.image(0, 0, "viceblood-logo")
      .setOrigin(0, 0)
      .setDepth(1010)
      .setScrollFactor(0);

    this.kicker = this.add.text(0, 0, "AN URBAN VAMPIRE SANDBOX", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "700",
      color: "#908b91",
      letterSpacing: 3
    }).setOrigin(0, 0).setDepth(1010).setScrollFactor(0);

    this.menuGroup = this.add.container(0, 0).setDepth(1010).setScrollFactor(0);
    this.panelGroup = this.add.container(0, 0).setDepth(1020).setScrollFactor(0).setVisible(false);

    this.createMenuRows();
    this.createFooter();
    this.createPanel();
    this.layout();
    this.refreshSelection();
    this.bindInput();

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupMenuShell());

    // The HTML cover owns the loading/splash phase. Only reveal the fully composed
    // fullscreen Phaser menu once the scene and its logo are ready.
    this.time.delayedCall(140, () => this.revealMenuFromSplash());
  }

  revealMenuFromSplash() {
    if (typeof window.NBD_DISMISS_BOOT_SPLASH === "function") {
      window.NBD_DISMISS_BOOT_SPLASH();
      return;
    }

    document.body.classList.remove("viceblood-booting");
    const splash = document.getElementById("viceblood-boot-splash");
    if (!splash) return;
    splash.classList.add("is-leaving");
    window.setTimeout(() => splash.remove(), 520);
  }

  installFullscreenShell() {
    if (!document.getElementById(MENU_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = MENU_STYLE_ID;
      style.textContent = `
        body.${MENU_BODY_CLASS} {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #020306 !important;
        }
        body.${MENU_BODY_CLASS} .shell {
          width: 100vw !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body.${MENU_BODY_CLASS} .topbar,
        body.${MENU_BODY_CLASS} .notes,
        body.${MENU_BODY_CLASS} #game-ui {
          display: none !important;
        }
        body.${MENU_BODY_CLASS} .game-frame,
        body.${MENU_BODY_CLASS} #game-root {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          min-height: 100vh !important;
          aspect-ratio: auto !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          background: #020306 !important;
        }
        body.${MENU_BODY_CLASS} #game-root canvas {
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: max(100vw, 150vh) !important;
          max-width: none !important;
          height: auto !important;
          image-rendering: auto !important;
        }
      `;
      document.head.appendChild(style);
    }
    document.body.classList.add(MENU_BODY_CLASS);
  }

  cleanupMenuShell() {
    this.scale.off("resize", this.layout, this);
    document.body.classList.remove(MENU_BODY_CLASS);
    const gameScene = this.scene.get("GameScene");
    if (gameScene?.input) gameScene.input.enabled = this.previewInputWasEnabled;
  }

  startWorldPreview() {
    if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
    this.scene.bringToTop("MainMenuScene");

    this.time.delayedCall(50, () => {
      const gameScene = this.scene.get("GameScene");
      if (!gameScene) return;
      if (gameScene.input) {
        this.previewInputWasEnabled = gameScene.input.enabled;
        gameScene.input.enabled = false;
      }
      this.scene.bringToTop("MainMenuScene");
    });
  }

  drawOverlay() {
    const width = this.scale.width;
    const height = this.scale.height;
    const fadeWidth = Math.round(width * 0.57);

    this.overlay.clear();
    this.overlay.fillStyle(UI.black, 0.22).fillRect(0, 0, width, height);

    const strips = 48;
    for (let i = 0; i < strips; i += 1) {
      const t = i / (strips - 1);
      const alpha = 0.94 * Math.pow(1 - t, 1.45);
      const x = (fadeWidth / strips) * i;
      this.overlay.fillStyle(UI.black, alpha)
        .fillRect(x, 0, Math.ceil(fadeWidth / strips) + 2, height);
    }

    this.overlay.fillStyle(0x000000, 0.28).fillRect(0, 0, width, Math.round(height * 0.06));
    this.overlay.fillStyle(0x000000, 0.32)
      .fillRect(0, Math.round(height * 0.94), width, Math.round(height * 0.06));

    this.overlay.fillStyle(0x5b0b10, 0.42)
      .fillRect(Math.round(width * 0.045), Math.round(height * 0.34), 2, Math.round(height * 0.43));
  }

  createMenuRows() {
    this.menuRows = MENU_ITEMS.map((item, index) => {
      const marker = this.add.text(0, 0, "›", {
        fontFamily: "Arial Narrow, Arial, sans-serif",
        fontSize: "30px",
        fontStyle: "900",
        color: UI.redBright
      }).setOrigin(0, 0.5);

      const label = this.add.text(0, 0, item.label, {
        fontFamily: "Arial Narrow, Arial, sans-serif",
        fontSize: "27px",
        fontStyle: "900",
        color: item.enabled ? UI.white : UI.muted,
        letterSpacing: 5
      }).setOrigin(0, 0.5);

      label.setInteractive({ useHandCursor: item.enabled });
      label.on("pointerover", () => {
        if (!item.enabled || this.panelMode || this.transitioning) return;
        this.selectedIndex = index;
        this.refreshSelection();
      });
      label.on("pointerdown", () => {
        if (!item.enabled || this.panelMode || this.transitioning) return;
        this.selectedIndex = index;
        this.activateSelection();
      });

      marker.setVisible(false);
      this.menuGroup.add([marker, label]);
      return { ...item, marker, label };
    });
  }

  createFooter() {
    this.footer = this.add.text(0, 0, "THE CITY NEVER SLEEPS.", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "700",
      color: "#777179",
      letterSpacing: 3
    }).setOrigin(0, 1).setDepth(1010).setScrollFactor(0);

    this.version = this.add.text(0, 0, "VICEBLOOD · PRE-ALPHA", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "10px",
      fontStyle: "700",
      color: "#555158",
      letterSpacing: 2
    }).setOrigin(0, 1).setDepth(1010).setScrollFactor(0);
  }

  createPanel() {
    this.panelBackdrop = this.add.rectangle(0, 0, 10, 10, UI.panel, 0.92).setOrigin(0, 0);
    this.panelRule = this.add.rectangle(0, 0, 4, 10, 0xb91f26, 1).setOrigin(0, 0);
    this.panelTitle = this.add.text(0, 0, "", {
      fontFamily: "Arial Narrow, Arial, sans-serif",
      fontSize: "27px",
      fontStyle: "900",
      color: UI.white,
      letterSpacing: 4
    });
    this.panelBody = this.add.text(0, 0, "", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "15px",
      fontStyle: "600",
      color: "#b8b3b2",
      lineSpacing: 9,
      wordWrap: { width: 380 }
    });
    this.panelSection = this.add.text(0, 0, "RENDER QUALITY", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "800",
      color: "#827c83",
      letterSpacing: 2
    }).setVisible(false);
    this.panelHint = this.add.text(0, 0, "ESC  BACK", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "800",
      color: UI.redBright,
      letterSpacing: 2
    });

    this.panelGroup.add([
      this.panelBackdrop,
      this.panelRule,
      this.panelTitle,
      this.panelBody,
      this.panelSection,
      this.panelHint
    ]);

    this.qualityRows = QUALITY_OPTIONS.map((option, index) => {
      const marker = this.add.text(0, 0, "›", {
        fontFamily: "Arial Narrow, Arial, sans-serif",
        fontSize: "19px",
        fontStyle: "900",
        color: UI.redBright
      }).setOrigin(0, 0.5).setVisible(false);
      const label = this.add.text(0, 0, option.label, {
        fontFamily: "Arial Narrow, Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "900",
        color: UI.white,
        letterSpacing: 2
      }).setOrigin(0, 0.5).setVisible(false);
      const detail = this.add.text(0, 0, option.detail, {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "13px",
        fontStyle: "700",
        color: "#7f7980"
      }).setOrigin(1, 0.5).setVisible(false);

      label.setInteractive({ useHandCursor: true });
      label.on("pointerover", () => {
        if (this.panelMode !== "options" || this.transitioning) return;
        this.optionIndex = index;
        this.refreshOptionSelection();
      });
      label.on("pointerdown", () => {
        if (this.panelMode !== "options" || this.transitioning) return;
        this.optionIndex = index;
        this.applySelectedQuality();
      });

      this.panelGroup.add([marker, label, detail]);
      return { ...option, marker, label, detail };
    });
  }

  bindInput() {
    this.input.keyboard.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard.on("keydown-W", () => this.moveSelection(-1));
    this.input.keyboard.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard.on("keydown-S", () => this.moveSelection(1));
    this.input.keyboard.on("keydown-ENTER", () => {
      if (this.transitioning) return;
      if (this.panelMode === "options") this.applySelectedQuality();
      else if (this.panelMode) this.closePanel();
      else this.activateSelection();
    });
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.transitioning) return;
      if (this.panelMode === "options") this.applySelectedQuality();
      else if (!this.panelMode) this.activateSelection();
    });
    this.input.keyboard.on("keydown-ESC", () => {
      if (!this.transitioning && this.panelMode) this.closePanel();
    });
  }

  moveSelection(direction) {
    if (this.transitioning) return;
    if (this.panelMode === "options") {
      this.optionIndex = (this.optionIndex + direction + QUALITY_OPTIONS.length) % QUALITY_OPTIONS.length;
      this.refreshOptionSelection();
      return;
    }
    if (this.panelMode) return;

    let next = this.selectedIndex;
    do {
      next = (next + direction + MENU_ITEMS.length) % MENU_ITEMS.length;
    } while (!MENU_ITEMS[next].enabled && next !== this.selectedIndex);
    this.selectedIndex = next;
    this.refreshSelection();
  }

  refreshSelection() {
    let selectedRow = null;
    this.menuRows.forEach((row, index) => {
      const selected = index === this.selectedIndex && row.enabled;
      row.marker.setVisible(selected);
      row.label.setColor(selected ? UI.white : (row.enabled ? "#c5c0bc" : UI.muted));
      row.label.setAlpha(row.enabled ? (selected ? 1 : 0.72) : 0.25);
      this.tweens.killTweensOf(row.label);
      if (selected) selectedRow = row;
    });

    if (selectedRow) {
      this.selectionBack.setVisible(true);
      this.selectionRule.setVisible(true);
      this.selectionBack.setPosition(selectedRow.label.x - 18, selectedRow.label.y);
      this.selectionRule.setPosition(selectedRow.label.x - 18, selectedRow.label.y);
    }
  }

  currentResolutionKey() {
    if (window.NBD_RESOLUTION_PRESET?.key) return window.NBD_RESOLUTION_PRESET.key;
    try {
      const saved = window.localStorage.getItem(RESOLUTION_STORAGE_KEY);
      if (QUALITY_OPTIONS.some(option => option.key === saved)) return saved;
    } catch {}
    return "qhd";
  }

  refreshOptionSelection() {
    const activeKey = this.currentResolutionKey();
    this.qualityRows.forEach((row, index) => {
      const selected = index === this.optionIndex;
      const active = row.key === activeKey;
      row.marker.setVisible(this.panelMode === "options" && selected);
      row.label.setVisible(this.panelMode === "options");
      row.detail.setVisible(this.panelMode === "options");
      row.label.setColor(selected ? UI.white : "#aaa4aa");
      row.detail.setColor(active ? UI.redBright : "#716b72");
      row.label.setAlpha(selected ? 1 : 0.74);
    });
  }

  activateSelection() {
    const item = MENU_ITEMS[this.selectedIndex];
    if (!item?.enabled || this.transitioning) return;
    if (item.id === "new-night") return this.beginNight();
    if (item.id === "options") return this.openOptions();
    if (item.id === "credits") return this.openCredits();
  }

  openOptions() {
    this.panelMode = "options";
    const currentKey = this.currentResolutionKey();
    this.optionIndex = Math.max(0, QUALITY_OPTIONS.findIndex(option => option.key === currentKey));
    this.panelTitle.setText("OPTIONS");
    this.panelBody.setText("Choose the internal render quality. Applying a change reloads the game.");
    this.panelSection.setVisible(true);
    this.panelHint.setText("ENTER  APPLY     ESC  BACK");
    this.panelGroup.setVisible(true);
    this.menuGroup.setAlpha(0.12);
    this.selectionBack.setAlpha(0.04);
    this.selectionRule.setAlpha(0.2);
    this.refreshOptionSelection();
  }

  openCredits() {
    this.panelMode = "credits";
    this.panelTitle.setText("CREDITS");
    this.panelBody.setText("VICEBLOOD\n\nCreated by Fran Pérez Sevilla.\n\nDesign, code and direction by Frainzzel.\nBuilt with Phaser.");
    this.panelSection.setVisible(false);
    this.panelHint.setText("ESC / ENTER  BACK");
    this.qualityRows.forEach(row => {
      row.marker.setVisible(false);
      row.label.setVisible(false);
      row.detail.setVisible(false);
    });
    this.panelGroup.setVisible(true);
    this.menuGroup.setAlpha(0.12);
    this.selectionBack.setAlpha(0.04);
    this.selectionRule.setAlpha(0.2);
  }

  closePanel() {
    this.panelMode = null;
    this.panelGroup.setVisible(false);
    this.menuGroup.setAlpha(1);
    this.selectionBack.setAlpha(0.12);
    this.selectionRule.setAlpha(1);
    this.refreshSelection();
  }

  applySelectedQuality() {
    const option = QUALITY_OPTIONS[this.optionIndex];
    if (!option) return;
    try { window.localStorage.setItem(RESOLUTION_STORAGE_KEY, option.key); } catch {}
    window.location.reload();
  }

  beginNight() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.input.keyboard.enabled = false;
    this.menuRows.forEach(row => row.label.disableInteractive());
    this.qualityRows.forEach(row => row.label.disableInteractive());

    const previewScene = this.scene.get("GameScene");
    const previewCamera = previewScene?.cameras?.main;
    if (previewScene?.tweens && previewCamera) {
      const startZoom = Number(previewCamera.zoom) || 1;
      const targetZoom = Math.min(startZoom + 0.16, startZoom * 1.11);
      previewScene.tweens.add({
        targets: previewCamera,
        zoom: targetZoom,
        duration: 1050,
        ease: "Sine.easeInOut"
      });
    }

    // Remove navigation chrome immediately, but deliberately keep the logo.
    this.tweens.add({
      targets: [
        this.menuGroup,
        this.selectionBack,
        this.selectionRule,
        this.kicker,
        this.footer,
        this.version
      ],
      alpha: 0,
      duration: 260,
      ease: "Sine.easeOut"
    });
    this.tweens.add({
      targets: this.overlay,
      alpha: 0.42,
      duration: 520,
      ease: "Sine.easeOut"
    });

    // Let the city zoom underneath the wordmark first.
    this.time.delayedCall(390, () => {
      this.tweens.add({
        targets: this.transitionCurtain,
        alpha: 0.78,
        duration: 430,
        ease: "Sine.easeIn"
      });
    });

    // Logo survives most of the zoom and only leaves during its final beat.
    this.time.delayedCall(560, () => {
      this.tweens.add({
        targets: this.logo,
        alpha: 0,
        duration: 500,
        ease: "Sine.easeIn"
      });
    });

    this.time.delayedCall(900, () => {
      this.tweens.add({
        targets: this.transitionCurtain,
        alpha: 1,
        duration: 180,
        ease: "Quad.easeIn",
        onComplete: () => this.finishNightTransition()
      });
    });
  }

  finishNightTransition() {
    if (this.scene.isActive("UIScene")) this.scene.stop("UIScene");
    if (this.scene.isActive("GameScene")) this.scene.stop("GameScene");

    this.scene.launch("GameScene");
    this.scene.launch("UIScene");

    // Restart the authoritative game under black so the menu-preview zoom never
    // creates a visible state/layout jump. The fresh game then fades into control.
    this.time.delayedCall(90, () => {
      const freshGame = this.scene.get("GameScene");
      freshGame?.cameras?.main?.fadeIn(420, 0, 0, 0);
      this.scene.stop("MainMenuScene");
    });
  }

  layout() {
    const width = this.scale.width;
    const height = this.scale.height;
    const left = Math.max(48, Math.round(width * 0.062));
    const panelWidth = Math.round(width * 0.47);

    this.drawOverlay();
    this.transitionCurtain.setPosition(0, 0).setSize(width, height);

    const logoWidth = Math.min(Math.round(width * 0.37), 620);
    this.logo.setDisplaySize(logoWidth, logoWidth / 3);
    this.logo.setPosition(left, Math.round(height * 0.085));
    this.kicker.setPosition(left + 4, Math.round(height * 0.285));

    const menuTop = Math.round(height * 0.45);
    const rowGap = Math.max(50, Math.round(height * 0.078));
    const selectionWidth = Math.min(330, Math.round(width * 0.27));
    const selectionHeight = Math.max(42, Math.round(height * 0.052));

    this.menuRows.forEach((row, index) => {
      const y = menuTop + rowGap * index;
      row.marker.setPosition(left - 25, y);
      row.label.setPosition(left + 10, y);
    });
    this.selectionBack.setSize(selectionWidth, selectionHeight);
    this.selectionRule.setSize(4, selectionHeight);

    this.footer.setPosition(left + 4, height - 46);
    this.version.setPosition(left + 4, height - 26);

    const boxWidth = Math.min(470, Math.round(width * 0.36));
    const boxHeight = Math.min(390, Math.round(height * 0.58));
    const boxX = Math.max(left, Math.round(panelWidth * 0.12));
    const boxY = Math.round(height * 0.33);
    this.panelBackdrop.setPosition(boxX, boxY).setSize(boxWidth, boxHeight);
    this.panelRule.setPosition(boxX, boxY).setSize(4, boxHeight);
    this.panelTitle.setPosition(boxX + 30, boxY + 26);
    this.panelBody.setPosition(boxX + 30, boxY + 78).setWordWrapWidth(boxWidth - 60);
    this.panelSection.setPosition(boxX + 30, boxY + 145);
    this.panelHint.setPosition(boxX + 30, boxY + boxHeight - 38);

    const optionsTop = boxY + 184;
    const optionGap = 40;
    this.qualityRows.forEach((row, index) => {
      const y = optionsTop + optionGap * index;
      row.marker.setPosition(boxX + 30, y);
      row.label.setPosition(boxX + 54, y);
      row.detail.setPosition(boxX + boxWidth - 30, y);
    });

    this.refreshSelection();
    if (this.panelMode === "options") this.refreshOptionSelection();
  }
}
