import test from "node:test";
import assert from "node:assert/strict";
import { CONTROL_MODES, applyControlMode, createEmptyInputFrame } from "../phaser/src/input/actions.js";

test("numeric choices cannot trigger gameplay layer switching", () => {
  for (const digit of [1, 2, 3, 4]) {
    const frame = createEmptyInputFrame({
      worldEnabled: true,
      menuDigitPressed: digit,
      debugLayerPressed: digit
    });
    const filtered = applyControlMode(frame, CONTROL_MODES.FULL, true);

    assert.equal(filtered.menuDigitPressed, digit, `digit ${digit} remains available to menu choices`);
    assert.equal(filtered.debugLayerPressed, 0, `digit ${digit} must not trigger a debug layer teleport`);
  }
});
