import fs from "node:fs";

const file = "js/game.js";
let code = fs.readFileSync(file, "utf8");
let changed = false;

function replace(label, pattern, replacement) {
  const next = code.replace(pattern, replacement);
  if (next === code) {
    console.warn(`Skipped: ${label}`);
    return false;
  }
  code = next;
  changed = true;
  console.log(`Patched: ${label}`);
  return true;
}

// The rooftop/refuge/menu patch accidentally left an old canvas renderer call in render().
// The real menu renderer is drawInteractionMenuOverlay(), defined at top level.
replace(
  "remove stale drawInteractionMenu render call",
  /\n      drawBeastOverlay\(\);\n      drawInteractionMenu\(\);\n      \/\/ Legacy canvas help removed\. DOM help is handled by js\/help-overlay\.js\.\n      drawMissionSummaryOverlay\(\);\n      drawInteractionMenuOverlay\(\);/,
  `
      drawBeastOverlay();
      // Legacy canvas help removed. DOM help is handled by js/help-overlay.js.
      drawMissionSummaryOverlay();
      drawInteractionMenuOverlay();`
);

// The file currently contains both the old menu updater and the new option-based updater.
// The old one expects menu.actions, while the new modal stores menu.options.
replace(
  "use new interaction menu input updater",
  /\n      if \(state\.interactionMenu\) \{\n        updateInteractionMenu\(\);\n        updateEffects\(dt\);\n        updateCinematic\(dt\);\n        updateCamera\(\);\n        return;\n      \}\n      if \(state\.interactionMenu\) \{\n        updateInteractionMenuInput\(\);\n        updateEffects\(dt\);\n        updateCinematic\(dt\);\n        updateCamera\(\);\n        return;\n      \}/,
  `
      if (state.interactionMenu) {
        updateInteractionMenuInput();
        updateEffects(dt);
        updateCinematic(dt);
        updateCamera();
        return;
      }`
);

// Make the action label cleanup robust; one patch accidentally wrote /^E:s*/ instead of /^E:\\s*/.
replace(
  "fix action label regex",
  /return String\(prompt \|\| "Interact"\)\.replace\(\/\^E:s\*\/i, ""\);/,
  `return String(prompt || "Interact").replace(/^E:\\s*/i, "");`
);

if (!changed) {
  console.log("No changes needed.");
} else {
  fs.writeFileSync(file, code);
}
