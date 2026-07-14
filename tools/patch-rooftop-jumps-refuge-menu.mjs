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
  code = code.slice(0, idx + anchor.length) + insertion + code.slice(idx + anchor.length);
  changed = true;
  console.log(`Inserted: ${label}`);
  return true;
}

replace(
  "start in rooftop terrace, not trapped safehouse state",
  /const player = \{\n      x: 150,\n      y: 146,[\s\S]*?lastDir: \{ x: 1, y: 0 \}\n    \};/,
  `const player = {
      x: 150,
      y: 146,
      w: 10,
      h: 12,
      layer: LAYER.ROOF_HIGH,
      inSafehouse: false,
      speed: BALANCE.playerBaseSpeed,
      hunger: BALANCE.startHunger,
      exposure: 0,
      dashCooldown: 0,
      lureCooldown: 0,
      senseCooldown: 0,
      bloodSenseTimer: 0,
      dashFlash: 0,
      beastFlash: 0,
      lastDir: { x: 1, y: 0 }
    };`
);

replace(
  "add interaction menu state",
  /lastAlert: null,\n      feedCount: 0,/,
  `lastAlert: null,
      interactionMenu: null,
      feedCount: 0,`
);

replace(
  "expand rooftop graph",
  /const roofAreas = \{[\s\S]*?\n    \};\n\n    const sewerTunnels = \[/,
  `const roofAreas = {
      [LAYER.ROOF_LOW]: [
        { id: "refugeLowerRoof", x: 92, y: 176, w: 148, h: 62, color: "#2d3045" },
        { id: "marketRoof", x: 286, y: 98, w: 118, h: 138, color: "#303246" },
        { id: "tenementRoof", x: 528, y: 98, w: 122, h: 138, color: "#2b2d42" },
        { id: "policeRoof", x: 696, y: 96, w: 162, h: 110, color: "#26344f" },
        { id: "warehouseRoof", x: 112, y: 416, w: 142, h: 86, color: "#2b2a25" },
        { id: "shopsRoof", x: 300, y: 420, w: 128, h: 98, color: "#2e233d" },
        { id: "oldBlockRoof", x: 538, y: 510, w: 118, h: 74, color: "#292538" },
        { id: "clubRoof", x: 596, y: 380, w: 158, h: 98, color: "#30263e" },
        { id: "churchRoof", x: 714, y: 444, w: 144, h: 100, color: "#2a2538" }
      ],
      [LAYER.ROOF_HIGH]: [
        { id: "refugeHighRoof", x: 96, y: 92, w: 140, h: 112, color: "#3a3a52" }
      ]
    };

    const sewerTunnels = [`
);

replace(
  "make rooftop refuge a place not a trap door",
  /\{\n        id: "safehouseDoor",[\s\S]*?\n      \},\n      \{\n        id: "clubDoor",/,
  `{
        id: "safehouseDoor",
        label: "Rooftop refuge",
        layer: LAYER.ROOF_HIGH,
        x: 150, y: 146, r: 34,
        prompt: () => state.mission >= 7 ? "E: report back at the rooftop refuge" : "Rooftop refuge: safe terrace above the district",
        action: () => {
          player.inSafehouse = false;
          player.layer = LAYER.ROOF_HIGH;
          if (state.mission >= 7 && activeAlarmedWitnesses().length === 0) {
            say("You are back on your roof. The clan can receive the report here.", 3);
          } else {
            say("This is your rooftop refuge: safe height, clear view, no street patrols. Use fire escapes or jumps to move.", 4);
          }
        }
      },
      {
        id: "clubDoor",`
);

replace(
  "private sewer tunnel returns to rooftop refuge",
  /\{\n        id: "sewerOutHome",[\s\S]*?\n      \},\n      \{\n        id: "fireEscape",/,
  `{
        id: "sewerOutHome",
        label: "Tunnel to rooftop refuge",
        layer: LAYER.SEWER,
        x: 176, y: 180, r: 26,
        prompt: () => "E: climb the private shaft to the rooftop refuge",
        action: () => {
          cleanBloodAround(player.x, player.y, LAYER.SEWER, 120, "The sewer water washes away nearby stains.");
          player.layer = LAYER.ROOF_HIGH;
          player.inSafehouse = false;
          player.x = 150; player.y = 146;
          say("You climb a private service shaft and emerge onto your rooftop refuge.", 3);
        }
      },
      {
        id: "fireEscape",`
);

insertAfter(
  "rooftop refuge helper",
  `function targetBodyHidden() {
      const t = targetNpc();
      return Boolean(t && t.dead && t.hiddenBody);
    }
`,
  `

    function atRooftopRefuge() {
      return player.layer === LAYER.ROOF_HIGH && pointInRect(player.x, player.y, { x: 96, y: 92, w: 140, h: 112 });
    }
`
);

replace(
  "complete mission at rooftop refuge",
  /if \(state\.mission === 7 && player\.inSafehouse && activeAlarmedWitnesses\(\)\.length === 0\) \{/,
  `if (state.mission === 7 && atRooftopRefuge() && activeAlarmedWitnesses().length === 0) {`
);

replace(
  "current detection names rooftop refuge",
  /if \(player\.inSafehouse\) return \{ text: "safehouse", kind: "hidden" \};/,
  `if (atRooftopRefuge()) return { text: "rooftop refuge", kind: "hidden" };
      if (player.inSafehouse) return { text: "safehouse", kind: "hidden" };`
);

insertAfter(
  "multi roof fire escapes and jumps",
  `addRooftopDrop("dropClubEast", LAYER.ROOF_LOW, 754, 430, 770, 430, "east club roof");
`,
  `

    function addFireEscapePair(id, streetX, streetY, roofLayer, roofX, roofY, name) {
      interactables.push({
        id: id + "Up",
        label: name + " fire escape",
        layer: LAYER.STREET,
        x: streetX, y: streetY, r: 26,
        prompt: () => "E: climb fire escape to " + name,
        action: () => {
          player.inSafehouse = false;
          player.layer = roofLayer;
          player.x = roofX; player.y = roofY;
          say("You climb the fire escape onto " + name + ".", 3);
        }
      });
      interactables.push({
        id: id + "Down",
        label: name + " fire escape down",
        layer: roofLayer,
        x: roofX, y: roofY, r: 24,
        prompt: () => "E: climb down from " + name,
        action: () => {
          player.inSafehouse = false;
          player.layer = LAYER.STREET;
          player.x = streetX; player.y = streetY;
          say("You climb down from " + name + " to street level.", 3);
        }
      });
    }

    function addRoofJumpPair(id, aLayer, ax, ay, bLayer, bx, by, nameAB, nameBA) {
      interactables.push({
        id: id + "A",
        label: "Jump: " + nameAB,
        layer: aLayer,
        x: ax, y: ay, r: 25,
        prompt: () => "E: jump to " + nameAB,
        action: () => roofJumpTo(aLayer, ax, ay, bLayer, bx, by, nameAB)
      });
      interactables.push({
        id: id + "B",
        label: "Jump: " + nameBA,
        layer: bLayer,
        x: bx, y: by, r: 25,
        prompt: () => "E: jump to " + nameBA,
        action: () => roofJumpTo(bLayer, bx, by, aLayer, ax, ay, nameBA)
      });
    }

    function roofJumpTo(fromLayer, fromX, fromY, toLayer, toX, toY, label) {
      const sx = player.x, sy = player.y;
      player.inSafehouse = false;
      addFxTrail(sx, sy, toX, toY, fromLayer, "jump", 0.42);
      addFxBurst(sx, sy, fromLayer, "land", 10, 0.22);
      startCinematic("jump", toX, toY, toLayer, {
        startX: sx, startY: sy, endX: toX, endY: toY,
        startLayer: fromLayer, endLayer: toLayer,
        movePlayer: true, duration: 0.86, zoom: 0.30,
        lift: fromLayer === LAYER.ROOF_HIGH || toLayer === LAYER.ROOF_HIGH ? 26 : 18,
        airScale: 1.02, anticipation: 0.20, anticipationBack: 7,
        anticipationSquash: 0.14, landAt: 0.84, freeze: 0.07,
        landingBurstSize: 18, landingShake: 0.14
      });
      AudioBus.play("rooftopJump");
      createNoise((sx + toX) / 2, (sy + toY) / 2, fromLayer, 64, 2.1, "drop", { exposure: false });
      say("You leap across to " + label + ".", 2.5);
    }

    // Fire escapes: every main building has a vertical route.
    addFireEscapePair("refugeFireEscape", 176, 244, LAYER.ROOF_LOW, 166, 206, "the refuge lower roof");
    addFireEscapePair("marketFireEscape", 345, 252, LAYER.ROOF_LOW, 345, 236, "the market block roof");
    addFireEscapePair("tenementFireEscape", 528, 244, LAYER.ROOF_LOW, 586, 236, "the north tenement roof");
    addFireEscapePair("policeFireEscape", 780, 214, LAYER.ROOF_LOW, 770, 206, "the police station roof");
    addFireEscapePair("warehouseFireEscape", 176, 400, LAYER.ROOF_LOW, 176, 420, "the warehouse roof");
    addFireEscapePair("shopsFireEscape", 360, 408, LAYER.ROOF_LOW, 360, 424, "the shop roof");
    addFireEscapePair("oldBlockFireEscape", 596, 596, LAYER.ROOF_LOW, 596, 575, "the old block roof");
    addFireEscapePair("clubFireEscape", 675, 500, LAYER.ROOF_LOW, 675, 478, "the club roof");
    addFireEscapePair("churchFireEscape", 742, 556, LAYER.ROOF_LOW, 742, 545, "the church roof");

    // Rooftop jumps: the roof layer now has a navigable network, not isolated islands.
    addRoofJumpPair("jumpRefugeMarket", LAYER.ROOF_HIGH, 236, 146, LAYER.ROOF_LOW, 286, 168, "the market roof", "the refuge high roof");
    addRoofJumpPair("jumpRefugeLowMarket", LAYER.ROOF_LOW, 240, 206, LAYER.ROOF_LOW, 286, 208, "the market roof", "the lower refuge roof");
    addRoofJumpPair("jumpMarketTenement", LAYER.ROOF_LOW, 404, 168, LAYER.ROOF_LOW, 528, 168, "the north tenement roof", "the market roof");
    addRoofJumpPair("jumpTenementPolice", LAYER.ROOF_LOW, 650, 166, LAYER.ROOF_LOW, 696, 154, "the police station roof", "the north tenement roof");
    addRoofJumpPair("jumpShopsWarehouse", LAYER.ROOF_LOW, 300, 468, LAYER.ROOF_LOW, 254, 456, "the warehouse roof", "the shop roof");
    addRoofJumpPair("jumpShopsOldBlock", LAYER.ROOF_LOW, 428, 468, LAYER.ROOF_LOW, 538, 548, "the old block roof", "the shop roof");
    addRoofJumpPair("jumpClubChurch", LAYER.ROOF_LOW, 754, 430, LAYER.ROOF_LOW, 714, 490, "the church roof", "the club roof");
`
);

insertAfter(
  "interaction menu helpers",
  `function nearbyInteractable() {
      let best = null;
      let bestD = Infinity;
      for (const it of interactables) {
        if (it.layer !== player.layer) continue;
        const d = Math.hypot(it.x - player.x, it.y - player.y);
        if (d < it.r && d < bestD) { best = it; bestD = d; }
      }
      return best;
    }
`,
  `

    function nearbyInteractables() {
      return interactables
        .filter(it => it.layer === player.layer && Math.hypot(it.x - player.x, it.y - player.y) < it.r)
        .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    }

    function actionLabelFromInteractable(it) {
      if (!it) return "Interact";
      if (typeof it.prompt === "function") return it.prompt().replace(/^E:\\s*/i, "");
      return String(it.prompt || it.label || "Interact").replace(/^E:\\s*/i, "");
    }
`
);

insertAfter(
  "interaction menu engine",
  `function consumePressed(key) {
      if (pressed[key]) { pressed[key] = false; return true; }
      return false;
    }
`,
  `

    function openInteractionMenu(actions) {
      if (!actions || actions.length <= 1) return false;
      state.interactionMenu = { actions, index: 0 };
      window.VD_GAME_PAUSED = true;
      say("Choose an action.", 1.2);
      return true;
    }

    function closeInteractionMenu() {
      state.interactionMenu = null;
      window.VD_GAME_PAUSED = Boolean(window.VD_HELP_OPEN || window.VD_FEEDBACK_OPEN);
    }

    function updateInteractionMenu() {
      const menu = state.interactionMenu;
      if (!menu) return;
      if (consumePressed("escape")) {
        closeInteractionMenu();
        return;
      }
      if (consumePressed("arrowup") || consumePressed("w")) {
        menu.index = (menu.index + menu.actions.length - 1) % menu.actions.length;
        return;
      }
      if (consumePressed("arrowdown") || consumePressed("s")) {
        menu.index = (menu.index + 1) % menu.actions.length;
        return;
      }
      if (consumePressed("enter") || consumePressed("e") || consumePressed(" ")) {
        const selected = menu.actions[menu.index];
        closeInteractionMenu();
        if (selected && typeof selected.run === "function") selected.run();
      }
    }

    function collectAvailableActions() {
      const actions = [];
      const hostile = nearestHostilePedestrian();
      if (hostile) actions.push({ label: "Shove hostile pedestrian", run: () => shoveHostilePedestrian(hostile) });
      if (state.feeding) return [{ label: "Cancel feeding", run: () => cancelFeeding("You cancel feeding.") }];
      if (state.draggingBody) {
        const spot = currentBodyHideSpot();
        if (spot) actions.push({ label: "Hide body in " + spot.name, run: () => hideDraggedBody() });
        actions.push({ label: "Drop body", run: () => dropDraggedBody() });
        return actions;
      }
      const alarmed = nearestAlarmedWitness();
      if (alarmed) actions.push({ label: "Intercept fleeing witness", run: () => interceptWitness(alarmed) });
      const victim = nearestFeedable();
      if (victim) actions.push({ label: victim.type === "target" ? "Eliminate journalist" : victim.type === "rat" ? "Feed on rat" : "Drain civilian", run: () => startFeeding(victim) });
      const body = nearestBody();
      if (body) actions.push({ label: "Drag body", run: () => grabBody(body) });
      const lamp = nearestBreakableLight();
      if (lamp) actions.push({ label: "Break " + lamp.name, run: () => breakLight(lamp) });
      for (const it of nearbyInteractables()) {
        if (typeof it.action === "function") actions.push({ label: actionLabelFromInteractable(it), run: () => it.action() });
      }
      return actions;
    }
`
);

replace(
  "handle action through chooser",
  /function handleAction\(\) \{[\s\S]*?\n    \}\n\n    function currentBodyHideSpot\(\) \{/,
  `function handleAction() {
      const actions = collectAvailableActions();
      if (actions.length > 1) {
        openInteractionMenu(actions);
        return;
      }
      if (actions.length === 1) {
        actions[0].run();
        return;
      }
      say("There is nothing to interact with here.", 1.4);
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
        updateInteractionMenu();
        updateEffects(dt);
        updateCinematic(dt);
        updateCamera();
        return;
      }`
);

insertAfter(
  "draw interaction menu function",
  `function drawMissionSummaryOverlay() {`,
  `
      // placeholder anchor kept by patcher
`
);

// The previous insertion puts a harmless comment at the start of drawMissionSummaryOverlay.
// Now add the actual drawing function before the mission summary.
insertAfter(
  "draw interaction menu before summary",
  `    }

    function drawMissionSummaryOverlay() {`,
  `

    function drawInteractionMenu() {
      const menu = state.interactionMenu;
      if (!menu) return;
      const w = Math.min(280, VIEW_W - 28);
      const rowH = 18;
      const h = 34 + menu.actions.length * rowH;
      const x = Math.floor(VIEW_W / 2 - w / 2);
      const y = Math.floor(VIEW_H / 2 - h / 2);
      ctx.fillStyle = "rgba(0,0,0,.62)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "rgba(8,8,16,.96)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#d7c8ff";
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = "#f1e6ff";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.fillText("Choose action", x + 10, y + 18);
      for (let i = 0; i < menu.actions.length; i++) {
        const rowY = y + 30 + i * rowH;
        const selected = i === menu.index;
        ctx.fillStyle = selected ? "rgba(167,92,255,.35)" : "rgba(255,255,255,.04)";
        ctx.fillRect(x + 8, rowY - 11, w - 16, rowH - 2);
        ctx.fillStyle = selected ? "#fff2a8" : "#d7c8ff";
        ctx.fillText((selected ? "> " : "  ") + menu.actions[i].label.slice(0, 34), x + 14, rowY);
      }
      ctx.fillStyle = "rgba(215,200,255,.58)";
      ctx.font = "8px monospace";
      ctx.fillText("W/S or arrows · E/Enter confirm · Esc cancel", x + 10, y + h - 7);
    }
`
);

replace(
  "render interaction menu",
  /drawBeastOverlay\(\);\n      \/\/ Legacy canvas help removed\. DOM help is handled by js\/help-overlay\.js\.\n      drawMissionSummaryOverlay\(\);/,
  `drawBeastOverlay();
      drawInteractionMenu();
      // Legacy canvas help removed. DOM help is handled by js/help-overlay.js.
      drawMissionSummaryOverlay();`
);

replace(
  "nearby route labels include dynamic vertical routes",
  /if \(\["safehouseDoor", "sewerIn", "fireEscape", "roofDrop", "fireEscapeDown", "toHighRoof", "fromHighRoof", "sewerOutHome", "sewerOutMain"\]\.includes\(it\.id\)\) \{/,
  `if (["safehouseDoor", "sewerIn", "fireEscape", "roofDrop", "fireEscapeDown", "toHighRoof", "fromHighRoof", "sewerOutHome", "sewerOutMain"].includes(it.id) || /FireEscape|drop|jump/i.test(it.id)) {`
);

fs.writeFileSync(file, code);
if (!changed) {
  console.log("No changes applied; patch may already be present.");
} else {
  console.log("Rooftop jumps, refuge cleanup and interaction menu patch applied.");
}
