const MENU_ITEMS = Object.freeze([
  { id: "continue", label: "CONTINUE", enabled: false },
  { id: "new-night", label: "NEW NIGHT", enabled: true },
  { id: "options", label: "OPTIONS", enabled: true },
  { id: "credits", label: "CREDITS", enabled: true }
]);

const UI = Object.freeze({
  white: "#e8e5de",
  muted: "#817d79",
  red: "#b91f26",
  redBright: "#ff454d",
  black: 0x030407,
  panel: 0x07080c
});

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.selectedIndex = 1;
    this.menuRows = [];
    this.panelMode = null;
    this.worldPreviewStarted = false;
  }

  preload() {
    this.load.svg("viceblood-logo", "assets/ui/viceblood-logo.svg");
  }

  create() {
    this.startWorldPreview();
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    this.overlay = this.add.graphics().setDepth(1000).setScrollFactor(0);
    this.drawOverlay();

    this.logo = this.add.image(0, 0, "viceblood-logo")
      .setOrigin(0, 0)
      .setDepth(1010)
      .setScrollFactor(0);

    this.menuGroup = this.add.container(0, 0).setDepth(1010).setScrollFactor(0);
    this.panelGroup = this.add.container(0, 0).setDepth(1020).setScrollFactor(0).setVisible(false);

    this.createMenuRows();
    this.createFooter();
    this.createPanel();
    this.layout();
    this.refreshSelection();
    this.bindInput();

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });

    this.cameras.main.fadeIn(450, 3, 4, 7);
  }

  startWorldPreview() {
    if (this.scene.isActive("GameScene") || this.scene.isPaused("GameScene")) return;
    this.scene.launch("GameScene");
    this.scene.pause("GameScene");
    this.scene.bringToTop("MainMenuScene");
    this.worldPreviewStarted = true;
  }

  drawOverlay() {
    const width = this.scale.width;
    const height = this.scale.height;
    const panelWidth = Math.round(width * 0.43);

    this.overlay.clear();
    this.overlay.fillStyle(UI.black, 0.76).fillRect(0, 0, width, height);

    const strips = 32;
    for (let i = 0; i < strips; i += 1) {
      const t = i / (strips - 1);
      const alpha = 0.98 * (1 - t);
      const x = (panelWidth / strips) * i;
      this.overlay.fillStyle(UI.black, alpha)
        .fillRect(x, 0, Math.ceil(panelWidth / strips) + 2, height);
    }

    this.overlay.fillStyle(UI.black, 0.18).fillRect(panelWidth, 0, width - panelWidth, height);
    this.overlay.fillStyle(0x000000, 0.38).fillRect(0, 0, width, Math.round(height * 0.045));
    this.overlay.fillStyle(0x000000, 0.38).fillRect(0, Math.round(height * 0.955), width, Math.round(height * 0.045));
  }

  createMenuRows() {
    this.menuRows = MENU_ITEMS.map((item, index) => {
      const marker = this.add.text(0, 0, "›", {
        fontFamily: "Arial Narrow, Arial, sans-serif",
        fontSize: "28px",
        fontStyle: "900",
        color: UI.redBright
      }).setOrigin(0, 0.5);

      const label = this.add.text(0, 0, item.label, {
        fontFamily: "Arial Narrow, Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "900",
        color: item.enabled ? UI.white : UI.muted,
        letterSpacing: 5
      }).setOrigin(0, 0.5);

      label.setInteractive({ useHandCursor: item.enabled });
      label.on("pointerover", () => {
        if (!item.enabled || this.panelMode) return;
        this.selectedIndex = index;
        this.refreshSelection();
      });
      label.on("pointerdown", () => {
        if (!item.enabled || this.panelMode) return;
        this.selectedIndex = index;
        this.activateSelection();
      });

      marker.setVisible(false);
      this.menuGroup.add([marker, label]);
      return { ...item, marker, label };
    });
  }

  createFooter() {
    this.footer = this.add.text(0, 0, "CITY NEVER SLEEPS", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "700",
      color: "#68656a",
      letterSpacing: 3
    }).setOrigin(0, 1).setDepth(1010).setScrollFactor(0);

    this.version = this.add.text(0, 0, "VICEBLOOD · MAIN MENU V1", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "10px",
      fontStyle: "700",
      color: "#555158",
      letterSpacing: 2
    }).setOrigin(0, 1).setDepth(1010).setScrollFactor(0);
  }

  createPanel() {
    this.panelBackdrop = this.add.rectangle(0, 0, 10, 10, UI.panel, 0.96).setOrigin(0, 0);
    this.panelRule = this.add.rectangle(0, 0, 4, 10, 0xb91f26, 1).setOrigin(0, 0);
    this.panelTitle = this.add.text(0, 0, "", {
      fontFamily: "Arial Narrow, Arial, sans-serif",
      fontSize: "25px",
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
      wordWrap: { width: 360 }
    });
    this.panelHint = this.add.text(0, 0, "ESC / ENTER  BACK", {
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
      this.panelHint
    ]);
  }

  bindInput() {
    this.input.keyboard.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard.on("keydown-W", () => this.moveSelection(-1));
    this.input.keyboard.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard.on("keydown-S", () => this.moveSelection(1));
    this.input.keyboard.on("keydown-ENTER", () => {
      if (this.panelMode) this.closePanel();
      else this.activateSelection();
    });
    this.input.keyboard.on("keydown-SPACE", () => {
      if (!this.panelMode) this.activateSelection();
    });
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.panelMode) this.closePanel();
    });
  }

  moveSelection(direction) {
    if (this.panelMode) return;
    let next = this.selectedIndex;
    do {
      next = (next + direction + MENU_ITEMS.length) % MENU_ITEMS.length;
    } while (!MENU_ITEMS[next].enabled && next !== this.selectedIndex);
    this.selectedIndex = next;
    this.refreshSelection();
  }

  refreshSelection() {
    this.menuRows.forEach((row, index) => {
      const selected = index === this.selectedIndex && row.enabled;
      row.marker.setVisible(selected);
      row.label.setColor(selected ? UI.redBright : (row.enabled ? UI.white : UI.muted));
      row.label.setAlpha(row.enabled ? (selected ? 1 : 0.78) : 0.34);
      row.label.setX(selected ? 16 : 0);
      if (selected) {
        this.tweens.killTweensOf(row.label);
        this.tweens.add({ targets: row.label, alpha: 0.78, duration: 700, yoyo: true, repeat: -1 });
      } else {
        this.tweens.killTweensOf(row.label);
      }
    });
  }

  activateSelection() {
    const item = MENU_ITEMS[this.selectedIndex];
    if (!item?.enabled) return;
    if (item.id === "new-night") return this.beginNight();
    if (item.id === "options") return this.openPanel(
      "OPTIONS",
      "Display resolution is currently controlled by the selector below the game.\n\nAudio, accessibility and gameplay options will move into this panel as those systems are consolidated."
    );
    if (item.id === "credits") return this.openPanel(
      "CREDITS",
      "VICEBLOOD\n\nCreated by Fran Pérez Sevilla.\n\nAn urban vampire sandbox built with Phaser."
    );
  }

  openPanel(title, body) {
    this.panelMode = title.toLowerCase();
    this.panelTitle.setText(title);
    this.panelBody.setText(body);
    this.panelGroup.setVisible(true);
    this.menuGroup.setAlpha(0.18);
  }

  closePanel() {
    this.panelMode = null;
    this.panelGroup.setVisible(false);
    this.menuGroup.setAlpha(1);
  }

  beginNight() {
    this.input.keyboard.enabled = false;
    this.menuRows.forEach(row => row.label.disableInteractive());
    this.cameras.main.fadeOut(420, 0, 0, 0);
    this.time.delayedCall(430, () => {
      if (this.scene.isPaused("GameScene")) this.scene.resume("GameScene");
      else if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
      if (!this.scene.isActive("UIScene")) this.scene.launch("UIScene");
      this.scene.stop("MainMenuScene");
    });
  }

  layout() {
    const width = this.scale.width;
    const height = this.scale.height;
    const left = Math.max(44, Math.round(width * 0.055));
    const panelWidth = Math.round(width * 0.43);

    this.drawOverlay();

    const logoWidth = Math.min(Math.round(width * 0.32), 560);
    this.logo.setDisplaySize(logoWidth, logoWidth / 3);
    this.logo.setPosition(left, Math.round(height * 0.12));

    const menuTop = Math.round(height * 0.49);
    const rowGap = Math.max(44, Math.round(height * 0.073));
    this.menuRows.forEach((row, index) => {
      const y = menuTop + rowGap * index;
      row.marker.setPosition(left - 30, y);
      row.label.setPosition(left + (index === this.selectedIndex ? 16 : 0), y);
    });

    this.footer.setPosition(left, height - 48);
    this.version.setPosition(left, height - 28);

    const boxWidth = Math.min(430, Math.round(width * 0.33));
    const boxHeight = Math.min(300, Math.round(height * 0.48));
    const boxX = Math.min(panelWidth - boxWidth - 24, left);
    const boxY = Math.round(height * 0.34);
    this.panelBackdrop.setPosition(boxX, boxY).setSize(boxWidth, boxHeight);
    this.panelRule.setPosition(boxX, boxY).setSize(4, boxHeight);
    this.panelTitle.setPosition(boxX + 28, boxY + 26);
    this.panelBody.setPosition(boxX + 28, boxY + 82).setWordWrapWidth(boxWidth - 56);
    this.panelHint.setPosition(boxX + 28, boxY + boxHeight - 35);
  }
}
