import fs from "node:fs";

const FILE = "js/game.js";
let src = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceOnce(search, replacement, label) {
  if (!src.includes(search)) {
    console.log(`Patch skipped: ${label}`);
    return;
  }
  src = src.replace(search, replacement);
  changed = true;
  console.log(`Patched: ${label}`);
}

replaceOnce(
  `      play(name, intensity = 1) {\n        if (!this.enabled) return;`,
  `      play(name, intensity = 1) {\n        // Kenney/repo asset audio replaces the procedural hardcoded event sounds.\n        // When the asset runtime is loaded, do not fall back to procedural tones/noise.\n        if (window.VD_ASSET_AUDIO) {\n          window.VD_ASSET_AUDIO.play(name, intensity);\n          return;\n        }\n        if (!this.enabled) return;`,
  "route AudioBus.play through asset runtime"
);

replaceOnce(
  `      drawHelpOverlay();\n      drawMissionSummaryOverlay();`,
  `      // Legacy canvas help disabled. DOM pause/help overlay owns help UI now.\n      drawMissionSummaryOverlay();`,
  "disable legacy canvas help draw"
);

if (changed) {
  fs.writeFileSync(FILE, src, "utf8");
} else {
  console.log("No game.js changes needed.");
}
