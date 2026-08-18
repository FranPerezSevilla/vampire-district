const MENU_ITEMS = [
  { key: "continue", label: "CONTINUE", enabled: false },
  { key: "new-night", label: "NEW NIGHT", enabled: true },
  { key: "options", label: "OPTIONS", enabled: true },
  { key: "credits", label: "CREDITS", enabled: true }
];

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.selectedIndex = 1;
    this.menuTexts = [];
    this.cars = [];
    this.pedestrians = [];
    this.overlay = null;
    this.overlayText = null;
  }

  preload() {
    this.load.svg("viceblood-logo", "assets/ui/viceblood-logo.svg");
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#05060b");

    this.createLivingBackdrop(width, height);
    this.createMenuPanel(width, height);
    this.bindInput();
    this.refreshSelection();

    this.scale.on("resize", () => this.scene.restart());
  }

  createLivingBackdrop(width, height) {
    const g = this.add.graphics();
    const split = Math.floor(width * 0.37);

    g.fillStyle(0x080a0f, 1);
    g.fillRect(0, 0, width, height);

    // Urban block: road + pavements + rooftops. Deliberately procedural for V1 so
    // the menu shares the same renderer without introducing another art pipeline.
    g.fillStyle(0x12151b, 1);
    g.fillRect(split, 0, width - split, height);

    const roadX = split + Math.floor((width - split) * 0.14);
    const roadW = Math.floor((width - split) * 0.25);
    g.fillStyle(0x191c22, 1);
    g.fillRect(roadX, 0, roadW, height);
    g.fillStyle(0x2b2826, 1);
    g.fillRect(roadX - 28, 0, 28, height);
    g.fillRect(roadX + roadW, 0, 28, height);

    g.lineStyle(4, 0x8f846f, 0.2);
    for (let y = 40; y < height; y += 90) {
      g.lineBetween(roadX + roadW / 2, y, roadX + roadW / 2, y + 42);
    }

    const roofX = roadX + roadW + 62;
    const roofY = Math.floor(height * 0.22);
    const roofW = width - roofX - 42;
    const roofH = Math.floor(height * 0.62);
    g.fillStyle(0x11141a, 1);
    g.fillRect(roofX, roofY, roofW, roofH);
    g.lineStyle(14, 0x292d34, 1);
    g.strokeRect(roofX, roofY, roofW, roofH);

    // Rooftop details.
    g.fillStyle(0x20242b, 1);
    g.fillRect(roofX + roofW * 0.67, roofY + roofH * 0.16, 90, 90);
    g.lineStyle(4, 0x3d424a, 0.8);
    g.strokeCircle(roofX + roofW * 0.67 + 45, roofY + roofH * 0.16 + 45, 32);
    g.fillStyle(0x251518, 1);
    g.fillRect(roofX + roofW * 0.52, roofY + roofH * 0.65, 72, 118);

    // Street pools of light.
    for (const y of [height * 0.18, height * 0.52, height * 0.82]) {
      const lamp = this.add.circle(roadX - 12, y, 75, 0xd7aa64, 0.07);
      this.tweens.add({ targets: lamp, alpha: { from: 0.05, to: 0.1 }, duration: 1600, yoyo: true, repeat: -1 });
      this.add.circle(roadX - 12, y, 7, 0xe9bd72, 0.7);
    }

    // The vampire is intentionally small: city first, predator second.
    const vampireX = roofX + roofW * 0.34;
    const vampireY = roofY + roofH * 0.33;
    this.add.circle(vampireX, vampireY, 20, 0x0b0c10, 1).setStrokeStyle(3, 0x272b31, 1);
    this.add.circle(vampireX - 22, vampireY + 11, 5, 0xd9c5b3, 0.85);
    this.add.circle(vampireX + 22, vampireY + 11, 5, 0xd9c5b3, 0.85);

    // Steam pulse.
    const steamX = roofX + roofW * 0.82;
    const steamY = roofY + roofH * 0.42;
    for (let i = 0; i < 4; i++) {
      const puff = this.add.circle(steamX, steamY - i * 24, 16 + i * 6, 0xb7c0c8, 0.04);
      this.tweens.add({
        targets: puff,
        y: puff.y - 70,
        alpha: 0,
        scale: 1.7,
        duration: 2600,
        delay: i * 500,
        repeat: -1
      });
    }

    // Repeating traffic.
    const laneLeft = roadX + roadW * 0.32;
    const laneRight = roadX + roadW * 0.68;
    this.spawnCar(laneLeft, height + 90, -1, 0x9b1820, height);
    this.spawnCar(laneRight, -90, 1, 0xc7b57a, height);
    this.spawnCar(laneLeft, height * 0.42, -1, 0x5b6874, height, 1900);

    // Tiny pedestrians on pavements.
    this.spawnPedestrian(roadX - 14, height * 0.14, 1, height);
    this.spawnPedestrian(roadX + roadW + 14, height * 0.7, -1, height, 1100);

    // Occasional distant police pulse.
    const police = this.add.rectangle(roadX + roadW * 0.72, height * 0.08, 48, 72, 0x11151b, 1);
    const red = this.add.circle(police.x - 10, police.y - 26, 18, 0xc31826, 0.05);
    const blue = this.add.circle(police.x + 10, police.y - 26, 18, 0x2b5dcb, 0.05);
    this.tweens.add({ targets: red, alpha: 0.45, duration: 260, yoyo: true, repeat: -1, repeatDelay: 520 });
    this.tweens.add({ targets: blue, alpha: 0.45, duration: 260, delay: 260, yoyo: true, repeat: -1, repeatDelay: 520 });

    // Left-side noir veil.
    const veil = this.add.graphics();
    veil.fillGradientStyle(0x020305, 0x020305, 0x020305, 0x020305, 0.98, 0.96, 0.35, 0);
    veil.fillRect(0, 0, Math.floor(width * 0.54), height);

    this.add.text(width - 34, height - 34, "THE CITY DOESN'T SLEEP. IT HUNTS.", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: `${Math.max(12, Math.round(height * 0.018))}px`,
      color: "#777a80",
      fontStyle: "700"
    }).setOrigin(1, 1).setAlpha(0.55);
  }

  spawnCar(x, startY, direction, color, height, delay = 0) {
    const car = this.add.rectangle(x, startY, 42, 78, color, 1).setStrokeStyle(3, 0x090a0c, 1);
    const head = this.add.rectangle(x, startY + direction * 28, 30, 7, direction > 0 ? 0xf0d898 : 0x8e141d, 0.8);
    this.cars.push({ car, head });
    const distance = height + 220;
    this.tweens.add({
      targets: [car, head],
      y: `+=${direction * distance}`,
      duration: 9800 + Phaser.Math.Between(-1200, 1200),
      delay,
      repeat: -1,
      onRepeat: () => {
        const resetY = direction > 0 ? -110 : height + 110;
        car.y = resetY;
        head.y = resetY + direction * 28;
      }
    });
  }

  spawnPedestrian(x, startY, direction, height, delay = 0) {
    const person = this.add.circle(x, startY, 9, 0x8a7e71, 0.9);
    this.pedestrians.push(person);
    const distance = height + 80;
    this.tweens.add({
      targets: person,
      y: `+=${direction * distance}`,
      duration: 16000,
      delay,
      repeat: -1,
      onRepeat: () => { person.y = direction > 0 ? -40 : height + 40; }
    });
  }

  createMenuPanel(width, height) {
    const left = Math.floor(width * 0.07);
    const logo = this.add.image(left, Math.floor(height * 0.16), "viceblood-logo").setOrigin(0, 0.5);
    const targetLogoWidth = Math.floor(width * 0.28);
    logo.setScale(targetLogoWidth / logo.width);

    const menuY = Math.floor(height * 0.42);
    const gap = Math.floor(height * 0.085);
    const fontSize = Math.max(22, Math.floor(height * 0.035));

    this.menuTexts = MENU_ITEMS.map((item, index) => {
      const text = this.add.text(left + 18, menuY + index * gap, item.label, {
        fontFamily: "Arial Narrow, Arial, Helvetica, sans-serif",
        fontSize: `${fontSize}px`,
        color: item.enabled ? "#b7b5b1" : "#54565b",
        fontStyle: "700"
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: item.enabled });

      if (item.enabled) {
        text.on("pointerover", () => {
          this.selectedIndex = index;
          this.refreshSelection();
        });
        text.on("pointerdown", () => this.activateSelected());
      }
      return text;
    });

    this.selector = this.add.text(left - 18, menuY, "›", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: `${Math.round(fontSize * 1.25)}px`,
      color: "#d84a4a",
      fontStyle: "700"
    }).setOrigin(0, 0.5);

    this.add.text(left + 18, height - Math.floor(height * 0.09), "v0.x · MAIN MENU CONCEPT V1", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: `${Math.max(12, Math.round(height * 0.018))}px`,
      color: "#676970",
      fontStyle: "700"
    }).setOrigin(0, 1);
  }

  bindInput() {
    this.input.keyboard.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard.on("keydown-W", () => this.moveSelection(-1));
    this.input.keyboard.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard.on("keydown-S", () => this.moveSelection(1));
    this.input.keyboard.on("keydown-ENTER", () => this.activateSelected());
    this.input.keyboard.on("keydown-SPACE", () => this.activateSelected());
    this.input.keyboard.on("keydown-ESC", () => this.closeOverlay());
  }

  moveSelection(direction) {
    let next = this.selectedIndex;
    for (let i = 0; i < MENU_ITEMS.length; i++) {
      next = Phaser.Math.Wrap(next + direction, 0, MENU_ITEMS.length);
      if (MENU_ITEMS[next].enabled) break;
    }
    this.selectedIndex = next;
    this.refreshSelection();
  }

  refreshSelection() {
    const selected = this.menuTexts[this.selectedIndex];
    if (!selected) return;
    this.selector.setY(selected.y);

    this.menuTexts.forEach((text, index) => {
      const item = MENU_ITEMS[index];
      if (!item.enabled) {
        text.setColor("#54565b").setAlpha(0.7).setX(text.x);
      } else if (index === this.selectedIndex) {
        text.setColor("#f2e7df").setAlpha(1).setX(text.x + 10);
      } else {
        text.setColor("#aaa8a4").setAlpha(0.82).setX(text.x > this.scale.width * 0.07 + 30 ? text.x - 10 : text.x);
      }
    });
  }

  activateSelected() {
    if (this.overlay) {
      this.closeOverlay();
      return;
    }

    const item = MENU_ITEMS[this.selectedIndex];
    if (!item?.enabled) return;

    if (item.key === "new-night") {
      this.startNight();
      return;
    }

    if (item.key === "options") {
      this.openOverlay("OPTIONS", "Resolution and display settings remain available in the existing shell.\n\nThis V1 keeps menu presentation separate from gameplay systems.");
      return;
    }

    if (item.key === "credits") {
      this.openOverlay("CREDITS", "VICEBLOOD\n\nCreated by Fran Perez Sevilla\n\nMain menu concept: living city, minimal UI, urban vampire noir.");
    }
  }

  openOverlay(title, body) {
    const { width, height } = this.scale;
    const panelW = Math.floor(width * 0.42);
    const panelH = Math.floor(height * 0.34);
    const x = width * 0.5;
    const y = height * 0.5;

    const bg = this.add.rectangle(x, y, panelW, panelH, 0x06080d, 0.97).setStrokeStyle(3, 0x78141b, 0.9);
    const heading = this.add.text(x, y - panelH * 0.29, title, {
      fontFamily: "Arial Narrow, Arial, sans-serif",
      fontSize: `${Math.max(22, Math.floor(height * 0.034))}px`,
      color: "#eee6df",
      fontStyle: "700"
    }).setOrigin(0.5);
    const copy = this.add.text(x, y, body, {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: `${Math.max(14, Math.floor(height * 0.022))}px`,
      color: "#a8a8aa",
      align: "center",
      wordWrap: { width: panelW * 0.8 }
    }).setOrigin(0.5);
    const hint = this.add.text(x, y + panelH * 0.32, "ENTER / ESC TO CLOSE", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: `${Math.max(12, Math.floor(height * 0.017))}px`,
      color: "#7b7d82",
      fontStyle: "700"
    }).setOrigin(0.5);

    this.overlay = this.add.container(0, 0, [bg, heading, copy, hint]);
  }

  closeOverlay() {
    if (!this.overlay) return;
    this.overlay.destroy(true);
    this.overlay = null;
  }

  startNight() {
    this.input.enabled = false;
    this.cameras.main.fadeOut(650, 4, 5, 9);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("GameScene");
      this.scene.launch("UIScene");
    });
  }
}
