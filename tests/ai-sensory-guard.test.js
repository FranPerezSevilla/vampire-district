import test from "node:test";
import assert from "node:assert/strict";

const { PoliceSystem } = await import("../phaser/src/systems/PoliceSystem.js");

// Replace the lower-level selector before loading the guard so the test isolates
// only the sight-versus-sound decision and its wanted-level fallback ranges.
PoliceSystem.prototype.targetForCop = function baseTargetSelector() {
  return "normal-selector";
};

await import("../phaser/src/ai/sensory-priority-guard.js");

test("confirmed level-two sight clears WTF and delegates to normal police selection", () => {
  const calls = [];
  const context = {
    playerVisibleToCop(_cop, sight, shadowSight) {
      calls.push({ sight, shadowSight });
      return true;
    }
  };
  let hidden = false;
  const cop = {
    soundReactionTimer: 1.2,
    chasingPlayer: false,
    ai: { intent: "investigate" },
    __nbdWtfLabel: { setVisible(value) { hidden = value === false; } }
  };

  const result = PoliceSystem.prototype.targetForCop.call(context, cop, 2);

  assert.equal(result, "normal-selector");
  assert.deepEqual(calls, [{ sight: 238, shadowSight: 100 }]);
  assert.equal(cop.soundReactionTimer, 0);
  assert.equal(cop.ai.intent, "visual-contact");
  assert.equal(hidden, true);
});

test("heard-only police remain paused when the player is not visually confirmed", () => {
  let delegated = false;
  const previous = PoliceSystem.prototype.targetForCop;
  // The installed wrapper delegates to the captured base selector only on sight;
  // a false query must return before that lower selector is reached.
  const context = {
    playerVisibleToCop() { return false; }
  };
  const cop = {
    soundReactionTimer: 0.8,
    chasingPlayer: false,
    ai: { intent: "investigate" }
  };

  const result = previous.call(context, cop, 1);
  delegated = result === "normal-selector";

  assert.equal(result, null);
  assert.equal(delegated, false);
  assert.equal(cop.soundReactionTimer, 0.8);
  assert.equal(cop.ai.intent, "investigate");
});
