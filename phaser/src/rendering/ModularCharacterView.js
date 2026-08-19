const DEFAULT_DIRECTION = Object.freeze({ x: 0, y: -1 });
const WEAPON_UNARMED = "unarmed";
const WEAPON_PIPE = "iron_pipe";
const WEAPON_PISTOL = "pistol";

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
    badge: false
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
    badge: true
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
    badge: false
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

export function modularCharacterFacingRotation(direction = DEFAULT_DIRECTION) {
  const value = normalizedDirection(direction);
  // Character pieces are authored facing north (negative Y).
  return wrapAngle(Math.atan2(value.y, value.x) + Math.PI / 2);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
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
  const footStride = walk * 2.45;
  const handSwing = walk * 1.25;
  const progress = clamp01(attackProgress);
  const attackPulse = attacking ? Math.sin(progress * Math.PI) : 0;

  // Feet are anchored directly underneath the torso origin. Their only local
  // displacement is the gait itself; the whole feet root rotates with actual
  // movement so the cadence reads identically in every world direction.
  const feet = {
    left: { x: -2.6, y: 3.5 + footStride, rotation: -0.05 * walk },
    right: { x: 2.6, y: 3.5 - footStride, rotation: 0.05 * walk }
  };

  if (weaponId === WEAPON_PISTOL) {
    const recoil = attackPulse * 1.35;
    return {
      hands: {
        left: { x: -2.15, y: -5.8 + recoil, rotation: -0.06 },
        right: { x: 2.15, y: -6.9 + recoil, rotation: 0.05 }
      },
      feet,
      pistolVisible: true,
      pipeVisible: false,
      attackKind: attacking ? "pistol" : null
    };
  }

  if (weaponId === WEAPON_PIPE) {
    const swingAngle = attacking ? -1.0 + progress * 2.0 : 0.22;
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

function createCore(scene, style) {
  const core = scene.add.container(0, 0);

  // Very shallow shoulders keep the core genuinely overhead. Rotation should
  // never reveal a preferred "front view" of the torso.
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

  const head = addStroke(scene.add.ellipse(0, -0.8, 10.5, 10.5, style.skin, 1), style.outline);
  parts.push(head);

  if (style.cap) {
    const cap = addStroke(scene.add.ellipse(0, 0.0, 11.3, 9.4, style.body, 1), style.outline);
    const brim = addStroke(scene.add.rectangle(0, -4.9, 8.8, 2.1, style.bodyDark, 1), style.outline);
    const capBadge = scene.add.rectangle(0, -5.0, 2.4, 1.3, style.accent, 1);
    parts.push(cap, brim, capBadge);
  } else {
    // Hair occupies the rear of the skull. The exposed skin crescent at -Y is
    // the face, making the look direction readable under continuous rotation.
    const hair = addStroke(scene.add.ellipse(0, 0.4, 9.9, 8.7, style.hair, 1), style.outline, 0.72);
    const faceTip = scene.add.ellipse(0, -5.0, 3.2, 1.8, style.skin, 1);
    parts.push(hair, faceTip);
  }

  if (style.badge) {
    const leftEpaulette = addStroke(scene.add.rectangle(-6.2, 2.0, 2.8, 2.8, style.accent, 1), style.outline, 0.64);
    const rightEpaulette = addStroke(scene.add.rectangle(6.2, 2.0, 2.8, 2.8, style.accent, 1), style.outline, 0.64);
    parts.push(leftEpaulette, rightEpaulette);
  }

  if (style.collar) {
    const clasp = scene.add.rectangle(0, 2.4, 2.0, 1.5, style.accent, 1);
    parts.push(clasp);
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
    this.style = MODULAR_CHARACTER_STYLES[this.styleName];
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
    if (hasDirection(movementDirection)) {
      this.lastMovementDirection = normalizedDirection(movementDirection);
    }

    // The player's actual CombatSystem aim is authoritative. Presentation uses
    // exactly the same direction as hit resolution, eliminating mouse/face drift.
    const combatAim = this.isPlayer ? this.scene.combatSystem?.aimDirection : null;
    const requestedLook = hasDirection(combatAim) ? combatAim : aimDirection;
    if (hasDirection(requestedLook)) this.lastLookDirection = normalizedDirection(requestedLook);

    if (moving) this.feetRotation = modularCharacterFacingRotation(this.lastMovementDirection);
    this.upperRotation = modularCharacterFacingRotation(this.lastLookDirection);

    // CombatSystem still rotates the legacy player host container. Counter that
    // transform here so upper body and feet end up at the intended world angles.
    const hostRotation = Number(this.host?.rotation) || 0;
    this.feetRoot.setPosition(0, 0).setRotation(wrapAngle(this.feetRotation - hostRotation));
    this.upperRoot.setRotation(wrapAngle(this.upperRotation - hostRotation));
    this.shadow.setRotation(-hostRotation);

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
      movementDirection: { ...this.lastMovementDirection }
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
