import { buildControlReference } from "../ui/ControlReference.js";

const MENU_ITEMS = Object.freeze([
  { id: "continue", label: "CONTINUE", enabled: false },
  { id: "new-night", label: "NEW NIGHT", enabled: true },
  { id: "options", label: "OPTIONS", enabled: true },
  { id: "controls", label: "CONTROLS", enabled: true },
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
const WORLD_BODY_CLASS = "viceblood-world-active";
const MENU_STYLE_ID = "viceblood-main-menu-shell";

const UI = Object.freeze({
  white: "#f1ede6",
  muted: "#89848a",
  red: 0xa8141c,
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
    this.transitioning = false;
    this.handoffComplete = false;
    this.previewLocked = false;
    this.previewInputWasEnabled = true;
    this.previewWorldInputWasEnabled = true;
    this.previewInputSystem = null;
    this.previewPointerWorldPoint = null;
    this.previewCombatGraphicsWasVisible = true;
    this.layoutRaf = 0;
    this.onViewportResize = () => this.scheduleLayout();
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
      .setOrigin(0, 0.5).setDepth(1007).setScrollFactor(0);
    this.selectionRule = this.add.rectangle(0, 0, 4, 10, 0xff303a, 1)
      .setOrigin(0, 0.5).setDepth(1008).setScrollFactor(0);
    this.logo = this.add.image(0, 0, "viceblood-logo")
      .setOrigin(0, 0).setDepth(1010).setScrollFactor(0);
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
    this.bindInput();

    this.scale.on("resize", this.onViewportResize);
    window.addEventListener("resize", this.onViewportResize);
    window.visualViewport?.addEventListener?.("resize", this.onViewportResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupMenuShell());

    this.layout();
    this.scheduleLayout();
    this.refreshSelection();
    this.time.delayedCall(140, () => this.revealMenuFromSplash());
  }

  installFullscreenShell() {
    if (!document.getElementById(MENU_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = MENU_STYLE_ID;
      style.textContent = `
        body.${MENU_BODY_CLASS}, body.${WORLD_BODY_CLASS} {
          margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #020306 !important;
        }
        body.${MENU_BODY_CLASS} .shell, body.${WORLD_BODY_CLASS} .shell {
          width: 100vw !important; max-width: none !important; margin: 0 !important; padding: 0 !important;
        }
        body.${MENU_BODY_CLASS} .topbar, body.${WORLD_BODY_CLASS} .topbar,
        body.${MENU_BODY_CLASS} .notes, body.${WORLD_BODY_CLASS} .notes { display: none !important; }
        body.${MENU_BODY_CLASS} #game-ui { display: none !important; }
        body.${MENU_BODY_CLASS} .game-frame, body.${WORLD_BODY_CLASS} .game-frame,
        body.${MENU_BODY_CLASS} #game-root, body.${WORLD_BODY_CLASS} #game-root {
          position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
          max-width: none !important; min-height: 100vh !important; aspect-ratio: auto !important;
          margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
          overflow: hidden !important; background: #020306 !important;
        }
        body.${MENU_BODY_CLASS} #game-root canvas, body.${WORLD_BODY_CLASS} #game-root canvas {
          position: absolute !important; left: 50% !important; top: 50% !important;
          transform: translate(-50%, -50%) !important; width: max(100vw, 150vh) !important;
          max-width: none !important; height: auto !important; image-rendering: auto !important;
        }
      `;
      document.head.appendChild(style);
    }
    document.body.classList.remove(WORLD_BODY_CLASS);
    document.body.classList.add(MENU_BODY_CLASS);
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

  scheduleLayout() {
    if (this.layoutRaf) cancelAnimationFrame(this.layoutRaf);
    this.layoutRaf = requestAnimationFrame(() => {
      this.layoutRaf = 0;
      this.layout();
      requestAnimationFrame(() => this.layout());
    });
  }

  cleanupMenuShell() {
    this.scale.off("resize", this.onViewportResize);
    window.removeEventListener("resize", this.onViewportResize);
    window.visualViewport?.removeEventListener?.("resize", this.onViewportResize);
    if (this.layoutRaf) cancelAnimationFrame(this.layoutRaf);

    document.body.classList.remove(MENU_BODY_CLASS);
    if (this.handoffComplete) return;
    document.body.classList.remove(WORLD_BODY_CLASS);
    this.restorePreviewControl();
  }

  startWorldPreview() {
    if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
    this.scene.bringToTop("MainMenuScene");
    this.time.delayedCall(0, () => this.lockPreviewControl());
    this.time.delayedCall(50, () => this.lockPreviewControl());
  }

  lockPreviewControl() {
    if (this.previewLocked) return true;
    const gameScene = this.scene.get("GameScene");
    const inputSystem = gameScene?.inputSystem;
    if (!gameScene || !inputSystem) return false;

    this.previewLocked = true;
    if (gameScene.input) {
      this.previewInputWasEnabled = gameScene.input.enabled;
      gameScene.input.enabled = false;
    }
    this.previewInputSystem = inputSystem;
    this.previewWorldInputWasEnabled = inputSystem.worldEnabled;
    this.previewPointerWorldPoint = inputSystem.pointerWorldPoint;
    inputSystem.setWorldEnabled?.(false);
    inputSystem.reset?.();
    inputSystem.pointerWorldPoint = () => inputSystem.playerFallbackPoint();

    const combatGraphics = gameScene.combatSystem?.graphics;
    if (combatGraphics) {
      this.previewCombatGraphicsWasVisible = combatGraphics.visible;
      combatGraphics.setVisible(false);
    }
    this.scene.bringToTop("MainMenuScene");
    return true;
  }

  restorePreviewControl() {
    const gameScene = this.scene.get("GameScene");
    if (gameScene?.input) gameScene.input.enabled = this.previewInputWasEnabled;
    if (this.previewInputSystem) {
      if (this.previewPointerWorldPoint) this.previewInputSystem.pointerWorldPoint = this.previewPointerWorldPoint;
      this.previewInputSystem.setWorldEnabled?.(this.previewWorldInputWasEnabled);
      this.previewInputSystem.resetWorldEdges?.();
    }
    gameScene?.combatSystem?.graphics?.setVisible?.(this.previewCombatGraphicsWasVisible);
    this.previewLocked = false;
  }

  visibleViewportBounds() {
    const gameWidth = Math.max(1, Number(this.scale.width) || 1);
    const gameHeight = Math.max(1, Number(this.scale.height) || 1);
    const canvas = this.game?.canvas;
    const rect = canvas?.getBoundingClientRect?.();
    const viewportWidth = Math.max(1, document.documentElement?.clientWidth || window.innerWidth || gameWidth);
    const viewportHeight = Math.max(1, document.documentElement?.clientHeight || window.innerHeight || gameHeight);

    if (rect && rect.width > 0 && rect.height > 0) {
      const scaleX = rect.width / gameWidth;
      const scaleY = rect.height / gameHeight;
      const left = Math.max(0, -rect.left);
      const top = Math.max(0, -rect.top);
      const right = Math.min(rect.width, viewportWidth - rect.left);
      const bottom = Math.min(rect.height, viewportHeight - rect.top);
      if (right > left && bottom > top && scaleX > 0 && scaleY > 0) {
        return {
          x: left / scaleX,
          y: top / scaleY,
          width: (right - left) / scaleX,
          height: (bottom - top) / scaleY,
          scaleX,
          scaleY
        };
      }
    }

    const cssScale = Math.max(viewportWidth / gameWidth, viewportHeight / gameHeight);
    const visibleWidth = Math.min(gameWidth, viewportWidth / cssScale);
    const visibleHeight = Math.min(gameHeight, viewportHeight / cssScale);
    return {
      x: (gameWidth - visibleWidth) / 2,
      y: (gameHeight - visibleHeight) / 2,
      width: visibleWidth,
      height: visibleHeight,
      scaleX: cssScale,
      scaleY: cssScale
    };
  }

  cssX(view, px) { return px / Math.max(0.001, view.scaleX || 1); }
  cssY(view, px) { return px / Math.max(0.001, view.scaleY || 1); }
  fontFor(view, px) { return Math.max(12, Math.round(this.cssY(view, px))); }

  drawOverlay(view = this.visibleViewportBounds()) {
    const width = this.scale.width;
    const height = this.scale.height;
    const fadeWidth = Math.round(view.width * 0.53);
    this.overlay.clear();
    this.overlay.fillStyle(UI.black, 0.14).fillRect(0, 0, width, height);
    const strips = 48;
    for (let i = 0; i < strips; i += 1) {
      const t = i / (strips - 1);
      const alpha = 0.92 * Math.pow(1 - t, 1.5);
      const x = view.x + (fadeWidth / strips) * i;
      this.overlay.fillStyle(UI.black, alpha).fillRect(x, 0, Math.ceil(fadeWidth / strips) + 2, height);
    }
  }

  createMenuRows() {
    this.menuRows = MENU_ITEMS.map((item, index) => {
      const marker = this.add.text(0, 0, "›", {
        fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: "30px", fontStyle: "900", color: UI.redBright
      }).setOrigin(0, 0.5);
      const label = this.add.text(0, 0, item.label, {
        fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: "27px", fontStyle: "900",
        color: item.enabled ? UI.white : UI.muted, letterSpacing: 5
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
      fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", fontStyle: "700",
      color: "#777179", letterSpacing: 3
    }).setOrigin(0, 1).setDepth(1010).setScrollFactor(0);
    this.version = this.add.text(0, 0, "VICEBLOOD · PRE-ALPHA", {
      fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10px", fontStyle: "700",
      color: "#555158", letterSpacing: 2
    }).setOrigin(0, 1).setDepth(1010).setScrollFactor(0);
  }

  createPanel() {
    this.panelBackdrop = this.add.rectangle(0, 0, 10, 10, UI.panel, 0.97).setOrigin(0, 0);
    this.panelRule = this.add.rectangle(0, 0, 4, 10, 0xb91f26, 1).setOrigin(0, 0);
    this.panelTitle = this.add.text(0, 0, "", {
      fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: "30px", fontStyle: "900",
      color: UI.white, letterSpacing: 4
    });
    this.panelBody = this.add.text(0, 0, "", {
      fontFamily: "Arial, Helvetica, sans-serif", fontSize: "15px", fontStyle: "600",
      color: "#b8b3b2", lineSpacing: 9, wordWrap: { width: 380 }
    });
    this.panelSection = this.add.text(0, 0, "RENDER QUALITY", {
      fontFamily: "Arial, Helvetica, sans-serif", fontSize: "11px", fontStyle: "800",
      color: "#827c83", letterSpacing: 2
    }).setVisible(false);
    this.panelHint = this.add.text(0, 0, "ESC  BACK", {
      fontFamily: "Arial, Helvetica, sans-serif", fontSize: "11px", fontStyle: "800",
      color: UI.redBright, letterSpacing: 2
    });
    this.panelGroup.add([this.panelBackdrop, this.panelRule, this.panelTitle, this.panelBody, this.panelSection, this.panelHint]);

    this.qualityRows = QUALITY_OPTIONS.map((option, index) => {
      const marker = this.add.text(0, 0, "›", {
        fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: "19px", fontStyle: "900", color: UI.redBright
      }).setOrigin(0, 0.5).setVisible(false);
      const label = this.add.text(0, 0, option.label, {
        fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: "18px", fontStyle: "900",
        color: UI.white, letterSpacing: 2
      }).setOrigin(0, 0.5).setVisible(false);
      const detail = this.add.text(0, 0, option.detail, {
        fontFamily: "Arial, Helvetica, sans-serif", fontSize: "13px", fontStyle: "700", color: "#7f7980"
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
    do next = (next + direction + MENU_ITEMS.length) % MENU_ITEMS.length;
    while (!MENU_ITEMS[next].enabled && next !== this.selectedIndex);
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
      if (selected) selectedRow = row;
    });
    if (selectedRow) {
      this.selectionBack.setVisible(true).setPosition(selectedRow.label.x - 18, selectedRow.label.y);
      this.selectionRule.setVisible(true).setPosition(selectedRow.label.x - 18, selectedRow.label.y);
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
      row.label.setVisible(this.panelMode === "options").setColor(selected ? UI.white : "#aaa4aa").setAlpha(selected ? 1 : 0.74);
      row.detail.setVisible(this.panelMode === "options").setColor(active ? UI.redBright : "#716b72");
    });
  }

  activateSelection() {
    const item = MENU_ITEMS[this.selectedIndex];
    if (!item?.enabled || this.transitioning) return;
    if (item.id === "new-night") return this.beginNight();
    if (item.id === "options") return this.openOptions();
    if (item.id === "controls") return this.openControls();
    if (item.id === "credits") return this.openCredits();
  }

  dimMainMenuForPanel() {
    this.menuGroup.setAlpha(0.08);
    this.selectionBack.setAlpha(0.02);
    this.selectionRule.setAlpha(0.08);
    this.logo.setAlpha(0.12);
    this.kicker.setAlpha(0.1);
    this.footer.setAlpha(0.08);
    this.version.setAlpha(0.08);
  }

  hideQualityRows() {
    this.qualityRows.forEach(row => {
      row.marker.setVisible(false);
      row.label.setVisible(false);
      row.detail.setVisible(false);
    });
  }

  openOptions() {
    this.panelMode = "options";
    const currentKey = this.currentResolutionKey();
    this.optionIndex = Math.max(0, QUALITY_OPTIONS.findIndex(option => option.key === currentKey));
    this.panelTitle.setText("OPTIONS");
    this.panelBody.setText("Choose the internal render quality. Applying a change reloads the game.");
    this.panelBody.setLineSpacing?.(9);
    this.panelSection.setVisible(true);
    this.panelHint.setText("ENTER  APPLY     ESC  BACK");
    this.panelGroup.setVisible(true);
    this.dimMainMenuForPanel();
    this.refreshOptionSelection();
  }

  openControls() {
    this.panelMode = "controls";
    const bindings = this.scene.get("GameScene")?.inputSystem?.bindings || {};
    this.panelTitle.setText("CONTROLS");
    this.panelBody.setText(buildControlReference(bindings));
    this.panelBody.setLineSpacing?.(4);
    this.panelSection.setVisible(false);
    this.panelHint.setText("ESC / ENTER  BACK");
    this.hideQualityRows();
    this.panelGroup.setVisible(true);
    this.dimMainMenuForPanel();
    this.layout();
  }

  openCredits() {
    this.panelMode = "credits";
    this.panelTitle.setText("CREDITS");
    this.panelBody.setText("VICEBLOOD\n\nCreated by Fran Pérez Sevilla.\n\nDesign, code and direction by Frainzzel.\nBuilt with Phaser.");
    this.panelBody.setLineSpacing?.(9);
    this.panelSection.setVisible(false);
    this.panelHint.setText("ESC / ENTER  BACK");
    this.hideQualityRows();
    this.panelGroup.setVisible(true);
    this.dimMainMenuForPanel();
  }

  closePanel() {
    this.panelMode = null;
    this.panelGroup.setVisible(false);
    this.menuGroup.setAlpha(1);
    this.selectionBack.setAlpha(0.12);
    this.selectionRule.setAlpha(1);
    this.logo.setAlpha(1);
    this.kicker.setAlpha(1);
    this.footer.setAlpha(1);
    this.version.setAlpha(1);
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

    const view = this.visibleViewportBounds();
    const slide = this.cssX(view, 34);
    this.tweens.add({
      targets: [this.menuGroup, this.selectionBack, this.selectionRule, this.logo, this.kicker, this.footer, this.version],
      x: `-=${slide}`,
      alpha: 0,
      duration: 360,
      ease: "Cubic.easeIn"
    });
    this.tweens.add({ targets: this.overlay, alpha: 0, duration: 430, ease: "Sine.easeOut" });
    this.time.delayedCall(430, () => this.finishNightTransition());
  }

  finishNightTransition() {
    if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
    if (!this.scene.isActive("UIScene")) this.scene.launch("UIScene");

    // Hand control to the exact live scene that has been running behind the title.
    // There is deliberately no blackout, camera fade, GameScene stop or GameScene restart.
    this.restorePreviewControl();
    const gameScene = this.scene.get("GameScene");
    gameScene?.registry?.set?.("mainMenuActive", false);
    document.body.classList.remove(MENU_BODY_CLASS);
    document.body.classList.add(WORLD_BODY_CLASS);
    this.handoffComplete = true;
    this.scene.stop("MainMenuScene");
  }

  layout() {
    if (!this.logo || !this.panelBackdrop) return;
    const height = this.scale.height;
    const view = this.visibleViewportBounds();
    const safeLeft = Math.max(this.cssX(view, 34), view.width * 0.025);
    const safeTop = Math.max(this.cssY(view, 34), view.height * 0.025);
    const left = view.x + safeLeft;
    const top = view.y + safeTop;

    this.drawOverlay(view);

    const visibleCssWidth = view.width * view.scaleX;
    const logoCssWidth = Math.min(430, visibleCssWidth * 0.34);
    const logoWidth = this.cssX(view, logoCssWidth);
    const logoHeight = logoWidth / 3;
    this.logo.setDisplaySize(logoWidth, logoHeight).setPosition(left, top);
    this.kicker.setFontSize(this.fontFor(view, 10)).setPosition(left + this.cssX(view, 4), top + logoHeight + this.cssY(view, 10));

    const menuTop = view.y + view.height * 0.35;
    const rowGap = this.cssY(view, 66);
    const selectionWidth = this.cssX(view, Math.min(340, visibleCssWidth * 0.28));
    const selectionHeight = this.cssY(view, 44);
    this.menuRows.forEach((row, index) => {
      const y = menuTop + rowGap * index;
      row.marker.setFontSize(this.fontFor(view, 27)).setPosition(left - this.cssX(view, 25), y);
      row.label.setFontSize(this.fontFor(view, 22)).setPosition(left + this.cssX(view, 10), y);
    });
    this.selectionBack.setSize(selectionWidth, selectionHeight);
    this.selectionRule.setSize(this.cssX(view, 4), selectionHeight);

    this.footer.setFontSize(this.fontFor(view, 10)).setPosition(left + this.cssX(view, 4), view.y + view.height - this.cssY(view, 48));
    this.version.setFontSize(this.fontFor(view, 9)).setPosition(left + this.cssX(view, 4), view.y + view.height - this.cssY(view, 28));

    // The drawer backdrop intentionally bleeds across the entire internal canvas height.
    // Content is positioned inside the real visible crop, but the panel can never stop short of the browser bottom.
    const drawerCssWidth = Math.min(620, visibleCssWidth * 0.43);
    const drawerRight = view.x + this.cssX(view, drawerCssWidth);
    const innerX = view.x + this.cssX(view, 56);
    const panelTop = view.y + this.cssY(view, 54);
    this.panelBackdrop.setPosition(0, 0).setSize(drawerRight, height);
    this.panelRule.setPosition(drawerRight - this.cssX(view, 4), 0).setSize(this.cssX(view, 4), height);
    this.panelTitle.setFontSize(this.fontFor(view, 26)).setPosition(innerX, panelTop);
    this.panelBody.setFontSize(this.fontFor(view, this.panelMode === "controls" ? 12 : 14)).setPosition(innerX, panelTop + this.cssY(view, 66))
      .setWordWrapWidth(drawerRight - innerX - this.cssX(view, 42));
    this.panelSection.setFontSize(this.fontFor(view, 10)).setPosition(innerX, panelTop + this.cssY(view, 154));
    this.panelHint.setFontSize(this.fontFor(view, 10)).setPosition(innerX, view.y + view.height - this.cssY(view, 40));

    const optionsTop = panelTop + this.cssY(view, 198);
    const optionGap = this.cssY(view, 47);
    this.qualityRows.forEach((row, index) => {
      const y = optionsTop + optionGap * index;
      row.marker.setFontSize(this.fontFor(view, 18)).setPosition(innerX, y);
      row.label.setFontSize(this.fontFor(view, 17)).setPosition(innerX + this.cssX(view, 28), y);
      row.detail.setFontSize(this.fontFor(view, 12)).setPosition(drawerRight - this.cssX(view, 42), y);
    });

    this.refreshSelection();
    if (this.panelMode === "options") this.refreshOptionSelection();
  }
}
