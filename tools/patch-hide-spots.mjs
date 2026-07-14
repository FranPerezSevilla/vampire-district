import fs from "node:fs";

const file = "js/game.js";
let src = fs.readFileSync(file, "utf8");

const before = `    function drawBodyHideSpots() {
      if (player.layer !== LAYER.STREET || player.inSafehouse) return;
      const shouldEmphasize = Boolean(state.draggingBody) || npcs.some(n => n.dead && !n.hiddenBody && n.layer === player.layer);
      for (const s of bodyHideSpots) {
        if (s.layer !== player.layer) continue;
        const near = Math.hypot(player.x - s.x, player.y - s.y) < s.r;
        const alpha = shouldEmphasize || near ? 0.30 : 0.11;
        ctx.beginPath();`;

const after = `    function drawBodyHideSpots() {
      if (player.layer !== LAYER.STREET || player.inSafehouse) return;

      // Hide spots should only appear when the player actually has evidence to hide.
      // Otherwise they read as generic interactables and add noise to exploration.
      const hasBodyToHide = Boolean(state.draggingBody) || npcs.some(n => n.dead && !n.hiddenBody && n.layer === player.layer);
      if (!hasBodyToHide) return;

      for (const s of bodyHideSpots) {
        if (s.layer !== player.layer) continue;
        const near = Math.hypot(player.x - s.x, player.y - s.y) < s.r;
        const alpha = near ? 0.30 : 0.11;
        ctx.beginPath();`;

if (!src.includes(before)) {
  console.error("Could not find drawBodyHideSpots block to patch.");
  process.exit(1);
}

src = src.replace(before, after);

src = src.replace(
  `        if (near || shouldEmphasize) {\n          ctx.font = "8px monospace";\n          ctx.fillStyle = near ? "#d7ffec" : "rgba(215,255,236,.50)";\n          ctx.fillText("HIDE", Math.floor(s.x + 8), Math.floor(s.y - 8));\n        }`,
  `        if (near) {\n          ctx.font = "8px monospace";\n          ctx.fillStyle = "#d7ffec";\n          ctx.fillText("HIDE", Math.floor(s.x + 8), Math.floor(s.y - 8));\n        }`
);

fs.writeFileSync(file, src, "utf8");
console.log("Patched hide spots visibility: only when a body needs hiding.");
