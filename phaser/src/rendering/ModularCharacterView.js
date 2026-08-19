const DEFAULT_DIRECTION = Object.freeze({ x: 0, y: -1 });
const WEAPON_UNARMED = "unarmed";
const WEAPON_PIPE = "iron_pipe";
const WEAPON_PISTOL = "pistol";

const SKIN_TONES = Object.freeze([
  0xf0c7a0,
  0xd7a67d,
  0xbc865f,
  0x966344,
  0x6f4734
]);

const HAIR_TONES = Object.freeze([
  0x211d1b,
  0x3a2a22,
  0x5b3b27,
  0x78604c,
  0x2d2b31
]);

const CIVILIAN_PALETTES = Object.freeze([
  Object.freeze({ body: 0x596049, bodyDark: 0x3f4537, sleeve: 0x596049, trouser: 0x343b42, shoe: 0x2a241f, accent: 0x767d60 }),
  Object.freeze({ body: 0x68513f, bodyDark: 0x46362c, sleeve: 0x68513f, trouser: 0x30343b, shoe: 0x271f1b, accent: 0x90705a }),
  Object.freeze({ body: 0x435363, bodyDark: 0x2d3944, sleeve: 0x435363, trouser: 0x252c34, shoe: 0x191d22, accent: 0x70879a }),
  Object.freeze({ body: 0x5e4349, bodyDark: 0x412e33, sleeve: 0x5e4349, trouser: 0x333139, shoe: 0x211d21, accent: 0x815e65 }),
  Object.freeze({ body: 0x6a6559, bodyDark: 0x48443c, sleeve: 0x6a6559, trouser: 0x3b3d41, shoe: 0x262626, accent: 0x8e897b }),
  Object.freeze({ body: 0x3f5148, bodyDark: 0x29382f, sleeve: 0x3f5148, trouser: 0x2c3235, shoe: 0x1c211f, accent: 0x617b6e })
]);

const POLICE_PALETTES = Object.freeze([
  Object.freeze({ body: 0x263a58, bodyDark: 0x19283e, sleeve: 0x233752, trouser: 0x19283e, shoe: 0x111821, accent: 0xa9b9ce }),
  Object.freeze({ body: 0x2c405f, bodyDark: 0x1b2b43, sleeve: 0x293d5b, trouser: 0x1b2a40, shoe: 0x111820, accent: 0xb7c3d3 }),
  Object.freeze({ body: 0x22334c, bodyDark: 0x162337, sleeve: 0x203149, trouser: 0x172438, shoe: 0x0d141d, accent: 0x9aaabc })
]);

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
    headWidth: 10.5,
    headHeight: 10.5,
    scale: 0.78,
    cap: false,
    collar: false,
    badge: false,
    trench: false,
    glasses: false,
    hairVariant: 0,
    headwear: null
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
    headWidth: 10.5,
    headHeight: 10.5,
    scale: 0.78,
    cap: true,
    collar: false,
    badge: true,
    trench: false,
    glasses: false,
    hairVariant: 0,
    headwear: null
  }),
  protagonist: Object.freeze({
    body: 0x17191d,
    bodyDark: 0x0b0c0f,
    outline: 0x050609,
    skin: 0xd9c1b9,
    hair: 0x121316,
    accent: 0x343941,
    sleeve: 0x15171b,
    trouser: 0x111317,
    shoe: 0x090a0c,
    shoulderWidth: 16.5,
    headWidth: 10.2,
    headHeight: 10.2,
    scale: 0.82,
    cap: false,
    collar: false,
    badge: false,
    trench: true,
    glasses: true,
    hairVariant: 3,
    headwear: null
  })
});

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value || "character")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashIndex(hash, shift, length) {
  if (!length) return 0;
  return ((hash >>> shift) % length + length) % length;
}

export function modularCharacterVariant(styleName = "civilian", phaseKey = "character") {
  const name = MODULAR_CHARACTER_STYLES[styleName] ? styleName : "civilian";
  const hash = hashText(`${name}:${phaseKey}`);
  if (name === "protagonist") {
    return Object.freeze({
      styleName: name,
      paletteIndex: 0,
      skinIndex: 0,
      hairIndex: 0,
      buildIndex: 1,
      hairVariant: 3,
      headwear: null
    });
  }

  const paletteCount = name === "police" ? POLICE_PALETTES.length : CIVILIAN_PALETTES.length;
  const buildIndex = hashIndex(hash, 15, 3);
  const headwearRoll = hashIndex(hash, 22, 12);
  return Object.freeze({
    styleName: name,
    paletteIndex: hashIndex(hash, 0, paletteCount),
    skinIndex: hashIndex(hash, 5, SKIN_TONES.length),
    hairIndex: hashIndex(hash, 9, HAIR_TONES.length),
    buildIndex,
    hairVariant: hashIndex(hash, 12, 4),
    headwear: name === "civilian" && headwearRoll === 0
      ? "beanie"
      : name === "civilian" && headwearRoll === 1
        ? "cap"
        : null
  });
}

function resolvedCharacterStyle(styleName, phaseKey) {
  const base = MODULAR_CHARACTER_STYLES[styleName] || MODULAR_CHARACTER_STYLES.civilian;
  const variant = modularCharacterVariant(styleName, phaseKey);
  if (styleName === "protagonist") return { ...base, variant };

  const palette = styleName === "police"
    ? POLICE_PALETTES[variant.paletteIndex]
    : CIVILIAN_PALETTES[variant.paletteIndex];
  const buildDelta = [-1.7, 0, 1.8][variant.buildIndex] || 0;
  const headScale = [0.94, 1, 1.06][variant.buildIndex] || 1;
  return {
    ...base,
    ...palette,
    skin: SKIN_TONES[variant.skinIndex],
    hair: HAIR_TONES[variant.hairIndex],
    shoulderWidth: base.shoulderWidth + buildDelta,
    headWidth: base.headWidth * headScale,
    headHeight: base.headHeight * (0.97 + (variant.hairVariant % 3) * 0.025),
    hairVariant: variant.hairVariant,
    headwear: variant.headwear,
    variant
  };
}

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

export function modularCharacterFacingRotation(direction = DEFAULT_DIRECTION) {
  const value = normalizedDirection(direction);
  return wrapAngle(Math.atan2(value.y, value.x) + Math.PI / 2);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function modularCharacterIdleMotion({ timeMs = 0, moving = false, phase = 0 } = {}) {
  const time = Math.max(0, Number(timeMs) || 0);
  const breathe = Math.sin(time * 0.0021 + phase);
  const gait = Math.sin(time * 0.014 + phase);
  return {
    upperY: moving ? -Math.abs(gait) * 0.42 : breathe * 0.22,
    coreRotation: moving ? gait * 0.006 : breathe * 0.008,
    coreScale: moving ? 1 : 1 + breathe * 0.006,
    shadowScaleX: moving ? 1 + Math.abs(gait) * 0.025 : 1 - breathe * 0.012
  };
}

export function modularCharacterPose({
  timeMs = 0,
  moving = false,
  weaponId = WEAPON_UNARMED,
  attacking = false,
  attackProgress = 0,
  attackSerial = 0,
  phase = 0
} = {}) {
  const time = Math.max(0, Number(timeMs) || 0);
  const walk = moving ? Math.sin(time * 0.014 + phase) : 0;
  const idle = moving ? 0 : Math.sin(time * 0.0021 + phase);
  const footStride = walk * 2.45;
  const handSwing = moving ? walk * 1.25 : idle * 0.14;
  const progress = clamp01(attackProgress);
  const attackPulse = attacking ? Math.sin(progress * Math.PI) : 0;

  const feet = {
    left: { x: -2.6, y: 3.5 + footStride, rotation: -0.05 * walk },
    right: { x: 2.6, y: 3.5 - footStride, rotation: 0.05 * walk }
  };

  if (weaponId === WEAPON_PISTOL) {
    const recoil = attackPulse * 1.35;
    const locomotionSway = moving ? walk * 0.42 : idle * 0.12;
    const locomotionBob = moving ? Math.abs(walk) * 0.34 : idle * 0.05;
    return {
      hands: {
        left: {
          x: -2.15 - locomotionSway * 0.18,
          y: -5.8 + recoil + locomotionBob + locomotionSway * 0.10,
          rotation: -0.06 - locomotionSway * 0.025
        },
        right: {
          x: 2.15 + locomotionSway * 0.18,
          y: -6.9 + recoil + locomotionBob - locomotionSway * 0.10,
          rotation: 0.05 + locomotionSway * 0.025
        }
      },
      feet,
      pistolVisible: true,
      pipeVisible: false,
      attackKind: attacking ? "pistol" : null
    };
  }

  if (weaponId === WEAPON_PIPE) {
    const swingAngle = attacking ? -1.0 + progress * 2.0 : 0.22 + walk * 0.035;
    const swingRadius = attacking ? 5.0 : 0;
    return {
      hands: {
        left: { x: -8.2, y: 2.0 - handSwing, rotation: -0.08 - walk * 0.04 },
        right: {
          x: attacking ? Math.sin(swingAngle) * swingRadius + 3.2 : 7.0,
          y: attacking ? -Math.cos(swingAngle) * swingRadius - 0.2 : 0.4 + handSwing,
          rotation: swingAngle
        }
      },
      feet,
      pistolVisible: false,
      pipeVisible: true,
      attackKind: attacking ? "pipe" : null
    };
  }

  const rightPunch = Math.abs(Number(attackSerial) || 0) % 2 === 1;
  const punchingSide = rightPunch ? "right" : "left";
  const relaxed = {
    left: { x: -8.3, y: 2.0 - handSwing, rotation: -0.08 - walk * 0.05 },
    right: { x: 8.3, y: 2.0 + handSwing, rotation: 0.08 + walk * 0.05 }
  };

  if (attacking) {
    relaxed[punchingSide] = {
      x: punchingSide === "left" ? -2.4 : 2.4,
      y: 0.2 - attackPulse * 8.4,
      rotation: punchingSide === "left" ? -0.04 : 0.04
    };
  }

  return {
    hands: relaxed,
    feet,
    pistolVisible: false,
    pipeVisible: false,
    attackKind: attacking ? "punch" : null
  };
}

function stablePhase(value) {
  return hashText(value) / 0xffffffff * Math.PI * 2;
}

function addStroke(shape, color, alpha = 0.92) {
  shape?.setStrokeStyle?.(1, color, alpha);
  return shape;
}

function createPistol(scene, style) {
  const pistol = scene.add.container(0, 0).setVisible(false);
  const grip = addStroke(scene.add.rectangle(0.8, -4.8, 2.4, 4.0, 0x242934, 1), style.outline);
  const body = addStroke(scene.add.rectangle(0, -7.1, 2.7, 5.2, 0x353c49, 1), style.outline);
  const muzzle = scene.add.rectangle(0, -9.8, 2.2, 1.2, 0x11151d, 1);
  pistol.add([grip, body, muzzle]);
  return pistol;
}

function createPipe(scene, style) {
  const pipe = scene.add.container(0, 0).setVisible(false);
  const shaft = addStroke(scene.add.rectangle(0, -8.0, 2.4, 14.0, 0x78818b, 1), style.outline, 0.78);
  const cap = addStroke(scene.add.ellipse(0, -15.0, 3.0, 2.2, 0xa6afb7, 1), style.outline, 0.7);
  pipe.add([shaft, cap]);
  return pipe;
}

function createHand(scene, style) {
  const container = scene.add.container(0, 0);
  const sleeve = addStroke(scene.add.rectangle(0, 0.7, 4.2, 6.2, style.sleeve, 1), style.outline);
  const hand = addStroke(scene.add.ellipse(0, -2.7, 3.4, 3.8, style.skin, 1), style.outline, 0.72);
  const pistol = createPistol(scene, style);
  const pipe = createPipe(scene, style);
  container.add([sleeve, hand, pistol, pipe]);
  return { container, pistol, pipe };
}

function createFoot(scene, style) {
  const container = scene.add.container(0, 0);
  const trouser = addStroke(scene.add.rectangle(0, -1.0, 3.9, 3.5, style.trouser, 1), style.outline);
  const shoe = addStroke(scene.add.ellipse(0, 1.5, 4.2, 4.4, style.shoe, 1), style.outline);
  container.add([trouser, shoe]);
  return container;
}

function createHair(scene, style) {
  const parts = [];
  const width = style.headWidth * 0.94;
  const baseY = 0.35;
  if (style.hairVariant === 1) {
    parts.push(addStroke(scene.add.ellipse(-1.7, baseY, width * 0.72, 8.0, style.hair, 1), style.outline, 0.72));
    parts.push(addStroke(scene.add.ellipse(2.0, 0.1, width * 0.62, 7.5, style.hair, 1), style.outline, 0.72));
  } else if (style.hairVariant === 2) {
    parts.push(addStroke(scene.add.ellipse(0, 0.6, width, 7.4, style.hair, 1), style.outline, 0.72));
    parts.push(scene.add.rectangle(-3.4, -2.6, 2.0, 2.5, style.hair, 1));
    parts.push(scene.add.rectangle(3.0, -2.2, 2.2, 2.2, style.hair, 1));
  } else if (style.hairVariant === 3) {
    parts.push(addStroke(scene.add.ellipse(0, 0.8, width * 0.92, 6.5, style.hair, 1), style.outline, 0.72));
  } else {
    parts.push(addStroke(scene.add.ellipse(0, 0.4, width, 8.7, style.hair, 1), style.outline, 0.72));
  }
  return parts;
}

function createTrenchCoat(scene, style) {
  if (!style.trench) return null;
  const container = scene.add.container(0, 0);
  const leftTail = addStroke(scene.add.rectangle(-3.1, 8.0, 5.1, 11.8, style.bodyDark, 1), style.outline, 0.92)
    .setRotation(-0.065);
  const rightTail = addStroke(scene.add.rectangle(3.1, 8.0, 5.1, 11.8, style.bodyDark, 1), style.outline, 0.92)
    .setRotation(0.065);
  const leftSeam = scene.add.rectangle(-2.0, 7.7, 0.9, 8.8, style.accent, 0.42).setRotation(-0.045);
  const rightSeam = scene.add.rectangle(2.0, 7.7, 0.9, 8.8, style.accent, 0.42).setRotation(0.045);
  container.add([leftTail, rightTail, leftSeam, rightSeam]);
  return { container, leftTail, rightTail };
}

function createCore(scene, style) {
  const core = scene.add.container(0, 0);
  const shoulders = addStroke(scene.add.ellipse(0, 2.3, style.shoulderWidth, 5.4, style.body, 1), style.outline);
  const shoulderShade = scene.add.ellipse(0, 2.8, Math.max(6, style.shoulderWidth - 5), 2.3, style.bodyDark, 0.54);
  const parts = [shoulders, shoulderShade];

  if (style.collar) {
    const leftCollar = addStroke(scene.add.rectangle(-5.0, 0.8, 3.7, 4.8, style.accent, 1), style.outline)
      .setRotation(-0.44);
    const rightCollar = addStroke(scene.add.rectangle(5.0, 0.8, 3.7, 4.8, style.accent, 1), style.outline)
      .setRotation(0.44);
    parts.push(leftCollar, rightCollar);
  }

  const head = addStroke(scene.add.ellipse(0, -0.8, style.headWidth, style.headHeight, style.skin, 1), style.outline);
  parts.push(head);

  if (style.cap) {
    const cap = addStroke(scene.add.ellipse(0, 0.0, style.headWidth + 0.8, 9.4, style.body, 1), style.outline);
    const brim = addStroke(scene.add.rectangle(0, -4.9, 8.8, 2.1, style.bodyDark, 1), style.outline);
    const capBadge = scene.add.rectangle(0, -5.0, 2.4, 1.3, style.accent, 1);
    parts.push(cap, brim, capBadge);
  } else {
    parts.push(...createHair(scene, style));
    const faceTip = scene.add.ellipse(0, -5.0, 3.2, 1.8, style.skin, 1);
    parts.push(faceTip);

    if (style.headwear === "beanie") {
      const beanie = addStroke(scene.add.ellipse(0, 0.6, style.headWidth + 0.4, 8.1, style.bodyDark, 1), style.outline, 0.8);
      const edge = scene.add.rectangle(0, -3.2, style.headWidth - 1.0, 1.5, style.accent, 0.72);
      parts.push(beanie, edge, faceTip);
    } else if (style.headwear === "cap") {
      const cap = addStroke(scene.add.ellipse(0, 0.5, style.headWidth + 0.5, 7.8, style.bodyDark, 1), style.outline, 0.8);
      const brim = addStroke(scene.add.rectangle(0, -4.4, 7.4, 1.8, style.bodyDark, 1), style.outline, 0.75);
      parts.push(cap, brim, faceTip);
    }
  }

  if (style.badge) {
    const leftEpaulette = addStroke(scene.add.rectangle(-6.2, 2.0, 2.8, 2.8, style.accent, 1), style.outline, 0.64);
    const rightEpaulette = addStroke(scene.add.rectangle(6.2, 2.0, 2.8, 2.8, style.accent, 1), style.outline, 0.64);
    parts.push(leftEpaulette, rightEpaulette);
  }

  if (style.glasses) {
    const glasses = scene.add.rectangle(0, -4.0, 5.7, 1.25, 0x050608, 0.95);
    const bridge = scene.add.rectangle(0, -4.0, 1.0, 1.0, style.accent, 0.9);
    parts.push(glasses, bridge);
  }

  core.add(parts);
  return core;
}

function attackPresentation(scene) {
  const attack = scene?.combatSystem?.attack || null;
  if (!attack) return { attacking: false, progress: 0, serial: 0 };
  const config = attack.config || {};
  const total = Math.max(1,
    (Number(config.windupMs) || 0)
    + (Number(config.activeMs) || 0)
    + (Number(config.recoveryMs) || 0));
  return {
    attacking: true,
    progress: clamp01((Number(attack.elapsedMs) || 0) / total),
    serial: Number(attack.serial) || 0
  };
}

export class ModularCharacterView {
  constructor(scene, hostContainer, styleName = "civilian", { phaseKey = "character" } = {}) {
    if (!scene || !hostContainer) throw new TypeError("ModularCharacterView requires a scene and host container.");
    this.scene = scene;
    this.host = hostContainer;
    this.isPlayer = hostContainer === scene.player;
    this.styleName = MODULAR_CHARACTER_STYLES[styleName] ? styleName : "civilian";
    this.style = resolvedCharacterStyle(this.styleName, phaseKey);
    this.variant = this.style.variant;
    this.phase = stablePhase(phaseKey);
    this.lastMovementDirection = { ...DEFAULT_DIRECTION };
    this.lastLookDirection = { ...DEFAULT_DIRECTION };
    this.upperRotation = 0;
    this.feetRotation = 0;

    this.root = scene.add.container(0, 0).setScale(this.style.scale || 0.78);
    this.shadow = scene.add.ellipse(0, 4.5, this.style.shoulderWidth + 5, 5.4, 0x000000, 0.27);
    this.feetRoot = scene.add.container(0, 0);
    this.upperRoot = scene.add.container(0, 0);
    this.leftFoot = createFoot(scene, this.style);
    this.rightFoot = createFoot(scene, this.style);
    this.trench = createTrenchCoat(scene, this.style);
    this.core = createCore(scene, this.style);
    this.leftHand = createHand(scene, this.style);
    this.rightHand = createHand(scene, this.style);

    this.feetRoot.add([this.leftFoot, this.rightFoot]);
    if (this.trench) this.upperRoot.add(this.trench.container);
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

  selectedWeaponId(explicitWeaponId, aiming) {
    if (explicitWeaponId) return explicitWeaponId;
    if (this.isPlayer) return this.scene.weaponSystem?.currentWeapon?.()?.id || WEAPON_UNARMED;
    if (this.styleName === "police" && aiming) return WEAPON_PISTOL;
    return WEAPON_UNARMED;
  }

  update({
    timeMs = 0,
    direction = null,
    movementDirection = direction || this.lastMovementDirection,
    aimDirection = this.lastLookDirection,
    moving = false,
    aiming = false,
    weaponId = null,
    attacking = null,
    attackProgress = null,
    attackSerial = null
  } = {}) {
    if (hasDirection(movementDirection)) this.lastMovementDirection = normalizedDirection(movementDirection);

    const combatAim = this.isPlayer ? this.scene.combatSystem?.aimDirection : null;
    const requestedLook = hasDirection(combatAim) ? combatAim : aimDirection;
    if (hasDirection(requestedLook)) this.lastLookDirection = normalizedDirection(requestedLook);

    if (moving) this.feetRotation = modularCharacterFacingRotation(this.lastMovementDirection);
    this.upperRotation = modularCharacterFacingRotation(this.lastLookDirection);

    const hostRotation = Number(this.host?.rotation) || 0;
    const idleMotion = modularCharacterIdleMotion({ timeMs, moving, phase: this.phase });
    this.feetRoot.setPosition(0, 0).setRotation(wrapAngle(this.feetRotation - hostRotation));
    this.upperRoot
      .setPosition(0, idleMotion.upperY)
      .setRotation(wrapAngle(this.upperRotation - hostRotation));
    this.core.setRotation(idleMotion.coreRotation).setScale(idleMotion.coreScale);
    this.shadow.setRotation(-hostRotation).setScale(idleMotion.shadowScaleX, 1);

    if (this.trench) {
      const gait = moving ? Math.sin(Math.max(0, Number(timeMs) || 0) * 0.014 + this.phase) : 0;
      const idleDrift = moving ? 0 : Math.sin(Math.max(0, Number(timeMs) || 0) * 0.0017 + this.phase) * 0.018;
      const swing = gait * 0.075 + idleDrift;
      this.trench.leftTail.setRotation(-0.065 - swing);
      this.trench.rightTail.setRotation(0.065 + swing);
    }

    const attack = this.isPlayer ? attackPresentation(this.scene) : null;
    const resolvedAttacking = attacking == null ? Boolean(attack?.attacking) : Boolean(attacking);
    const resolvedProgress = attackProgress == null ? Number(attack?.progress) || 0 : attackProgress;
    const resolvedSerial = attackSerial == null ? Number(attack?.serial) || 0 : attackSerial;
    const resolvedWeaponId = this.selectedWeaponId(weaponId, aiming);

    const pose = modularCharacterPose({
      timeMs,
      moving: Boolean(moving),
      weaponId: resolvedWeaponId,
      attacking: resolvedAttacking,
      attackProgress: resolvedProgress,
      attackSerial: resolvedSerial,
      phase: this.phase
    });

    this.applyPartPose(this.leftHand.container, pose.hands.left);
    this.applyPartPose(this.rightHand.container, pose.hands.right);
    this.applyPartPose(this.leftFoot, pose.feet.left);
    this.applyPartPose(this.rightFoot, pose.feet.right);

    this.leftHand.pistol.setVisible(false);
    this.leftHand.pipe.setVisible(false);
    this.rightHand.pistol.setVisible(Boolean(pose.pistolVisible));
    this.rightHand.pipe.setVisible(Boolean(pose.pipeVisible));

    return {
      ...pose,
      upperRotation: this.upperRotation,
      feetRotation: this.feetRotation,
      lookDirection: { ...this.lastLookDirection },
      movementDirection: { ...this.lastMovementDirection },
      variant: this.variant,
      idleMotion
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
