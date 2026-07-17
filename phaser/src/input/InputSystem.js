import {
  CONTROL_MODES,
  applyControlMode,
  createEmptyInputFrame,
  normalizeControlMode,
  wheelStepFromDelta
} from "./actions.js";
import { clientToGamePoint, normalizeVector, screenToWorldPoint } from "../utils/geometry.js";

const KEY_BINDINGS = Object.freeze({
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
  w: "W",
  a: "A",
  s: "S",
  d: "D",
  shift: "SHIFT",
  interact: "E",
  dash: "Q",
  whisper: "R",
  sense: "F",
  enter: "ENTER",
  escape: "ESC",
  space: "SPACE",
  street: "ONE",
  roofLow: "TWO",
  roofHigh: "THREE",
  sewer: "FOUR",
  five: "FIVE",
  six: "SIX",
  seven: "SEVEN",
  eight: "EIGHT",
  nine: "NINE"
});

export class InputSystem {
  constructor(scene, { keys = null } = {}) {
    if (!scene) throw new TypeError("InputSystem requires a Phaser scene.");

    this.scene = scene;
    this.keys = keys || this.createKeys();
    this.controlMode = CONTROL_MODES.FULL;
    this.worldEnabled = true;
    this.wheelCaptureEnabled = false;
    this.pointerInside = false;
    this.primaryHeld = false;
    this.primaryPressed = false;
    this.drainHeld = false;
    this.drainPressed = false;
    this.pendingWheelStep = 0;
    this.pointerClient = null;
    this.frame = createEmptyInputFrame();
    this.canvas = scene.game?.canvas || null;

    this.onPointerEnter = event => {
      this.pointerInside = true;
      this.rememberPointerClient(event);
    };
    this.onPointerMove = event => {
      this.pointerInside = true;
      this.rememberPointerClient(event);
    };
    this.onPointerLeave = () => {
      this.pointerInside = false;
      this.primaryHeld = false;
      this.primaryPressed = false;
      this.drainHeld = false;
      this.drainPressed = false;
      this.pointerClient = null;
    };
    this.onPointerDown = event => {
      this.pointerInside = true;
      this.rememberPointerClient(event);
      if (!this.worldEnabled || this.sceneBlocked()) return;
      if (event.button === 0) {
        this.primaryHeld = true;
        this.primaryPressed = true;
      } else if (event.button === 2) {
        this.drainHeld = true;
        this.drainPressed = true;
      }
    };
    this.onPointerUp = event => {
      if (event.button === 0) this.primaryHeld = false;
      if (event.button === 2) this.drainHeld = false;
    };
    this.onContextMenu = event => event.preventDefault();
    this.onWheel = event => {
      const capturesWheel = this.wheelCaptureEnabled || Boolean(this.scene.weaponSystem);
      if (capturesWheel) event.preventDefault();
      if (!this.worldEnabled || this.sceneBlocked()) return;
      const step = wheelStepFromDelta(event.deltaY);
      if (!step) return;
      this.pendingWheelStep = Math.max(-1, Math.min(1, this.pendingWheelStep + step));
    };
    this.onWorldLockChanged = () => this.reset();
    this.onBlur = () => this.reset();
    this.onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.hidden) this.reset();
    };

    this.bindDomEvents();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  createKeys() {
    const codes = Phaser.Input.Keyboard.KeyCodes;
    const bindings = Object.fromEntries(
      Object.entries(KEY_BINDINGS).map(([name, code]) => [name, codes[code]])
    );
    return this.scene.input.keyboard.addKeys(bindings);
  }

  bindDomEvents() {
    if (!this.canvas || typeof window === "undefined" || typeof document === "undefined") return;

    this.canvas.addEventListener("pointerenter", this.onPointerEnter);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.scene.registry?.events?.on?.("changedata-uiPaused", this.onWorldLockChanged);
    this.scene.registry?.events?.on?.("changedata-taskRevealActive", this.onWorldLockChanged);
  }

  destroy() {
    if (this.canvas && typeof window !== "undefined" && typeof document !== "undefined") {
      this.canvas.removeEventListener("pointerenter", this.onPointerEnter);
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("contextmenu", this.onContextMenu);
      this.canvas.removeEventListener("wheel", this.onWheel);
      window.removeEventListener("pointerup", this.onPointerUp);
      window.removeEventListener("blur", this.onBlur);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
    this.scene.registry?.events?.off?.("changedata-uiPaused", this.onWorldLockChanged);
    this.scene.registry?.events?.off?.("changedata-taskRevealActive", this.onWorldLockChanged);
    this.reset();
  }

  setControlMode(mode) {
    const nextMode = normalizeControlMode(mode);
    if (nextMode === this.controlMode) return;
    this.controlMode = nextMode;
    this.resetWorldEdges();
  }

  setWorldEnabled(enabled) {
    const next = Boolean(enabled);
    if (next === this.worldEnabled) return;
    this.worldEnabled = next;
    this.resetWorldEdges();
  }

  setWheelCaptureEnabled(enabled) {
    this.wheelCaptureEnabled = Boolean(enabled);
  }

  resetWorldEdges() {
    this.primaryHeld = false;
    this.primaryPressed = false;
    this.drainHeld = false;
    this.drainPressed = false;
    this.pendingWheelStep = 0;
    this.scene.input.keyboard?.resetKeys?.();
  }

  reset() {
    this.pointerInside = false;
    this.primaryHeld = false;
    this.primaryPressed = false;
    this.drainHeld = false;
    this.drainPressed = false;
    this.pendingWheelStep = 0;
    this.pointerClient = null;
    this.scene.input.keyboard?.resetKeys?.();
    this.frame = createEmptyInputFrame({
      controlMode: this.controlMode,
      worldEnabled: false,
      aimWorld: this.playerFallbackPoint()
    });
  }

  beginFrame() {
    const moveX = (this.isDown(this.keys.right) || this.isDown(this.keys.d) ? 1 : 0)
      - (this.isDown(this.keys.left) || this.isDown(this.keys.a) ? 1 : 0);
    const moveY = (this.isDown(this.keys.down) || this.isDown(this.keys.s) ? 1 : 0)
      - (this.isDown(this.keys.up) || this.isDown(this.keys.w) ? 1 : 0);
    const move = normalizeVector(moveX, moveY);
    const aimWorld = this.pointerWorldPoint();
    const digitPressed = this.firstDigitPressed();
    const traversePressed = this.justDown(this.keys.space);
    const interactPressed = this.justDown(this.keys.interact);
    const enterPressed = this.justDown(this.keys.enter);
    const escapePressed = this.justDown(this.keys.escape);
    const upPressed = this.justDown(this.keys.up);
    const wPressed = this.justDown(this.keys.w);
    const downPressed = this.justDown(this.keys.down);
    const sPressed = this.justDown(this.keys.s);
    const rawFrame = createEmptyInputFrame({
      timestamp: this.scene.time?.now || 0,
      controlMode: this.controlMode,
      worldEnabled: true,
      move: { x: move.x, y: move.y },
      hasMovementIntent: Boolean(move.length),
      aimWorld,
      pointerInside: this.pointerInside || Boolean(this.scene.input?.activePointer?.withinGame),
      // Preserve the current build's behaviour until traversal-only Space lands
      // in Milestone 5. Ownership is centralized here, so that later change is local.
      sprintHeld: this.isDown(this.keys.space),
      primaryHeld: this.primaryHeld,
      primaryPressed: this.consumePrimaryPressed(),
      drainHeld: this.drainHeld,
      drainPressed: this.consumeDrainPressed(),
      traversePressed,
      interactPressed,
      weaponStep: this.consumeWheelStep(),
      dashPressed: this.justDown(this.keys.dash),
      whisperPressed: this.justDown(this.keys.whisper),
      bloodSensePressed: this.justDown(this.keys.sense),
      menuUpPressed: upPressed || wPressed,
      menuDownPressed: downPressed || sPressed,
      menuConfirmPressed: interactPressed || enterPressed,
      menuCancelPressed: escapePressed,
      menuDigitPressed: digitPressed,
      debugLayerPressed: digitPressed >= 1 && digitPressed <= 4 ? digitPressed : 0
    });

    const worldAllowed = this.worldEnabled && !this.sceneBlocked();
    this.frame = applyControlMode(rawFrame, this.controlMode, worldAllowed);
    return this.frame;
  }

  snapshot() {
    return this.frame;
  }

  sceneBlocked() {
    const registry = this.scene.registry;
    return Boolean(
      registry?.get?.("uiPaused")
      || registry?.get?.("taskRevealActive")
      || this.scene.taskRevealCinematic?.active
    );
  }

  pointerWorldPoint() {
    const pointer = this.scene.input?.activePointer;
    const camera = this.scene.cameras?.main;
    if (!camera) return this.playerFallbackPoint();

    if (this.pointerClient && this.canvas?.getBoundingClientRect) {
      const rect = this.canvas.getBoundingClientRect();
      const gamePoint = clientToGamePoint(this.pointerClient, rect, {
        width: camera.width || this.scene.scale?.gameSize?.width,
        height: camera.height || this.scene.scale?.gameSize?.height
      });
      return screenToWorldPoint(gamePoint, {
        worldView: camera.worldView,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoom: camera.zoom
      });
    }

    if (pointer && typeof pointer.positionToCamera === "function") {
      const point = pointer.positionToCamera(camera);
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
        return { x: point.x, y: point.y };
      }
    }

    if (pointer) {
      return screenToWorldPoint(
        { x: pointer.x, y: pointer.y },
        { worldView: camera.worldView, scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom }
      );
    }

    return this.playerFallbackPoint();
  }

  rememberPointerClient(event) {
    if (!event || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    this.pointerClient = { x: event.clientX, y: event.clientY };
  }

  playerFallbackPoint() {
    return {
      x: Number(this.scene.player?.x) || 0,
      y: Number(this.scene.player?.y) || 0
    };
  }

  firstDigitPressed() {
    const digitKeys = [
      this.keys.street,
      this.keys.roofLow,
      this.keys.roofHigh,
      this.keys.sewer,
      this.keys.five,
      this.keys.six,
      this.keys.seven,
      this.keys.eight,
      this.keys.nine
    ];
    for (let index = 0; index < digitKeys.length; index++) {
      if (this.justDown(digitKeys[index])) return index + 1;
    }
    return 0;
  }

  consumePrimaryPressed() {
    const pressed = this.primaryPressed;
    this.primaryPressed = false;
    return pressed;
  }

  consumeDrainPressed() {
    const pressed = this.drainPressed;
    this.drainPressed = false;
    return pressed;
  }

  consumeWheelStep() {
    const step = Math.sign(this.pendingWheelStep || 0);
    this.pendingWheelStep = 0;
    return step;
  }

  isDown(key) {
    return Boolean(key?.enabled !== false && key?.isDown);
  }

  justDown(key) {
    return Boolean(key?.enabled !== false && Phaser.Input.Keyboard.JustDown(key));
  }
}
