import test from "node:test";
import assert from "node:assert/strict";

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter(item => item !== listener));
  }
  emit(type, ...args) {
    for (const listener of this.listeners.get(type) || []) listener(...args);
  }
  on(type, listener) {
    this.addEventListener(type, listener);
  }
  off(type, listener) {
    this.removeEventListener(type, listener);
  }
  getBoundingClientRect() {
    return { left: 100, top: 50, width: 720, height: 480 };
  }
}

function key() {
  return {
    enabled: true,
    isDown: false,
    _justDown: false,
    reset() {
      this.isDown = false;
      this._justDown = false;
    }
  };
}

const keyboardKeys = [
  "up", "down", "left", "right", "w", "a", "s", "d", "shift", "interact",
  "dash", "whisper", "sense", "enter", "escape", "space", "street", "roofLow",
  "roofHigh", "sewer", "five", "six", "seven", "eight", "nine"
];

const windowTarget = new FakeTarget();
const documentTarget = new FakeTarget();
documentTarget.hidden = false;
globalThis.window = windowTarget;
globalThis.document = documentTarget;
globalThis.Phaser = {
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Input: {
    Keyboard: {
      KeyCodes: Object.fromEntries(keyboardKeys.map((name, index) => [name.toUpperCase(), index + 1])),
      JustDown(inputKey) {
        const value = Boolean(inputKey?._justDown);
        if (inputKey) inputKey._justDown = false;
        return value;
      }
    }
  }
};

const { InputSystem } = await import("../phaser/src/input/InputSystem.js");
const { CONTROL_MODES } = await import("../phaser/src/input/actions.js");

function makeScene() {
  const keys = Object.fromEntries(keyboardKeys.map(name => [name, key()]));
  const canvas = new FakeTarget();
  const registryValues = new Map();
  const registryEvents = new FakeTarget();
  return {
    keys,
    canvas,
    scene: {
      game: { canvas },
      keys,
      player: { x: 20, y: 30 },
      time: { now: 1234 },
      registry: {
        get: keyName => registryValues.get(keyName),
        events: registryEvents
      },
      taskRevealCinematic: { active: false },
      scale: { gameSize: { width: 1440, height: 960 } },
      cameras: {
        main: {
          width: 1440,
          height: 960,
          zoom: 2,
          worldView: { x: 100, y: 40 },
          scrollX: 100,
          scrollY: 40
        }
      },
      input: {
        activePointer: { withinGame: true, x: 0, y: 0 },
        keyboard: {
          addKeys: () => keys,
          resetKeys: () => Object.values(keys).forEach(value => value.reset())
        }
      },
      events: { once() {} }
    }
  };
}

test("InputSystem creates one action frame from keyboard and CSS-scaled pointer input", () => {
  const { scene, keys } = makeScene();
  const input = new InputSystem(scene, { keys });
  input.onPointerMove({ clientX: 460, clientY: 290 });
  keys.d.isDown = true;
  keys.space.isDown = true;
  keys.space._justDown = true;
  keys.dash._justDown = true;

  const frame = input.beginFrame();
  assert.deepEqual(frame.move, { x: 1, y: 0 });
  assert.equal(frame.hasMovementIntent, true);
  assert.equal(frame.sprintHeld, true);
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.dashPressed, true);
  assert.deepEqual(frame.aimWorld, { x: 460, y: 280 });

  const next = input.beginFrame();
  assert.equal(next.traversePressed, false);
  assert.equal(next.dashPressed, false);
  input.destroy();
});

test("InputSystem central control modes block powers without disabling raw keys", () => {
  const { scene, keys } = makeScene();
  const input = new InputSystem(scene, { keys });
  input.setControlMode(CONTROL_MODES.MOVEMENT);
  keys.d.isDown = true;
  keys.dash._justDown = true;
  keys.space._justDown = true;

  const frame = input.beginFrame();
  assert.equal(frame.hasMovementIntent, true);
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.dashPressed, false);
  assert.equal(keys.dash.enabled, true);
  input.destroy();
});

test("InputSystem does not queue pointer or wheel actions while world input is locked", () => {
  const { scene, keys } = makeScene();
  const input = new InputSystem(scene, { keys });
  input.setWorldEnabled(false);
  input.onPointerDown({ button: 0, clientX: 120, clientY: 80 });
  input.onPointerDown({ button: 2, clientX: 120, clientY: 80 });
  input.onWheel({ deltaY: 100, preventDefault() {} });
  input.setWorldEnabled(true);

  const frame = input.beginFrame();
  assert.equal(frame.primaryPressed, false);
  assert.equal(frame.primaryHeld, false);
  assert.equal(frame.drainPressed, false);
  assert.equal(frame.drainHeld, false);
  assert.equal(frame.weaponStep, 0);
  input.destroy();
});

test("InputSystem resets held actions when UI or task locks actually change", () => {
  const { scene, keys } = makeScene();
  const input = new InputSystem(scene, { keys });
  input.onPointerDown({ button: 0, clientX: 120, clientY: 80 });
  keys.w.isDown = true;
  scene.registry.events.emit("changedata-uiPaused", null, true, false);
  assert.equal(input.primaryHeld, false);
  assert.equal(keys.w.isDown, false);
  input.destroy();
});

test("InputSystem keeps keyboard state when UIScene republishes the same pause value", () => {
  const { scene, keys } = makeScene();
  const input = new InputSystem(scene, { keys });
  keys.w.isDown = true;

  scene.registry.events.emit("changedata-uiPaused", null, false, false);

  assert.equal(keys.w.isDown, true);
  const frame = input.beginFrame();
  assert.equal(frame.hasMovementIntent, true);
  assert.deepEqual(frame.move, { x: 0, y: -1 });
  input.destroy();
});

test("InputSystem clears held pointer and keyboard state on reset", () => {
  const { scene, keys } = makeScene();
  const input = new InputSystem(scene, { keys });
  input.onPointerDown({ button: 0, clientX: 120, clientY: 80 });
  keys.w.isDown = true;
  input.reset();
  assert.equal(input.primaryHeld, false);
  assert.equal(keys.w.isDown, false);
  input.destroy();
});
