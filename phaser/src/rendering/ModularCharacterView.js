const DEFAULT_DIRECTION = Object.freeze({ x: 0, y: -1 });
const EIGHT_WAY_STEP = Math.PI / 4;
const EIGHT_WAY_HALF_STEP = EIGHT_WAY_STEP / 2;

export const MODULAR_CHARACTER_DIRECTION_HYSTERESIS = Math.PI * 8 / 180;

export const MODULAR_CHARACTER_STYLES = Object.freeze({
  civilian: Object.freeze({
    body: 0x596049,
    bodyDark: 0x3f4537,
    outline: 0x25291f,
    skin: 0xd3aa82,
    hair: 0x4a3425,
    accent: 0x767d60,
    sleeve: 0x596049,
    trouser: 0x343b42,
    shoe: 0x2a241f,
    shoulderWidth: 15,
    scale: 0.78,
    cap: false,
    collar: false,
    badge: false,
    weapon: false
  }),
  police: Object.freeze({
    body: 0x263a58,
    bodyDark: 0x19283e,
    outline: 0x101927,
    skin: 0xd2a47e,
    hair: 0x202735,
    accent: 0xa9b9ce,
    sleeve: 0x233752,
    trouser: 0x19283e,
    shoe: 0x111821,
    shoulderWidth: 17,
    scale: 0.78,
    cap: true,
    collar: false,
    badge: true,
    weapon: true
  }),
  protagonist: Object.freeze({
    body: 0x1b1920,
    bodyDark: 0x111017,
    outline: 0x08070b,
    skin: 0xe2c5bf,
    hair: 0x17161c,
    accent: 0x7f2438,
    sleeve: 0x18161d,
    trouser: 0x15141a,
    shoe: 0x0d0c11,
    shoulderWidth: 18,
    scale: 0.8,
    cap: false,
    collar: true,
    badge: false,
    weapon: true
  })
});

function hasDirection(direction) {
  return Boolean(direction && Math.hypot(Number(direction.x) || 0, Number(direction.y) || 0) > 0.001);
}

function normalizedDirection(direction = DEFAULT_DIRECTION) {
  const x = Number(direction?.x) || 0;
  const y = Number(direction?.y) || 0;
  const length = Math.hypot(x, y);
  if (length < 0.001) return { ...DEFAULT_DIRECTION };
  return { x: x / length, y: y / length };
}

function wrapAngle(angle) {
  let value = Number(angle) || 0;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value <= -Math.PI) value += Math.PI * 2;
  return value;
}

function angleDelta(from, to) {
  return wrapAngle((Number(to) || 0) - (Number(from) || 0));
}

export function modularCharacterFacingRotation(direction = DEFAULT_DIRECTION) {
  const value = normalizedDirection(direction);
  // Character pieces are authored facing north (negative Y).
  return wrapAngle(Math.atan2(value.y, value.x) + Math.PI / 2);
}

export function modularCharacterSnappedRotation(
  direction = DEFAULT_DIRECTION,
  previousRotation = null,
  hysteresis = MODULAR_CHARACTER_DIRECTION_HYSTERESIS
) {
  const raw = modularCharacterFacingRotation(direction);
  const snapped = wrapAngle(Math.round(raw / EIGHT_WAY_STEP) * EIGHT_WAY_STEP);
  if (!Number.isFinite(previousRotation)) return snapped;

  const previous = wrapAngle(Math.round(previousRotation / EIGHT_WAY_STEP) * EIGHT_WAY_STEP);
  const threshold = EIGHT_WAY_HALF_STEP + Math.max(0, Number(hysteresis) || 0);
  return Math.abs(angleDelta(previous, raw)) <= threshold ? previous : snapped;
}

export function modularCharacterPose({
  timeMs = 0,
  moving = false,
  aiming = false,
  phase = 0
} = {}) {
  const time = Math.max(0, Number(timeMs) || 0);
  const walk = moving ? Math.sin(time * 0.014 + phase) : 0;
  const footStride = walk * 2.35;
  const handSwing = walk * 1.35;

  const feet = {
    left: { x: -3.6, y: 8.0 + footStride, rotation: -0.04 * walk },
    right: { x: 3.6, y: 8.0 - footStride, rotation: 0.04 * walk }
  };

  if (aiming) {
    return {
      hands: {
        left: { x: -2.35, y: -6.2, rotation: -0.08 },
        right: { x: 2.25, y: -7.2, rotation: 0.06 }
      },
      feet,
      weaponVisible: true
    };
  }

  return {
    hands: {
      left: { x: -8.5, y: 2.0 - handSwing, rotation: -0.08 - walk * 0.05 },
      right: { x: 8.5, y: 2.0 + handSwing, rotation: 0.08 + walk * 0.05 }
    },
    feet,
    weaponVisible: false
  };
}

function stablePhase(value) {
  let hash = 2166136261;
  for (const char of String(value || "character")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff * Math.PI * 2;
}

function addStroke(shape, color, alpha = 0.92) {
  shape?.setStrokeStyle?.(1, color, alpha);
  return shape;
}

function createHand(scene, style) {
  const container = scene.add.container(0, 0);
  const sleeve = addStroke(scene.add.rectangle(0, 0.7, 4.2, 6.2, style.sleeve, 1), style.outline);
  const hand = addStroke(scene.add.ellipse(0, -2.7, 3.4, 3.8, style.skin, 1), style.outline, 0.72);
  const weapon = addStroke(scene.add.rectangle(0, -6.0, 1.8, 6.6, 0x171b22, 1), 0x05070a)
    .setVisible(false);
  container.add([sleeve, hand, weapon]);
  return { container, weapon };
}

function createFoot(scene, style) {
  const container = scene.add.container(0, 0);
  const trouser = addStroke(scene.add.rectangle(0, -1.0, 4.0, 3.8, style.trouser, 1), style.outline);
  const shoe = addStroke(scene.add.ellipse(0, 1.8, 4.4, 4.8, style.shoe, 1), style.outline);
  container.add([trouser, shoe]);
  return container;
}

function createCore(scene, style) {
  const core = scene.add.container(0, 0);

  // The shoulders are deliberately shallow: this must read as a true overhead
  // silhouette at every rotation, not as a front-facing torso turned in 2D.
  const shoulders = addStroke(scene.add.ellipse(0, 2.5, style.shoulderWidth, 5.8, style.body, 1), style.outline);
  const shoulderShade = scene.add.ellipse(0, 3.0, Math.max(6, style.shoulderWidth - 5), 2.6, style.bodyDark, 0.58);
  const parts = [shoulders, shoulderShade];

  if (style.collar) {
    const leftCollar = addStroke(scene.add.rectangle(-5.0, 1.0, 3.8, 5.0, style.accent, 1), style.outline)
      .setRotation(-0.44);
    const rightCollar = addStroke(scene.add.rectangle(5.0, 1.0, 3.8, 5.0, style.accent, 1), style.outline)
      .setRotation(0.44);
    parts.push(leftCollar, rightCollar);
  }

  const head = addStroke(scene.add.ellipse(0, -0.8, 10.3, 10.3, style.skin, 1), style.outline);
  parts.push(head);

  if (style.cap) {
    const cap = addStroke(scene.add.ellipse(0, -0.1, 11.2, 9.4, style.body, 1), style.outline);
    const brim = addStroke(scene.add.rectangle(0, -4.9, 8.8, 2.1, style.bodyDark, 1), style.outline);
    const capBadge = scene.add.rectangle(0, -5.0, 2.4, 1.3, style.accent, 1);
    parts.push(cap, brim, capBadge);
  } else {
    // Hair is shifted toward the back of the head so a small skin crescent at
    // the front communicates facing without reintroducing frontal perspective.
    const hair = addStroke(scene.add.ellipse(0, 0.15, 9.8, 8.8, style.hair, 1), style.outline, 0.72);
    parts.push(hair);
  }

  if (style.badge) {
    const leftEpaulette = addStroke(scene.add.rectangle(-6.2, 2.0, 2.8, 2.8, style.accent, 1), style.outline, 0.64);
    const rightEpaulette = addStroke(scene.add.rectangle(6.2, 2.0, 2.8, 2.8, style.accent, 1), style.outline, 0.64);
    parts.push(leftEpaulette, rightEpaulette);
  }

  if (style.collar) {
    const clasp = scene.add.rectangle(0, 2.5, 2.0, 1.6, style.accent, 1);
    parts.push(clasp);
  }

  core.add(parts);
  return core;
}

export class ModularCharacterView {
  constructor(scene, hostContainer, styleName = "civilian", { phaseKey = "character" } = {}) {
    if (!scene || !hostContainer) throw new TypeError("ModularCharacterView requires a scene and host container.");
    this.scene = scene;
    this.host = hostContainer;
    this.styleName = MODULAR_CHARACTER_STYLES[styleName] ? styleName : "civilian";
    this.style = MODULAR_CHARACTER_STYLES[this.styleName];
    this.phase = stablePhase(phaseKey);
    this.lastMovementDirection = { ...DEFAULT_DIRECTION };
    this.lastAimDirection = { ...DEFAULT_DIRECTION };
    this.upperRotation = 0;
    this.feetRotation = 0;

    this.root = scene.add.container(0, 0).setScale(this.style.scale || 0.78);
    this.shadow = scene.add.ellipse(0, 5.0, this.style.shoulderWidth + 5, 5.6, 0x000000, 0.27);
    this.feetRoot = scene.add.container(0, 0);
    this.upperRoot = scene.add.container(0, 0);
    this.leftFoot = createFoot(scene, this.style);
    this.rightFoot = createFoot(scene, this.style);
    this.core = createCore(scene, this.style);
    this.leftHand = createHand(scene, this.style);
    this.rightHand = createHand(scene, this.style);

    this.feetRoot.add([this.leftFoot, this.rightFoot]);
    this.upperRoot.add([this.core, this.leftHand.container, this.rightHand.container]);
    this.root.add([this.shadow, this.feetRoot, this.upperRoot]);
    hostContainer.add(this.root);
    this.update({
      timeMs: 0,
      movementDirection: DEFAULT_DIRECTION,
      aimDirection: DEFAULT_DIRECTION,
      moving: false,
      aiming: false
    });
  }

  get lastDirection() {
    return this.lastMovementDirection;
  }

  update({
    timeMs = 0,
    direction = null,
    movementDirection = direction || this.lastMovementDirection,
    aimDirection = this.lastAimDirection,
    moving = false,
    aiming = false
  } = {}) {
    if (hasDirection(movementDirection)) {
      this.lastMovementDirection = normalizedDirection(movementDirection);
    }
    if (aiming && hasDirection(aimDirection)) {
      this.lastAimDirection = normalizedDirection(aimDirection);
    }

    const movementRotation = modularCharacterSnappedRotation(
      this.lastMovementDirection,
      this.feetRotation
    );
    if (moving || !aiming) this.feetRotation = movementRotation;

    const upperDirection = aiming ? this.lastAimDirection : this.lastMovementDirection;
    this.upperRotation = modularCharacterSnappedRotation(upperDirection, this.upperRotation);
    this.feetRoot.setRotation(this.feetRotation);
    this.upperRoot.setRotation(this.upperRotation);

    const pose = modularCharacterPose({
      timeMs,
      moving: Boolean(moving),
      aiming: Boolean(aiming),
      phase: this.phase
    });

    this.applyPartPose(this.leftHand.container, pose.hands.left);
    this.applyPartPose(this.rightHand.container, pose.hands.right);
    this.applyPartPose(this.leftFoot, pose.feet.left);
    this.applyPartPose(this.rightFoot, pose.feet.right);

    const showWeapon = Boolean(this.style.weapon && pose.weaponVisible);
    this.leftHand.weapon.setVisible(false);
    this.rightHand.weapon.setVisible(showWeapon);
    return {
      ...pose,
      upperRotation: this.upperRotation,
      feetRotation: this.feetRotation
    };
  }

  applyPartPose(part, pose) {
    part?.setPosition?.(pose.x, pose.y);
    part?.setRotation?.(pose.rotation || 0);
  }

  destroy() {
    this.root?.destroy?.(true);
    this.root = null;
  }
}
