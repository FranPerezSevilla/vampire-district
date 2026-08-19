const DEFAULT_DIRECTION = Object.freeze({ x: 0, y: -1 });

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

function normalizedDirection(direction = DEFAULT_DIRECTION) {
  const x = Number(direction?.x) || 0;
  const y = Number(direction?.y) || 0;
  const length = Math.hypot(x, y);
  if (length < 0.001) return { ...DEFAULT_DIRECTION };
  return { x: x / length, y: y / length };
}

export function modularCharacterFacingRotation(direction = DEFAULT_DIRECTION) {
  const value = normalizedDirection(direction);
  // Sprites are authored facing north (negative Y), hence the +90 degree offset.
  let rotation = Math.atan2(value.y, value.x) + Math.PI / 2;
  while (rotation > Math.PI) rotation -= Math.PI * 2;
  while (rotation <= -Math.PI) rotation += Math.PI * 2;
  return rotation;
}

export function modularCharacterPose({
  timeMs = 0,
  moving = false,
  aiming = false,
  phase = 0
} = {}) {
  const time = Math.max(0, Number(timeMs) || 0);
  const walk = moving ? Math.sin(time * 0.014 + phase) : 0;
  const footStride = walk * 2.45;
  const handSwing = walk * 1.45;

  const feet = {
    left: { x: -3.7, y: 8.4 + footStride, rotation: -0.04 * walk },
    right: { x: 3.7, y: 8.4 - footStride, rotation: 0.04 * walk }
  };

  if (aiming) {
    return {
      hands: {
        left: { x: -2.2, y: -5.8, rotation: -0.08 },
        right: { x: 2.15, y: -7.0, rotation: 0.06 }
      },
      feet,
      weaponVisible: true
    };
  }

  return {
    hands: {
      left: { x: -8.6, y: 1.2 - handSwing, rotation: -0.08 - walk * 0.05 },
      right: { x: 8.6, y: 1.2 + handSwing, rotation: 0.08 + walk * 0.05 }
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
  const trouser = addStroke(scene.add.rectangle(0, -1.2, 4.1, 4.2, style.trouser, 1), style.outline);
  const shoe = addStroke(scene.add.ellipse(0, 2.0, 4.5, 5.2, style.shoe, 1), style.outline);
  container.add([trouser, shoe]);
  return container;
}

function createCore(scene, style) {
  const core = scene.add.container(0, 0);
  const shadow = scene.add.ellipse(0, 5.8, style.shoulderWidth + 4, 7.5, 0x000000, 0.27);
  const torso = addStroke(scene.add.ellipse(0, 1.2, style.shoulderWidth, 9.0, style.body, 1), style.outline);
  const chest = scene.add.rectangle(0, 2.5, Math.max(5, style.shoulderWidth - 7), 4.0, style.bodyDark, 0.72);

  const parts = [shadow, torso, chest];

  if (style.collar) {
    const leftCollar = addStroke(scene.add.rectangle(-5.0, -1.1, 4.2, 7.4, style.accent, 1), style.outline)
      .setRotation(-0.34);
    const rightCollar = addStroke(scene.add.rectangle(5.0, -1.1, 4.2, 7.4, style.accent, 1), style.outline)
      .setRotation(0.34);
    parts.push(leftCollar, rightCollar);
  }

  const head = addStroke(scene.add.ellipse(0, -3.3, 9.4, 10.6, style.skin, 1), style.outline);
  parts.push(head);

  if (style.cap) {
    const cap = addStroke(scene.add.ellipse(0, -5.2, 11.3, 8.8, style.body, 1), style.outline);
    const brim = addStroke(scene.add.rectangle(0, -1.7, 9.7, 2.1, style.bodyDark, 1), style.outline);
    const capBadge = scene.add.rectangle(0, -2.2, 2.6, 1.5, style.accent, 1);
    parts.push(cap, brim, capBadge);
  } else {
    const hair = addStroke(scene.add.ellipse(0, -5.4, 9.6, 7.0, style.hair, 1), style.outline, 0.72);
    parts.push(hair);
  }

  if (style.badge) {
    const badge = addStroke(scene.add.rectangle(4.8, 2.2, 2.8, 3.2, style.accent, 1), style.outline, 0.64);
    parts.push(badge);
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
    this.lastDirection = { ...DEFAULT_DIRECTION };

    this.root = scene.add.container(0, 0).setScale(this.style.scale || 0.78);
    this.leftFoot = createFoot(scene, this.style);
    this.rightFoot = createFoot(scene, this.style);
    this.core = createCore(scene, this.style);
    this.leftHand = createHand(scene, this.style);
    this.rightHand = createHand(scene, this.style);

    this.root.add([
      this.leftFoot,
      this.rightFoot,
      this.core,
      this.leftHand.container,
      this.rightHand.container
    ]);
    hostContainer.add(this.root);
    this.update({ timeMs: 0, direction: DEFAULT_DIRECTION, moving: false, aiming: false });
  }

  update({
    timeMs = 0,
    direction = this.lastDirection,
    moving = false,
    aiming = false
  } = {}) {
    const normalized = normalizedDirection(direction);
    this.lastDirection = normalized;
    this.root.setRotation(modularCharacterFacingRotation(normalized));

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
    return pose;
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
