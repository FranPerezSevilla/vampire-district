(() => {
  "use strict";

  // Prototype scope guard: keep exactly one hunter in the district.
  //
  // game.js currently creates two hidden hunters and may later request a
  // visible hunter when exposure reaches level 3. This keeps the first hunter
  // as the unique encounter, discards the second hidden hunter, and converts
  // a later spawn request into the reveal of the existing one.
  //
  // This is intentionally isolated from game.js so the prototype can be
  // simplified without rewriting its large gameplay file.

  const originalPush = Array.prototype.push;
  let uniqueHunter = null;
  let restored = false;

  function isHunterNpc(value) {
    return Boolean(
      value &&
      value.type === "hunter" &&
      typeof value.x === "number" &&
      typeof value.y === "number" &&
      value.lastKnown &&
      Object.prototype.hasOwnProperty.call(value, "hiddenBody")
    );
  }

  function restoreOriginalPush() {
    if (restored) return;
    restored = true;
    if (Array.prototype.push === guardedPush) Array.prototype.push = originalPush;
  }

  function guardedPush(...items) {
    const accepted = [];

    for (const item of items) {
      if (!isHunterNpc(item)) {
        accepted[accepted.length] = item;
        continue;
      }

      if (!uniqueHunter) {
        uniqueHunter = item;
        accepted[accepted.length] = item;
        continue;
      }

      // The second predefined hunter is hidden too: remove it completely.
      if (item.hidden) continue;

      // At high exposure game.js requests a newly spawned hunter. Reveal the
      // unique existing hunter instead, so the spawn loop completes without
      // adding another enemy.
      if (!uniqueHunter.dead) {
        uniqueHunter.hidden = false;
        uniqueHunter.revealed = true;
        uniqueHunter.active = true;
        uniqueHunter.chaseTimer = Math.max(uniqueHunter.chaseTimer || 0, 2.2);
      }
    }

    const result = originalPush.apply(this, accepted);
    if (uniqueHunter && uniqueHunter.revealed && !uniqueHunter.hidden) restoreOriginalPush();
    return result;
  }

  Array.prototype.push = guardedPush;

  // The hunter can also be revealed directly by noise or blood without a new
  // spawn attempt. Stop guarding arrays as soon as that happens.
  const restoreWatcher = window.setInterval(() => {
    if (uniqueHunter && uniqueHunter.revealed && !uniqueHunter.hidden) {
      window.clearInterval(restoreWatcher);
      restoreOriginalPush();
    }
  }, 250);
})();
