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

replace(
  "full district zoom on high rooftops",
  /function resizeGameCanvas\(\) \{[\s\S]*?\n    \}/,
  `function resizeGameCanvas() {
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      const hasPlayer = typeof player !== "undefined";
      const panoramic = hasPlayer && player.layer === LAYER.ROOF_HIGH;

      if (panoramic) {
        // High rooftops are strategic viewpoints: show the whole district.
        VIEW_W = WORLD_W;
        VIEW_H = WORLD_H;
      } else {
        // Street and low rooftops stay close for tension and readability.
        const pixelScale = rect.width < 700 ? 3.55 : 3.25;
        VIEW_W = Math.max(300, Math.floor(rect.width / pixelScale));
        VIEW_H = Math.max(150, Math.floor(rect.height / pixelScale));
      }

      if (canvas.width !== VIEW_W || canvas.height !== VIEW_H) {
        canvas.width = VIEW_W;
        canvas.height = VIEW_H;
        ctx.imageSmoothingEnabled = false;
      }
      updateCamera();
    }`
);

if (!code.includes("function addRooftopDrop(")) {
  replace(
    "add lateral rooftop drops",
    /\n    \];\n\n    \/\/ ---------------------------------------------------------\n    \/\/ 06\. NPC DATA/,
    `
    ];

    function addRooftopDrop(id, layer, x, y, targetX, targetY, sideName) {
      interactables.push({
        id,
        label: "Rooftop drop",
        layer,
        x, y, r: 26,
        prompt: () => "E: jump down to street (" + sideName + ")",
        action: () => {
          const sx = player.x, sy = player.y;
          const ex = targetX, ey = targetY;
          addFxTrail(sx, sy, ex, ey, LAYER.STREET, "drop", 0.44);
          addFxBurst(sx, sy, layer, "drop", 12, 0.24);
          startCinematic("drop", ex, ey, LAYER.STREET, {
            startX: sx, startY: sy, endX: ex, endY: ey,
            startLayer: layer, endLayer: LAYER.STREET,
            movePlayer: true, duration: 0.98, zoom: 0.42,
            lift: layer === LAYER.ROOF_HIGH ? 42 : 30,
            airScale: layer === LAYER.ROOF_HIGH ? 1.18 : 1.10,
            anticipation: 0.20, anticipationBack: 7, anticipationSquash: 0.15,
            landAt: 0.86, freeze: 0.08,
            landingBurstSize: layer === LAYER.ROOF_HIGH ? 34 : 26,
            landingShake: layer === LAYER.ROOF_HIGH ? 0.42 : 0.30,
            landingBurstStyle: "drop", dust: true
          });
          AudioBus.play("roofDrop");
          createNoise(ex, ey, LAYER.STREET, layer === LAYER.ROOF_HIGH ? 140 : 112, 3.8, "drop", { exposure: false });
          addExposure(publicWitnesses(115) > 0 ? 3 : 0, "Someone sees an impossible fall from a rooftop.");
          say("You drop from the " + sideName + " edge to the street below.", 3);
        }
      });
    }

    // Every walkable rooftop gets lateral street drops so the player is never trapped above.
    addRooftopDrop("dropRefugeHighNorth", LAYER.ROOF_HIGH, 150, 92, 150, 74, "north refuge");
    addRooftopDrop("dropRefugeHighSouth", LAYER.ROOF_HIGH, 150, 204, 150, 244, "south refuge");
    addRooftopDrop("dropRefugeHighWest", LAYER.ROOF_HIGH, 96, 146, 72, 150, "west refuge");
    addRooftopDrop("dropRefugeHighEast", LAYER.ROOF_HIGH, 236, 146, 250, 150, "east refuge");

    addRooftopDrop("dropRefugeLowNorth", LAYER.ROOF_LOW, 166, 176, 166, 164, "north lower refuge");
    addRooftopDrop("dropRefugeLowSouth", LAYER.ROOF_LOW, 166, 238, 166, 244, "south lower refuge");
    addRooftopDrop("dropRefugeLowWest", LAYER.ROOF_LOW, 92, 206, 80, 206, "west lower refuge");
    addRooftopDrop("dropRefugeLowEast", LAYER.ROOF_LOW, 240, 206, 250, 206, "east lower refuge");

    addRooftopDrop("dropMarketNorth", LAYER.ROOF_LOW, 345, 98, 345, 78, "north market roof");
    addRooftopDrop("dropMarketSouth", LAYER.ROOF_LOW, 345, 236, 345, 252, "south market roof");
    addRooftopDrop("dropMarketWest", LAYER.ROOF_LOW, 286, 168, 268, 168, "west market roof");
    addRooftopDrop("dropMarketEast", LAYER.ROOF_LOW, 404, 168, 424, 168, "east market roof");

    addRooftopDrop("dropClubNorth", LAYER.ROOF_LOW, 675, 380, 675, 360, "north club roof");
    addRooftopDrop("dropClubSouth", LAYER.ROOF_LOW, 675, 478, 675, 500, "south club roof");
    addRooftopDrop("dropClubWest", LAYER.ROOF_LOW, 596, 430, 578, 430, "west club roof");
    addRooftopDrop("dropClubEast", LAYER.ROOF_LOW, 754, 430, 770, 430, "east club roof");

    // ---------------------------------------------------------
    // 06. NPC DATA`
  );
} else {
  console.log("Rooftop drop helper already present.");
}

if (!changed) {
  console.log("No rooftop drop changes needed.");
} else {
  fs.writeFileSync(file, code, "utf8");
  console.log("Rooftop drops and high-roof zoom patched.");
}
