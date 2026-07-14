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

function insertAfter(label, anchor, insertion) {
  if (code.includes(insertion.trim().slice(0, 90))) {
    console.log(`Already present: ${label}`);
    return false;
  }
  const index = code.indexOf(anchor);
  if (index < 0) {
    console.warn(`Skipped: ${label}`);
    return false;
  }
  const pos = index + anchor.length;
  code = code.slice(0, pos) + insertion + code.slice(pos);
  changed = true;
  console.log(`Inserted: ${label}`);
  return true;
}

// Keep old calls compatible with the newer overlay renderer.
replace(
  "robust openInteractionMenu",
  /function openInteractionMenu\(actions\) \{[\s\S]*?\n    \}\n\n    function closeInteractionMenu\(\) \{/, 
  `function openInteractionMenu(actions) {
      if (!actions || actions.length <= 1) return false;
      const options = actions.map(a => ({
        label: a.label || "Interact",
        detail: a.detail || "",
        run: a.run
      }));
      state.interactionMenu = { options, actions: options, index: 0 };
      window.VD_GAME_PAUSED = true;
      say("Choose an action. W/S or arrows select, E/Enter confirms, Esc cancels.", 2.0);
      return true;
    }

    function closeInteractionMenu() {`
);

replace(
  "robust updateInteractionMenu",
  /function updateInteractionMenu\(\) \{[\s\S]*?\n    \}\n\n    function collectAvailableActions\(\) \{/, 
  `function updateInteractionMenu() {
      const menu = state.interactionMenu;
      if (!menu) return;
      const options = menu.options || menu.actions || [];
      if (!options.length) {
        closeInteractionMenu();
        return;
      }
      if (consumePressed("escape") || consumePressed("backspace")) {
        closeInteractionMenu();
        say("Interaction cancelled.", 1.2);
        return;
      }
      if (consumePressed("arrowup") || consumePressed("w")) {
        menu.index = (menu.index + options.length - 1) % options.length;
        return;
      }
      if (consumePressed("arrowdown") || consumePressed("s")) {
        menu.index = (menu.index + 1) % options.length;
        return;
      }
      for (let i = 0; i < options.length; i++) {
        if (consumePressed(String(i + 1))) {
          const selected = options[i];
          closeInteractionMenu();
          if (selected && typeof selected.run === "function") selected.run();
          return;
        }
      }
      if (consumePressed("enter") || consumePressed("e") || consumePressed(" ")) {
        const selected = options[menu.index];
        closeInteractionMenu();
        if (selected && typeof selected.run === "function") selected.run();
      }
    }

    function collectAvailableActions() {`
);

// The refuge is no longer an action you enter. It is a physical safe roof zone.
replace(
  "skip passive refuge action",
  /for \(const it of nearbyInteractables\(\)\) \{\n        if \(typeof it\.action === "function"\) actions\.push\(\{ label: actionLabelFromInteractable\(it\), run: \(\) => it\.action\(\) \}\);\n      \}/,
  `for (const it of nearbyInteractables()) {
        if (it.id === "safehouseDoor") continue;
        if (typeof it.action === "function") actions.push({ label: actionLabelFromInteractable(it), run: () => it.action() });
      }`
);

replace(
  "skip passive refuge option",
  /for \(const it of nearbyInteractables\(\)\) \{\n        if \(typeof it\.action !== "function"\) continue;\n        const prompt = typeof it\.prompt === "function" \? it\.prompt\(\) : it\.prompt;\n        options\.push\(interactionOption\(actionLabelFromPrompt\(prompt \|\| it\.label\), \(\) => it\.action\(\), it\.label \|\| "route"\)\);\n      \}/,
  `for (const it of nearbyInteractables()) {
        if (it.id === "safehouseDoor") continue;
        if (typeof it.action !== "function") continue;
        const prompt = typeof it.prompt === "function" ? it.prompt() : it.prompt;
        options.push(interactionOption(actionLabelFromPrompt(prompt || it.label), () => it.action(), it.label || "route"));
      }`
);

// Make the overlay tolerate either the old {actions} or the new {options} shape.
replace(
  "overlay supports actions or options",
  /function drawInteractionMenuOverlay\(\) \{\n      const menu = state\.interactionMenu;\n      if \(!menu \|\| !menu\.options\.length\) return;\n      const w = Math\.min\(420, VIEW_W - 24\);\n      const rowH = 18;\n      const h = 54 \+ menu\.options\.length \* rowH;/,
  `function drawInteractionMenuOverlay() {
      const menu = state.interactionMenu;
      if (!menu) return;
      const options = menu.options || menu.actions || [];
      if (!options.length) return;
      const w = Math.min(420, VIEW_W - 24);
      const rowH = 18;
      const h = 54 + options.length * rowH;`
);

replace(
  "overlay loops options variable",
  /for \(let i = 0; i < menu\.options\.length; i\+\+\) \{\n        const option = menu\.options\[i\];/,
  `for (let i = 0; i < options.length; i++) {
        const option = options[i];`
);

// Make any accidental old interior flag harmless on rooftops.
insertAfter(
  "normalize rooftop refuge state in update",
  `function update(dt) {\n`,
  `      if (player.inSafehouse && player.layer > LAYER.STREET) player.inSafehouse = false;\n`
);

// Passive prompt instead of a fake interactable action.
replace(
  "contextual prompt for rooftop refuge",
  /const it = nearbyInteractable\(\);\n      if \(it\) return typeof it\.prompt === "function" \? it\.prompt\(\) : it\.prompt;\n      return "";/,
  `const it = nearbyInteractable();
      if (it && it.id === "safehouseDoor") return "Rooftop refuge: safe terrace. Use ladders, fire escapes or jumps to leave.";
      if (it) return typeof it.prompt === "function" ? it.prompt() : it.prompt;
      return "";`
);

if (!changed) {
  console.log("No changes made.");
  process.exit(0);
}

fs.writeFileSync(file, code);
console.log("Refuge unfreeze patch applied.");
