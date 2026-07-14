import fs from "node:fs";

const file = "js/game.js";
let code = fs.readFileSync(file, "utf8");
let changed = false;

function patch(label, pattern, replacement) {
  const next = code.replace(pattern, replacement);
  if (next === code) {
    console.warn(`Skipped: ${label}`);
    return;
  }
  code = next;
  changed = true;
  console.log(`Patched: ${label}`);
}

patch(
  "safehouse collision guard",
  `      if (layer === LAYER.STREET) {
        if (inSafehouse) {
          const home = buildings.find(b => b.id === "safehouse");
          return rectsOverlap(r, { x: home.x + 12, y: home.y + 12, w: home.w - 24, h: home.h - 24 });
        }
        return !buildings.some(b => rectsOverlap(r, b));
      }`,
  `      if (layer === LAYER.STREET) {
        if (inSafehouse) {
          // Older builds had a street-level safehouse interior. The redesign moved the refuge to a high roof,
          // so after rooftop drops the player can briefly be on STREET with inSafehouse still true.
          // In that case, do not crash or trap movement: fall back to normal street collision.
          const home = buildings.find(b => b.id === "safehouse");
          if (home) return rectsOverlap(r, { x: home.x + 12, y: home.y + 12, w: home.w - 24, h: home.h - 24 });
        }
        return !buildings.some(b => rectsOverlap(r, b));
      }`
);

patch(
  "roof area collision guard",
  `      if (layer === LAYER.ROOF_LOW || layer === LAYER.ROOF_HIGH) {
        return roofAreas[layer].some(a => rectsOverlap(r, a));
      }`,
  `      if (layer === LAYER.ROOF_LOW || layer === LAYER.ROOF_HIGH) {
        const areas = roofAreas[layer] || [];
        return areas.some(a => rectsOverlap(r, a));
      }`
);

patch(
  "drop clears safehouse flag",
  `          const ex = targetX, ey = targetY;
          addFxTrail(sx, sy, ex, ey, LAYER.STREET, "drop", 0.44);`,
  `          const ex = targetX, ey = targetY;
          player.inSafehouse = false;
          addFxTrail(sx, sy, ex, ey, LAYER.STREET, "drop", 0.44);`
);

if (!changed) {
  console.log("No changes needed.");
} else {
  fs.writeFileSync(file, code);
  console.log("Movement guard patch applied.");
}
