(() => {
  "use strict";

  // Prototype scope guard: keep exactly one hunter in the district.
  //
  // game.js currently creates two hidden hunters and may try to create a
  // visible hunter when exposure reaches level 3. This small guard keeps the
  // first hunter as the unique encounter, discards the second hidden hunter,
  // and converts the later spawn request into the reveal of the existing one.
  //
  // This lets us simplify the prototype without rewriting the hunter AI. When
  // threat configuration is extracted from game.js, this file can disappear.

  const originalPush = Array.prototype.push;
  let uniqueHunter = null;

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

  Array.prototype.push = function (...items) {
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

    return originalPush.apply(this, accepted);
  };
})();
