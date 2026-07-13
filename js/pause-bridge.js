// Shared pause bridge for the canvas game.
// It freezes requestAnimationFrame timestamps while a modal/system pause flag is active.
// This lets the vanilla game loop keep rendering without advancing simulation time.
(() => {
  "use strict";

  if (window.__VD_PAUSE_BRIDGE_INSTALLED) return;
  window.__VD_PAUSE_BRIDGE_INSTALLED = true;

  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

  let wasPaused = false;
  let frozenTimestamp = 0;
  let pauseOffset = 0;

  window.VD_FEEDBACK_OPEN = Boolean(window.VD_FEEDBACK_OPEN);
  window.VD_GAME_PAUSED = Boolean(window.VD_GAME_PAUSED);

  function isPaused() {
    return Boolean(window.VD_GAME_PAUSED || window.VD_FEEDBACK_OPEN);
  }

  window.VD_IS_GAME_PAUSED = isPaused;

  window.requestAnimationFrame = function requestAnimationFramePaused(callback) {
    return nativeRequestAnimationFrame((realTimestamp) => {
      const paused = isPaused();

      if (paused) {
        if (!wasPaused) {
          frozenTimestamp = realTimestamp - pauseOffset;
          wasPaused = true;
        }
        callback(frozenTimestamp);
        return;
      }

      if (wasPaused) {
        // Keep virtual game time continuous after closing the modal.
        pauseOffset = realTimestamp - frozenTimestamp;
        wasPaused = false;
      }

      callback(realTimestamp - pauseOffset);
    });
  };

  window.cancelAnimationFrame = nativeCancelAnimationFrame;
})();
