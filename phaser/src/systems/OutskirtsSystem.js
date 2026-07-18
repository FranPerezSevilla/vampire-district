import { WORLD } from "../data/balance.js";
import { LAYERS } from "../data/district.js";

const OUTER_MARGIN_X = 620;
const OUTER_MARGIN_Y = 440;
const OUTER_BOUNDS = Object.freeze({
  x: -OUTER_MARGIN_X,
  y: -OUTER_MARGIN_Y,
  width: WORLD.width + OUTER_MARGIN_X * 2,
  height: WORLD.height + OUTER_MARGIN_Y * 2
});
const BORDER_TRIGGER = 13;
const WARNING_COOLDOWN_MS = 10_000;
const BUILDING_COLORS = [0x151827, 0x191522, 0x171a24, 0x1d1724, 0x161b22, 0x211725];
const BUILDING_TRIMS = [0x4a526d, 0x5a4567, 0x465b62, 0x614958, 0x4b4f65];

function seededValue(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function rectOutsideDistrict(x, y, width, height) {
  return x + width <= -8 || x >= WORLD.width + 8 || y + height <= -8 || y >= WORLD.height + 8;
}

function drawOuterBuilding(graphics, x, y, width, height, seed) {
  if (!rectOutsideDistrict(x, y, width, height)) return;
  const color = BUILDING_COLORS[seed % BUILDING_COLORS.length];
  const trim = BUILDING_TRIMS[(seed * 3) % BUILDING_TRIMS.length];
  graphics.fillStyle(0x030409, 0.54).fillRect(x + 7, y + 9, width, height);
  graphics.fillStyle(color, 1).fillRect(x, y, width, height);
  graphics.lineStyle(2, trim, 0.72).strokeRect(x, y, width, height);
  graphics.fillStyle(0x0b0d16, 0.86).fillRect(x + 10, y + 10, Math.max(12, width * 0.22), Math.max(10, height * 0.16));
  graphics.fillStyle(0x252838, 0.75).fillRect(x + width - 24, y + 14, 13, 18);

  const litChance = seededValue(seed + 7);
  for (let wx = x + 14; wx < x + width - 12; wx += 24) {
    for (let wy = y + 36; wy < y + height - 10; wy += 22) {
      const lit = seededValue(seed + wx * 0.07 + wy * 0.11) > 0.78 - litChance * 0.08;
      graphics.fillStyle(lit ? 0xe2bd6a : 0x33384c, lit ? 0.35 : 0.52).fillRect(wx, wy, 7, 4);
    }
  }
}

function drawRoad(graphics, x, y, width, height, horizontal = true) {
  graphics.fillStyle(0x202434, 1).fillRect(x, y, width, height);
  graphics.lineStyle(2, 0x11131d, 0.9).strokeRect(x, y, width, height);
  graphics.fillStyle(0x353a4e, 0.66);
  if (horizontal) {
    const cy = y + height / 2;
    for (let px = x + 12; px < x + width - 12; px += 34) graphics.fillRect(px, cy - 1, 17, 2);
  } else {
    const cx = x + width / 2;
    for (let py = y + 12; py < y + height - 12; py += 34) graphics.fillRect(cx - 1, py, 2, 17);
  }
}

export class OutskirtsSystem {
  constructor(scene) {
    this.scene = scene;
    this.warningActive = false;
    this.warningUntil = 0;
    this.graphics = this.drawOutskirts();
    this.updatePresentation();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.outskirtsSystem = this;
    scene.outskirtsGraphics = this.graphics;
  }

  updatePresentation() {
    if (!this.graphics) return;
    const alpha = this.scene.currentLayer === LAYERS.STREET
      ? 1
      : this.scene.currentLayer === LAYERS.SEWER
        ? 0.16
        : 0.52;
    this.graphics.setAlpha(alpha);

    if (this.scene.registry?.get?.("taskRevealActive") || this.scene.tutorialDirector?.busy) return;
    this.scene.cameras?.main?.setBounds(
      OUTER_BOUNDS.x,
      OUTER_BOUNDS.y,
      OUTER_BOUNDS.width,
      OUTER_BOUNDS.height
    );
  }

  isTryingToLeave(frame = this.scene.currentInputFrame) {
    if (this.scene.currentLayer !== LAYERS.STREET) return false;
    const move = frame?.move || { x: 0, y: 0 };
    return (this.scene.player.x <= BORDER_TRIGGER && move.x < 0)
      || (this.scene.player.x >= WORLD.width - BORDER_TRIGGER && move.x > 0)
      || (this.scene.player.y <= BORDER_TRIGGER && move.y < 0)
      || (this.scene.player.y >= WORLD.height - BORDER_TRIGGER && move.y > 0);
  }

  async warnBoundary() {
    const director = this.scene.tutorialDirector;
    if (!director?.showDialogue) return false;
    if (this.warningActive || this.warningUntil > this.scene.time.now) return false;
    if (director.busy || director.state !== "complete") return false;
    if (this.scene.missionSystem?.failed || this.scene.missionSystem?.completed) return false;

    this.warningActive = true;
    director.busy = true;
    director.state = "boundary-warning";
    director.setControlMode?.("locked");
    director.freezeWorld?.(true);

    try {
      await director.showDialogue({
        speaker: "YOUR SIRE · IN YOUR MIND",
        text: "You will not leave this district without my permission. Return to your task.",
        kind: "thought"
      });
    } finally {
      director.freezeWorld?.(false);
      director.state = "complete";
      director.busy = false;
      director.setControlMode?.("full");
      this.scene.inputSystem?.reset?.();
      this.warningUntil = this.scene.time.now + WARNING_COOLDOWN_MS;
      this.warningActive = false;
    }
    return true;
  }

  drawOutskirts() {
    const graphics = this.scene.add.graphics().setDepth(-18);
    graphics.fillStyle(0x080a12, 1).fillRect(
      OUTER_BOUNDS.x,
      OUTER_BOUNDS.y,
      OUTER_BOUNDS.width,
      OUTER_BOUNDS.height
    );

    drawRoad(graphics, OUTER_BOUNDS.x, 292, OUTER_BOUNDS.width, 92, true);
    drawRoad(graphics, 426, OUTER_BOUNDS.y, 92, OUTER_BOUNDS.height, false);
    drawRoad(graphics, OUTER_BOUNDS.x, -150, OUTER_BOUNDS.width, 58, true);
    drawRoad(graphics, OUTER_BOUNDS.x, 716, OUTER_BOUNDS.width, 58, true);
    drawRoad(graphics, -188, OUTER_BOUNDS.y, 58, OUTER_BOUNDS.height, false);
    drawRoad(graphics, 1088, OUTER_BOUNDS.y, 58, OUTER_BOUNDS.height, false);

    let seed = 1;
    const northRows = [-408, -270, -82];
    const southRows = [654, 794, 934];
    const rowXs = [-590, -438, -286, -122, 40, 206, 546, 710, 872, 1036, 1198, 1360, 1512];
    for (const y of [...northRows, ...southRows]) {
      for (const x of rowXs) {
        const width = 112 + Math.round(seededValue(seed) * 28);
        const height = 88 + Math.round(seededValue(seed + 2) * 30);
        drawOuterBuilding(graphics, x, y, width, height, seed++);
      }
    }

    const sideXs = [-594, -438, -282, -122, 980, 1148, 1312, 1470];
    for (const x of sideXs) {
      for (let y = 12; y <= 574; y += 126) {
        const width = 108 + Math.round(seededValue(seed) * 30);
        const height = 92 + Math.round(seededValue(seed + 3) * 24);
        drawOuterBuilding(graphics, x, y, width, height, seed++);
      }
    }

    graphics.fillStyle(0xffdc74, 0.17);
    for (let x = OUTER_BOUNDS.x + 54; x < OUTER_BOUNDS.x + OUTER_BOUNDS.width; x += 96) {
      if (x > -20 && x < WORLD.width + 20) continue;
      graphics.fillCircle(x, 278, 22).fillCircle(x, 398, 22);
      graphics.fillStyle(0xffe16b, 0.68).fillRect(x - 2, 272, 4, 13).fillRect(x - 2, 392, 4, 13);
      graphics.fillStyle(0xffdc74, 0.17);
    }

    graphics.fillStyle(0x4b5268, 0.88);
    for (let x = OUTER_BOUNDS.x + 70; x < OUTER_BOUNDS.x + OUTER_BOUNDS.width - 70; x += 154) {
      if (x > -40 && x < WORLD.width + 40) continue;
      graphics.fillRect(x, 324, 24, 10);
      graphics.fillStyle(0x1a1d29, 1).fillRect(x + 3, 326, 18, 5);
      graphics.fillStyle(0x4b5268, 0.88);
    }

    graphics.lineStyle(2, 0x8f79aa, 0.28).strokeRect(0, 0, WORLD.width, WORLD.height);
    graphics.lineStyle(3, 0xa75cff, 0.34);
    const exits = [
      { x: 472, y: 4, dx: 0, dy: -13 },
      { x: 472, y: WORLD.height - 4, dx: 0, dy: 13 },
      { x: 4, y: 338, dx: -13, dy: 0 },
      { x: WORLD.width - 4, y: 338, dx: 13, dy: 0 }
    ];
    for (const exit of exits) {
      graphics.beginPath();
      graphics.moveTo(exit.x - exit.dy * 0.55, exit.y + exit.dx * 0.55);
      graphics.lineTo(exit.x + exit.dx, exit.y + exit.dy);
      graphics.lineTo(exit.x + exit.dy * 0.55, exit.y - exit.dx * 0.55);
      graphics.strokePath();
    }
    return graphics;
  }

  destroy() {
    this.graphics?.destroy?.();
    this.scene.outskirtsGraphics = null;
  }
}

export { OUTER_BOUNDS };
