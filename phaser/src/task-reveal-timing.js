const TASK_REVEAL_HOLD_MS = 4500;
const ORIGINAL_TASK_REVEAL_HOLD_MS = 2150;

const clockPrototype = Phaser.Time?.Clock?.prototype;

if (clockPrototype && !clockPrototype.__nbdLongTaskRevealPatch) {
  const originalDelayedCall = clockPrototype.delayedCall;

  clockPrototype.delayedCall = function delayedCallWithLongerTaskReveal(delay, ...args) {
    const sceneKey = this.scene?.sys?.settings?.key;
    const adjustedDelay = sceneKey === "GameScene" && delay === ORIGINAL_TASK_REVEAL_HOLD_MS
      ? TASK_REVEAL_HOLD_MS
      : delay;

    return originalDelayedCall.call(this, adjustedDelay, ...args);
  };

  clockPrototype.__nbdLongTaskRevealPatch = true;
}
