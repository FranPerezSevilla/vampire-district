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
  const idx = code.indexOf(anchor);
  if (idx < 0) {
    console.warn(`Skipped: ${label}`);
    return false;
  }
  const pos = idx + anchor.length;
  code = code.slice(0, pos) + insertion + code.slice(pos);
  changed = true;
  console.log(`Inserted: ${label}`);
  return true;
}

replace(
  "add interaction menu state",
  /lampBreakChainCount: 0,/, 
  `lampBreakChainCount: 0,
       interactionMenu: null,`
);

replace(
  "expand rooftop areas for all main buildings",
  /const roofAreas = \{[\s\S]*?\n    \};\n\n    const sewerTunnels = \[/,
  `const roofAreas = {
      [LAYER.ROOF_LOW]: [
        { id: "refugeLowerRoof", x: 92, y: 176, w: 148, h: 62, color: "#2d3045" },
        { id: "marketRoof", x: 286, y: 98, w: 118, h: 138, color: "#303246" },
        { id: "tenementNorthRoof", x: 532, y: 98, w: 114, h: 136, color: "#303246" },
        { id: "policeRoof", x: 696, y: 94, w: 166, h: 110, color: "#263b5c" },
        { id: "warehouseRoof", x: 112, y: 416, w: 142, h: 86, color: "#2e2a22" },
        { id: "shopsRoof", x: 300, y: 420, w: 128, h: 98, color: "#30263e" },
        { id: "oldBlockRoof", x: 538, y: 510, w: 118, h: 74, color: "#282536" },
        { id: "clubRoof", x: 596, y: 380, w: 158, h: 98, color: "#30263e" },
        { id: "churchRoof", x: 714, y: 444, w: 144, h: 100, color: "#2a2636" }
      ],
      [LAYER.ROOF_HIGH]: [
        { id: "refugeHighRoof", x: 96, y: 92, w: 140, h: 112, color: "#3a3a52" }
      ]
    };

    const sewerTunnels = [`
);

replace(
  "fix rooftop refuge interaction",
  /\{\n        id: "safehouseDoor",[\s\S]*?\n      \},\n      \{\n        id: "clubDoor",/,
  `{
        id: "safehouseDoor",
        label: "Rooftop refuge",
        layer: LAYER.ROOF_HIGH,
        x: 150, y: 146, r: 30,
        prompt: () => player.inSafehouse ? "E: step onto refuge terrace" : "E: enter rooftop refuge",
        action: () => {
          if (player.inSafehouse) {
            player.inSafehouse = false;
            player.layer = LAYER.ROOF_HIGH;
            player.x = 170; player.y = 148;
            say("You step out onto the refuge terrace. Use fire escapes to descend, not the refuge door.", 4);
          } else {
            player.inSafehouse = true;
            player.layer = LAYER.ROOF_HIGH;
            player.x = 150; player.y = 146;
            say("You slip back into the rooftop refuge. The district cannot reach you here.", 4);
          }
        }
      },
      {
        id: "clubDoor",`
);

replace(
  "fix sewer tunnel to rooftop refuge",
  /\{\n        id: "sewerOutHome",[\s\S]*?\n      \},\n      \{\n        id: "fireEscape",/,
  `{
        id: "sewerOutHome",
        label: "Tunnel to rooftop refuge",
        layer: LAYER.SEWER,
        x: 176, y: 180, r: 26,
        prompt: () => "E: climb the private tunnel to the rooftop refuge",
        action: () => {
          cleanBloodAround(player.x, player.y, LAYER.SEWER, 120, "The sewer water washes away nearby stains.");
          player.layer = LAYER.ROOF_HIGH;
          player.inSafehouse = true;
          player.x = 150; player.y = 146;
          say("You climb a private vertical tunnel into the rooftop refuge.", 3);
        }
      },
      {
        id: "fireEscape",`
);

replace(
  "fix upper refuge ladder",
  /\{\n        id: "toHighRoof",[\s\S]*?\n      \},\n      \{\n        id: "fromHighRoof",/,
  `{
        id: "toHighRoof",
        label: "Refuge upper ladder",
        layer: LAYER.ROOF_LOW,
        x: 166, y: 198, r: 24,
        prompt: () => "E: climb to the high refuge terrace",
        action: () => {
          player.inSafehouse = false;
          player.layer = LAYER.ROOF_HIGH;
          player.x = 150; player.y = 146;
          say("You climb onto the high refuge terrace. The whole district opens below.", 4);
        }
      },
      {
        id: "fromHighRoof",`
);

replace(
  "fix down from high refuge ladder",
  /\{\n        id: "fromHighRoof",[\s\S]*?\n      \},\n      \{\n        id: "roofDrop",/,
  `{
        id: "fromHighRoof",
        label: "Lower refuge ladder",
        layer: LAYER.ROOF_HIGH,
        x: 150, y: 198, r: 24,
        prompt: () => "E: descend to the lower refuge roof",
        action: () => {
          player.inSafehouse = false;
          player.layer = LAYER.ROOF_LOW;
          player.x = 166; player.y = 206;
          say("You descend to the lower refuge roof. Fire escapes lead down to the street.", 3);
        }
      },
      {
        id: "roofDrop",`
);

insertAfter(
  "add fire escapes for all main buildings",
  `addRooftopDrop("dropClubEast", LAYER.ROOF_LOW, 754, 430, 770, 430, "east club roof");`,
  `

    function addFireEscape(idBase, name, streetX, streetY, roofLayer, roofX, roofY) {
      interactables.push({
        id: idBase + "Up",
        label: name + " fire escape",
        layer: LAYER.STREET,
        x: streetX, y: streetY, r: 26,
        prompt: () => "E: climb " + name + " fire escape",
        action: () => {
          player.inSafehouse = false;
          player.layer = roofLayer;
          player.x = roofX; player.y = roofY;
          say("You climb the " + name + " fire escape.", 3);
        }
      });
      interactables.push({
        id: idBase + "Down",
        label: "Descend " + name,
        layer: roofLayer,
        x: roofX, y: roofY, r: 24,
        prompt: () => "E: climb down from " + name,
        action: () => {
          player.inSafehouse = false;
          player.layer = LAYER.STREET;
          player.x = streetX; player.y = streetY;
          say("You climb down from the " + name + " fire escape.", 3);
        }
      });
    }

    // Extra fire escapes: every main building has a clear vertical route.
    addFireEscape("marketFireEscape", "market block", 268, 168, LAYER.ROOF_LOW, 345, 168);
    addFireEscape("tenementFireEscape", "north tenement", 650, 168, LAYER.ROOF_LOW, 590, 168);
    addFireEscape("policeFireEscape", "police station", 672, 170, LAYER.ROOF_LOW, 775, 150);
    addFireEscape("warehouseFireEscape", "warehouse", 92, 402, LAYER.ROOF_LOW, 180, 456);
    addFireEscape("shopsFireEscape", "shops", 438, 470, LAYER.ROOF_LOW, 360, 468);
    addFireEscape("oldBlockFireEscape", "old block", 520, 540, LAYER.ROOF_LOW, 596, 540);
    addFireEscape("clubFireEscape", "club", 578, 430, LAYER.ROOF_LOW, 675, 430);
    addFireEscape("churchFireEscape", "church", 690, 500, LAYER.ROOF_LOW, 780, 495);
`
);

insertAfter(
  "interaction menu helpers",
  `function consumePressed(key) {
      if (pressed[key]) { pressed[key] = false; return true; }
      return false;
    }
`,
  `
    function interactionOption(label, run, detail = "") {
      return { label, detail, run };
    }

    function nearbyInteractables(maxDistanceBoost = 0) {
      const found = [];
      for (const it of interactables) {
        if (it.layer !== player.layer) continue;
        const d = Math.hypot(it.x - player.x, it.y - player.y);
        if (d < it.r + maxDistanceBoost) found.push({ it, d });
      }
      return found.sort((a, b) => a.d - b.d).map(item => item.it);
    }

    function actionLabelFromPrompt(prompt) {
      return String(prompt || "Interact").replace(/^E:\s*/i, "");
    }

    function buildInteractionOptions() {
      const options = [];
      const hostile = nearestHostilePedestrian();
      if (hostile) options.push(interactionOption("Shove angry pedestrian", () => shoveHostilePedestrian(hostile), "street scuffle"));

      if (state.feeding) {
        options.push(interactionOption("Cancel feeding", () => cancelFeeding("You cancel feeding."), "release victim"));
        return options;
      }

      if (state.draggingBody) {
        const spot = currentBodyHideSpot();
        if (spot) options.push(interactionOption("Hide body", () => hideDraggedBody(), spot.name));
        options.push(interactionOption("Drop body", () => dropDraggedBody(), "leave it here"));
        return options;
      }

      const alarmed = nearestAlarmedWitness();
      if (alarmed) options.push(interactionOption("Intercept fleeing witness", () => interceptWitness(alarmed), alarmed.reportTarget ? alarmed.reportTarget.name : "before report"));

      const victim = nearestFeedable();
      if (victim) {
        const witnesses = publicWitnesses(135, victim);
        const risk = witnesses > 0 ? witnesses + " witness(es)" : "no direct witness";
        options.push(interactionOption(victim.type === "target" ? "Eliminate journalist" : victim.type === "rat" ? "Feed on rat" : "Drain civilian", () => startFeeding(victim), risk));
      }

      const body = nearestBody();
      if (body) options.push(interactionOption("Drag body", () => grabBody(body), body.type === "target" ? "journalist body" : "corpse"));

      const lamp = nearestBreakableLight();
      if (lamp) options.push(interactionOption("Break streetlight", () => breakLight(lamp), lamp.name));

      for (const it of nearbyInteractables()) {
        if (typeof it.action !== "function") continue;
        const prompt = typeof it.prompt === "function" ? it.prompt() : it.prompt;
        options.push(interactionOption(actionLabelFromPrompt(prompt || it.label), () => it.action(), it.label || "route"));
      }

      // Deduplicate identical route/action labels when old and new fire escapes overlap.
      const seen = new Set();
      return options.filter(option => {
        const key = option.label + "|" + option.detail;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function openInteractionMenu(options) {
      state.interactionMenu = { options, index: 0 };
      window.VD_GAME_PAUSED = true;
      say("Choose interaction. Arrow keys / W/S select, Enter/E confirms, Esc cancels.", 2.0);
    }

    function closeInteractionMenu() {
      state.interactionMenu = null;
      window.VD_GAME_PAUSED = Boolean(window.VD_FEEDBACK_OPEN || window.VD_HELP_OPEN);
    }

    function runInteractionOption(index = 0) {
      const menu = state.interactionMenu;
      if (!menu || !menu.options.length) return;
      const option = menu.options[clamp(index, 0, menu.options.length - 1)];
      closeInteractionMenu();
      if (option && typeof option.run === "function") option.run();
    }

    function updateInteractionMenuInput() {
      const menu = state.interactionMenu;
      if (!menu) return false;
      if (consumePressed("escape") || consumePressed("backspace")) {
        closeInteractionMenu();
        say("Interaction cancelled.", 1.2);
        return true;
      }
      if (consumePressed("arrowup") || consumePressed("w")) {
        menu.index = (menu.index - 1 + menu.options.length) % menu.options.length;
        return true;
      }
      if (consumePressed("arrowdown") || consumePressed("s")) {
        menu.index = (menu.index + 1) % menu.options.length;
        return true;
      }
      for (let i = 0; i < menu.options.length; i++) {
        if (consumePressed(String(i + 1))) {
          runInteractionOption(i);
          return true;
        }
      }
      if (consumePressed("enter") || consumePressed("e") || consumePressed(" ")) {
        runInteractionOption(menu.index);
        return true;
      }
      return true;
    }
`
);

replace(
  "handle action through interaction modal",
  /function handleAction\(\) \{[\s\S]*?\n    \}\n\n    function currentBodyHideSpot\(\) \{/, 
  `function handleAction() {
      const options = buildInteractionOptions();
      if (!options.length) {
        say("There is nothing to interact with here.", 1.4);
        return;
      }
      if (options.length === 1) {
        if (typeof options[0].run === "function") options[0].run();
        return;
      }
      openInteractionMenu(options);
    }

    function currentBodyHideSpot() {`
);

replace(
  "pause update while interaction menu open",
  /if \(state\.orderReportOpen\) \{[\s\S]*?\n        return;\n      \}/,
  `if (state.orderReportOpen) {
        if (consumePressed("enter") || consumePressed("e") || consumePressed(" ")) {
          acceptOrderReport();
        }
        updateEffects(dt);
        updateCinematic(dt);
        updateCamera();
        return;
      }
      if (state.interactionMenu) {
        updateInteractionMenuInput();
        updateEffects(dt);
        updateCinematic(dt);
        updateCamera();
        return;
      }`
);

insertAfter(
  "draw interaction menu overlay call",
  `drawMissionSummaryOverlay();`,
  `
      drawInteractionMenuOverlay();`
);

insertAfter(
  "draw interaction menu overlay function",
  `function drawHelpOverlay() {
      // Removed: help now lives in js/help-overlay.js as a DOM modal.
    }
`,
  `
    function drawInteractionMenuOverlay() {
      const menu = state.interactionMenu;
      if (!menu || !menu.options.length) return;
      const w = Math.min(420, VIEW_W - 24);
      const rowH = 18;
      const h = 54 + menu.options.length * rowH;
      const x = Math.floor(VIEW_W / 2 - w / 2);
      const y = Math.floor(VIEW_H / 2 - h / 2);
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "rgba(8,8,14,.96)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#d7c8ff";
      ctx.fillRect(x, y, w, 3);
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.fillStyle = "#f1e6ff";
      ctx.fillText("Choose interaction", x + 12, y + 22);
      ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.fillStyle = "#9d93b8";
      ctx.fillText("↑/↓ or W/S · Enter/E confirm · Esc cancel", x + 12, y + 36);
      for (let i = 0; i < menu.options.length; i++) {
        const option = menu.options[i];
        const yy = y + 54 + i * rowH;
        const active = i === menu.index;
        if (active) {
          ctx.fillStyle = "rgba(120,199,163,.18)";
          ctx.fillRect(x + 8, yy - 11, w - 16, 15);
        }
        ctx.fillStyle = active ? "#78c7a3" : "#f1e6ff";
        ctx.fillText((i + 1) + ". " + option.label, x + 14, yy);
        if (option.detail) {
          ctx.fillStyle = active ? "#d7ffec" : "#9d93b8";
          ctx.fillText(option.detail, x + Math.min(w - 130, 190), yy);
        }
      }
    }
`
);

replace(
  "interaction modal prompt",
  /if \(state\.orderReportOpen\) return "Report open: press Enter \/ E \/ Space to accept and resume free roam\.";/,
  `if (state.interactionMenu) return "Interaction menu open: choose an action or press Esc.";
      if (state.orderReportOpen) return "Report open: press Enter / E / Space to accept and resume free roam.";`
);

fs.writeFileSync(file, code);
console.log(changed ? "Vertical/interactions patch applied." : "No changes were necessary.");
