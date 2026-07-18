export const INPUT_ACTIONS = Object.freeze({
  MOVE: "move",
  AIM: "aim",
  PRIMARY_ATTACK: "primaryAttack",
  DRAIN: "drain",
  TRAVERSE: "traverse",
  INTERACT: "interact",
  WEAPON_CYCLE: "weaponCycle",
  DASH: "dash",
  WHISPER: "whisper",
  BLOOD_SENSE: "bloodSense",
  DEBUG_LAYER: "debugLayer"
});

export const CONTROL_MODES = Object.freeze({
  FULL: "full",
  MOVEMENT: "movement",
  DRAIN: "drain",
  TIP: "tip",
  LOCKED: "locked"
});

const MODE_ACTIONS = Object.freeze({
  [CONTROL_MODES.FULL]: new Set(Object.values(INPUT_ACTIONS)),
  [CONTROL_MODES.MOVEMENT]: new Set([
    INPUT_ACTIONS.MOVE,
    INPUT_ACTIONS.AIM,
    INPUT_ACTIONS.TRAVERSE
  ]),
  [CONTROL_MODES.DRAIN]: new Set([
    INPUT_ACTIONS.MOVE,
    INPUT_ACTIONS.AIM,
    INPUT_ACTIONS.PRIMARY_ATTACK,
    INPUT_ACTIONS.DRAIN,
    INPUT_ACTIONS.TRAVERSE,
    INPUT_ACTIONS.INTERACT
  ]),
  [CONTROL_MODES.TIP]: new Set([
    INPUT_ACTIONS.MOVE,
    INPUT_ACTIONS.AIM,
    INPUT_ACTIONS.TRAVERSE,
    INPUT_ACTIONS.INTERACT
  ]),
  [CONTROL_MODES.LOCKED]: new Set([INPUT_ACTIONS.AIM])
});

export function normalizeControlMode(mode) {
  return MODE_ACTIONS[mode] ? mode : CONTROL_MODES.FULL;
}

export function modeAllows(mode, action) {
  return MODE_ACTIONS[normalizeControlMode(mode)].has(action);
}

export function wheelStepFromDelta(deltaY) {
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 0.01) return 0;
  return deltaY > 0 ? 1 : -1;
}

export function createEmptyInputFrame(overrides = {}) {
  return {
    timestamp: 0,
    controlMode: CONTROL_MODES.FULL,
    worldEnabled: false,
    move: { x: 0, y: 0 },
    hasMovementIntent: false,
    aimWorld: { x: 0, y: 0 },
    pointerInside: false,
    quietHeld: false,
    sprintHeld: false,
    primaryHeld: false,
    primaryPressed: false,
    drainHeld: false,
    drainPressed: false,
    traversePressed: false,
    interactPressed: false,
    weaponStep: 0,
    dashPressed: false,
    whisperPressed: false,
    bloodSensePressed: false,
    menuUpPressed: false,
    menuDownPressed: false,
    menuConfirmPressed: false,
    menuCancelPressed: false,
    menuDigitPressed: 0,
    debugLayerPressed: 0,
    ...overrides
  };
}

export function applyControlMode(frame, mode, worldEnabled = true) {
  const controlMode = normalizeControlMode(mode);
  const enabled = Boolean(worldEnabled);
  const allows = action => enabled && modeAllows(controlMode, action);
  const moveAllowed = allows(INPUT_ACTIONS.MOVE);

  return {
    ...frame,
    controlMode,
    worldEnabled: enabled,
    move: moveAllowed ? { ...frame.move } : { x: 0, y: 0 },
    hasMovementIntent: moveAllowed && Boolean(frame.hasMovementIntent),
    quietHeld: moveAllowed && Boolean(frame.quietHeld),
    // Kept as a neutral compatibility field until old snapshots/tests stop reading it.
    sprintHeld: false,
    primaryHeld: allows(INPUT_ACTIONS.PRIMARY_ATTACK) && Boolean(frame.primaryHeld),
    primaryPressed: allows(INPUT_ACTIONS.PRIMARY_ATTACK) && Boolean(frame.primaryPressed),
    drainHeld: allows(INPUT_ACTIONS.DRAIN) && Boolean(frame.drainHeld),
    drainPressed: allows(INPUT_ACTIONS.DRAIN) && Boolean(frame.drainPressed),
    traversePressed: allows(INPUT_ACTIONS.TRAVERSE) && Boolean(frame.traversePressed),
    interactPressed: allows(INPUT_ACTIONS.INTERACT) && Boolean(frame.interactPressed),
    weaponStep: allows(INPUT_ACTIONS.WEAPON_CYCLE) ? Math.sign(frame.weaponStep || 0) : 0,
    dashPressed: allows(INPUT_ACTIONS.DASH) && Boolean(frame.dashPressed),
    whisperPressed: allows(INPUT_ACTIONS.WHISPER) && Boolean(frame.whisperPressed),
    bloodSensePressed: allows(INPUT_ACTIONS.BLOOD_SENSE) && Boolean(frame.bloodSensePressed),
    debugLayerPressed: allows(INPUT_ACTIONS.DEBUG_LAYER) ? Number(frame.debugLayerPressed || 0) : 0
  };
}
