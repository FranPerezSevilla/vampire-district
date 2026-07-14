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
  if (code.includes(insertion.trim().slice(0, 80))) {
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

// ---------------------------------------------------------
// Player starts in a high rooftop refuge.
// ---------------------------------------------------------
replace(
  "start player on rooftop refuge",
  /const player = \{[\s\S]*?lastDir: \{ x: 1, y: 0 \}\n    \};/,
  `const player = {
      x: 150,
      y: 146,
      w: 10,
      h: 12,
      layer: LAYER.ROOF_HIGH,
      inSafehouse: true,
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
  "initial rooftop refuge message",
  /message: "A clan courier wakes you: a journalist is preparing to expose your leader\. Press E at the door to leave\.",/,
  `message: "You wake on the rooftop refuge. Press E at the terrace exit to enter the district.",`
);

replace(
  "add lamp break chain state",
  /nextDynamicEventAt: 11,\n      dynamicEventCount: 0,/,
  `nextDynamicEventAt: 11,
      nextRatSpawnAt: 8,
      dynamicEventCount: 0,
      lampBreakWindowUntil: 0,
      lampBreakChainCount: 0,`
);

// ---------------------------------------------------------
// District geometry: two avenues, alleys, rooftop refuge, police/church anchors.
// ---------------------------------------------------------
replace(
  "redesign buildings",
  /const buildings = \[[\s\S]*?\n    \];\n\n    const roofAreas = \{/,
  `const buildings = [
      { id: "refugeTower", name: "ROOFTOP REFUGE", x: 86, y: 86, w: 150, h: 128, color: "#20122f", trim: "#d7c8ff", sign: "REFUGE" },
      { id: "club", name: "CLUB", x: 590, y: 374, w: 170, h: 112, color: "#241126", trim: "#d11fb9", sign: "CLUB" },
      { id: "church", name: "CHURCH", x: 708, y: 438, w: 156, h: 112, color: "#1b1824", trim: "#8b6f9e", sign: "CHURCH" },
      { id: "police", name: "POLICE STATION", x: 690, y: 88, w: 174, h: 122, color: "#14223a", trim: "#4da3ff", sign: "POLICE" },
      { id: "marketBlock", name: "MARKET BLOCK", x: 280, y: 92, w: 130, h: 150, color: "#181a2a", trim: "#777d99", sign: "MARKET" },
      { id: "tenementNorth", name: "TENEMENT", x: 528, y: 92, w: 122, h: 148, color: "#171827", trim: "#7f849a", sign: "FLATS" },
      { id: "warehouse", name: "WAREHOUSE", x: 106, y: 410, w: 154, h: 98, color: "#171716", trim: "#6e5b37", sign: "WARE" },
      { id: "shops", name: "SHOPS", x: 294, y: 414, w: 140, h: 110, color: "#181322", trim: "#8a5ca8", sign: "SHOPS" },
      { id: "oldBlock", name: "OLD BLOCK", x: 532, y: 504, w: 130, h: 86, color: "#18151f", trim: "#5b5167", sign: "OLD" }
    ];

    const roofAreas = {`
);

replace(
  "redesign rooftop areas",
  /const roofAreas = \{[\s\S]*?\n    \};\n\n    const sewerTunnels = \[/,
  `const roofAreas = {
      [LAYER.ROOF_LOW]: [
        { id: "refugeLowerRoof", x: 92, y: 176, w: 148, h: 62, color: "#2d3045" },
        { id: "marketRoof", x: 286, y: 98, w: 118, h: 138, color: "#303246" },
        { id: "clubRoof", x: 596, y: 380, w: 158, h: 98, color: "#30263e" }
      ],
      [LAYER.ROOF_HIGH]: [
        { id: "refugeHighRoof", x: 96, y: 92, w: 140, h: 112, color: "#3a3a52" }
      ]
    };

    const sewerTunnels = [`
);

replace(
  "redesign sewers",
  /const sewerTunnels = \[[\s\S]*?\n    \];\n\n    const hiddenZones = \[/,
  `const sewerTunnels = [
      // Sewer level mirrors the two big avenues and the main alley network above.
      { x: 426, y: 42, w: 92, h: 560 },
      { x: 72, y: 292, w: 820, h: 92 },
      { x: 116, y: 426, w: 680, h: 76 },
      { x: 156, y: 150, w: 84, h: 285 },
      { x: 704, y: 156, w: 84, h: 315 },
      { x: 302, y: 190, w: 330, h: 62 }
    ];

    const hiddenZones = [`
);

replace(
  "redesign shadows",
  /const hiddenZones = \[[\s\S]*?\n    \];\n\n    const lightPosts = \[/,
  `const hiddenZones = [
      // The district is dark by default. Active lights carve danger zones out of this darkness.
      { name: "district darkness", x: 0, y: 0, w: WORLD_W, h: WORLD_H, strength: 0.50 },
      { name: "north alley", x: 246, y: 244, w: 474, h: 44, strength: 0.72 },
      { name: "south service alley", x: 88, y: 502, w: 790, h: 44, strength: 0.74 },
      { name: "warehouse alley", x: 96, y: 382, w: 196, h: 44, strength: 0.68 },
      { name: "church rear", x: 690, y: 550, w: 188, h: 34, strength: 0.68 },
      { name: "club rear", x: 584, y: 486, w: 190, h: 34, strength: 0.64 }
    ];

    const lightPosts = [`
);

replace(
  "redesign lights",
  /const lightPosts = \[[\s\S]*?\n    \];\n\n    const bodyHideSpots = \[/,
  `const lightPosts = [
      // Lights define the dangerous visible parts of the district.
      { id: "lampCrossA", x: 472, y: 324, radius: 78, broken: false, name: "crossroad streetlight" },
      { id: "lampCrossB", x: 504, y: 324, radius: 78, broken: false, name: "east crossroad streetlight" },
      { id: "lampPolice", x: 740, y: 240, radius: 78, broken: false, name: "police avenue streetlight" },
      { id: "lampClub", x: 638, y: 362, radius: 70, broken: false, name: "club streetlight" },
      { id: "lampChurch", x: 716, y: 420, radius: 72, broken: false, name: "church streetlight" },
      { id: "lampWarehouse", x: 222, y: 380, radius: 64, broken: false, name: "warehouse streetlight" },
      { id: "lampNorth", x: 432, y: 168, radius: 66, broken: false, name: "north avenue streetlight" }
    ];

    const bodyHideSpots = [`
);

replace(
  "redesign dumpster hide spots",
  /const bodyHideSpots = \[[\s\S]*?\n    \];\n\n    const localZones = \[/,
  `const bodyHideSpots = [
      // Bodies are hidden in dumpsters placed in alleys, not generic abstract spots.
      { id: "dumpsterNorthAlley", name: "north alley dumpster", layer: LAYER.STREET, x: 318, y: 262, r: 34, color: "#78c7a3" },
      { id: "dumpsterWarehouse", name: "warehouse dumpster", layer: LAYER.STREET, x: 176, y: 392, r: 34, color: "#78c7a3" },
      { id: "dumpsterClubRear", name: "club rear dumpster", layer: LAYER.STREET, x: 676, y: 502, r: 36, color: "#78c7a3" },
      { id: "dumpsterChurchRear", name: "church rear dumpster", layer: LAYER.STREET, x: 782, y: 558, r: 36, color: "#78c7a3" },
      { id: "dumpsterSouthService", name: "south service dumpster", layer: LAYER.STREET, x: 380, y: 528, r: 34, color: "#78c7a3" }
    ];

    const localZones = [`
);

replace(
  "redesign local zones",
  /const localZones = \[[\s\S]*?\n    \];\n\n    const cameras = \[/,
  `const localZones = [
      // Local heat: the city remembers where you caused trouble.
      { id: "cross", name: "Central crossroad", x: 392, y: 244, w: 170, h: 170, color: "#ffb02e" },
      { id: "northAvenue", name: "North avenue", x: 400, y: 38, w: 150, h: 250, color: "#ffb02e" },
      { id: "eastAvenue", name: "East avenue", x: 520, y: 292, w: 374, h: 116, color: "#ffb02e" },
      { id: "westAvenue", name: "West avenue", x: 64, y: 292, w: 360, h: 116, color: "#ffb02e" },
      { id: "club", name: "Club", x: 574, y: 350, w: 208, h: 168, color: "#d11fb9" },
      { id: "church", name: "Church", x: 680, y: 420, w: 210, h: 176, color: "#8b6f9e" },
      { id: "police", name: "Police station", x: 670, y: 70, w: 220, h: 204, color: "#4da3ff" },
      { id: "alleys", name: "Alleys", x: 80, y: 232, w: 820, h: 330, color: "#a75cff" },
      { id: "refuge", name: "Rooftop refuge", x: 80, y: 80, w: 180, h: 170, color: "#78c7a3" },
      { id: "roofs", name: "Rooftops", x: 80, y: 80, w: 720, h: 430, color: "#d7c8ff", layer: "roof" },
      { id: "sewer", name: "Sewers", x: 70, y: 40, w: 830, h: 560, color: "#78c7a3", layer: "sewer" }
    ];

    const cameras = [`
);

// ---------------------------------------------------------
// Interactables and spawn anchors.
// ---------------------------------------------------------
replace(
  "redesign safehouse interactable",
  /\{\n        id: "safehouseDoor",[\s\S]*?\n      \},\n      \{\n        id: "clubDoor",/,
  `{
        id: "safehouseDoor",
        label: "Rooftop refuge",
        layer: LAYER.ROOF_HIGH,
        x: 150, y: 146, r: 34,
        prompt: () => player.inSafehouse ? "E: leave rooftop refuge" : "Rooftop refuge: safe zone",
        action: () => {
          player.inSafehouse = false;
          player.layer = LAYER.ROOF_HIGH;
          player.x = 170; player.y = 148;
          say("You step out onto the high rooftop. Below: two bright avenues, dark alleys, police north-east and church south-east.", 5);
        }
      },
      {
        id: "clubDoor",`
);

replace(
  "move club door",
  /id: "clubDoor",\n        label: "Nightclub",\n        layer: LAYER\.STREET,\n        x: 472, y: 390, r: 28,/,
  `id: "clubDoor",
        label: "Nightclub",
        layer: LAYER.STREET,
        x: 638, y: 390, r: 30,`
);

replace(
  "move police station interactable",
  /id: "policeStation",\n        label: "Police station",\n        layer: LAYER\.STREET,\n        x: 785, y: 210, r: 28,/,
  `id: "policeStation",
        label: "Police station",
        layer: LAYER.STREET,
        x: 760, y: 216, r: 30,`
);

replace(
  "move sewer entrance main",
  /id: "sewerIn",\n        label: "Sewer access",\n        layer: LAYER\.STREET,\n        x: 612, y: 348, r: 24,/,
  `id: "sewerIn",
        label: "Sewer access",
        layer: LAYER.STREET,
        x: 474, y: 352, r: 26,`
);

replace(
  "move sewer out main",
  /id: "sewerOutMain",\n        label: "Sewer exit",\n        layer: LAYER\.SEWER,\n        x: 612, y: 348, r: 26,/,
  `id: "sewerOutMain",
        label: "Sewer exit",
        layer: LAYER.SEWER,
        x: 474, y: 352, r: 28,`
);

replace(
  "move sewer out main action",
  /player\.x = 612; player\.y = 352;\n          say\("You emerge from a manhole beside the alley\.", 3\);/,
  `player.x = 474; player.y = 352;
          say("You emerge from the central avenue manhole.", 3);`
);

replace(
  "move sewer home exit",
  /id: "sewerOutHome",\n        label: "Tunnel to safehouse",\n        layer: LAYER\.SEWER,\n        x: 162, y: 432, r: 26,/,
  `id: "sewerOutHome",
        label: "Tunnel to refuge tower",
        layer: LAYER.SEWER,
        x: 178, y: 176, r: 28,`
);

replace(
  "sewer home exit goes rooftop",
  /player\.layer = LAYER\.STREET;\n          player\.inSafehouse = true;\n          player\.x = 135; player\.y = 455;\n          cleanBloodAround\(player\.x, player\.y, LAYER\.STREET, 95, "You climb into the safehouse and clean the entry trail\."\);\n          say\("You climb through the safehouse private tunnel\.", 3\);/,
  `player.layer = LAYER.ROOF_HIGH;
          player.inSafehouse = true;
          player.x = 150; player.y = 146;
          say("You climb through the private tower shaft back to the rooftop refuge.", 3);`
);

replace(
  "move fire escape up from refuge",
  /id: "fireEscape",\n        label: "Fire escape",\n        layer: LAYER\.STREET,\n        x: 348, y: 292, r: 28,/,
  `id: "fireEscape",
        label: "Fire escape",
        layer: LAYER.STREET,
        x: 214, y: 244, r: 30,`
);

replace(
  "fire escape action to low roof",
  /player\.layer = LAYER\.ROOF_LOW;\n          player\.x = 350; player\.y = 258;\n          say\("You climb to a low rooftop\. The street fades below\.", 4\);/,
  `player.layer = LAYER.ROOF_LOW;
          player.x = 170; player.y = 196;
          say("You climb toward the refuge rooftops. The avenues glow below.", 4);`
);

replace(
  "move fire escape down",
  /id: "fireEscapeDown",\n        label: "Climb down",\n        layer: LAYER\.ROOF_LOW,\n        x: 350, y: 258, r: 24,/,
  `id: "fireEscapeDown",
        label: "Climb down",
        layer: LAYER.ROOF_LOW,
        x: 170, y: 196, r: 26,`
);

replace(
  "fire escape down action",
  /player\.layer = LAYER\.STREET;\n          player\.x = 348; player\.y = 292;\n          say\("You climb down into the alley\.", 3\);/,
  `player.layer = LAYER.STREET;
          player.x = 214; player.y = 244;
          say("You climb down into the shadowed alley below the refuge tower.", 3);`
);

replace(
  "to high roof location",
  /id: "toHighRoof",\n        label: "Upper ladder",\n        layer: LAYER\.ROOF_LOW,\n        x: 625, y: 188, r: 24,/,
  `id: "toHighRoof",
        label: "Upper ladder",
        layer: LAYER.ROOF_LOW,
        x: 222, y: 178, r: 24,`
);

replace(
  "to high roof action",
  /player\.layer = LAYER\.ROOF_HIGH;\n          player\.x = 674; player\.y = 190;\n          say\("You climb to a higher rooftop\. A good place to lose them\.", 4\);/,
  `player.layer = LAYER.ROOF_HIGH;
          player.x = 198; player.y = 150;
          say("You climb back to the high refuge roof. From here you can read the whole district.", 4);`
);

replace(
  "from high roof location",
  /id: "fromHighRoof",\n        label: "Drop to low rooftop",\n        layer: LAYER\.ROOF_HIGH,\n        x: 674, y: 190, r: 24,/,
  `id: "fromHighRoof",
        label: "Drop to low rooftop",
        layer: LAYER.ROOF_HIGH,
        x: 198, y: 150, r: 24,`
);

replace(
  "from high roof action",
  /player\.layer = LAYER\.ROOF_LOW;\n          player\.x = 625; player\.y = 188;\n          say\("You descend to the low rooftop\.", 3\);/,
  `player.layer = LAYER.ROOF_LOW;
          player.x = 222; player.y = 178;
          say("You descend onto the lower refuge roof.", 3);`
);

replace(
  "roof drop location",
  /id: "roofDrop",\n        label: "Drop into alley",\n        layer: LAYER\.ROOF_LOW,\n        x: 432, y: 268, r: 24,/,
  `id: "roofDrop",
        label: "Drop into alley",
        layer: LAYER.ROOF_LOW,
        x: 238, y: 230, r: 24,`
);

replace(
  "roof drop coordinates",
  /const ex = 432, ey = 318;/,
  `const ex = 260, ey = 264;`
);

// ---------------------------------------------------------
// Shadows are default except inside unbroken light circles.
// ---------------------------------------------------------
replace(
  "lights carve holes in shadow",
  /function getShadowZoneAt\(x, y, layer = player\.layer, inSafehouse = false\) \{\n      if \(layer !== LAYER\.STREET \|\| inSafehouse\) return null;/,
  `function getShadowZoneAt(x, y, layer = player.layer, inSafehouse = false) {
      if (layer !== LAYER.STREET || inSafehouse) return null;
      const activeLight = lightPosts.find(l => !l.broken && !l.outageTimer && Math.hypot(l.x - x, l.y - y) < l.radius * 0.92);
      if (activeLight) return null;`
);

// ---------------------------------------------------------
// NPCs, police/church origin, rats.
// ---------------------------------------------------------
replace(
  "add rat to sprite placeholders",
  /hunter: null,\n      lamp: null,/,
  `hunter: null,
      rat: null,
      lamp: null,`
);

replace(
  "rat speed and hostile fields",
  /speed: opts\.speed \?\? \(type === "hunter" \? 46 : type === "police" \? 34 : 13\),/,
  `speed: opts.speed ?? (type === "hunter" ? 46 : type === "police" ? 34 : type === "rat" ? 22 : 13),`
);

replace(
  "add npc hostile fields",
  /tempLife: opts\.tempLife \?\? 0\n      \};/,
  `tempLife: opts.tempLife ?? 0,
        hostileTimer: opts.hostileTimer ?? 0,
        shoveCooldown: 0
      };`
);

replace(
  "rat body size",
  /if \(type === "target"\) data\.speed = opts\.speed \?\? 7;/,
  `if (type === "target") data.speed = opts.speed ?? 7;
      if (type === "rat") { data.w = 6; data.h = 5; data.behavior = opts.behavior || "rat"; }`
);

replace(
  "redesign civilian and target positions",
  /\[\n      \s*\/\/ Fewer people around the club so the first hunt is possible\.[\s\S]*?\n    \]\.forEach\(\(\[x, y\]\) => npcs\.push\(makeNpc\("civilian", x, y, \{ behavior: "wander" \}\)\)\);[\s\S]*?npcs\.push\(makeNpc\("target", 450, 370, \{ behavior: "loiter", dirX: -1, dirY: 0, waitTimer: 999 \}\)\);/,
  `[
      // Civilians concentrate around lit avenues, with a few alley witnesses.
      [410, 330], [520, 326], [632, 366], [744, 250],
      [350, 168], [246, 266], [190, 398], [360, 526], [790, 420], [828, 548]
    ].forEach(([x, y]) => npcs.push(makeNpc("civilian", x, y, { behavior: "wander" })));

    // Awkward witnesses: they watch alley exits and bright corners.
    npcs.push(makeNpc("civilian", 316, 262, { behavior: "loiter", dirX: 1, dirY: 0, waitTimer: 999 }));
    npcs.push(makeNpc("civilian", 678, 506, { behavior: "loiter", dirX: -1, dirY: 0, waitTimer: 999 }));
    npcs.push(makeNpc("civilian", 734, 420, { behavior: "loiter", dirX: 0, dirY: 1, waitTimer: 999 }));

    // The journalist starts near the club but can be dragged into the rear alley.
    npcs.push(makeNpc("target", 632, 388, { behavior: "loiter", dirX: -1, dirY: 0, waitTimer: 999 }));`
);

replace(
  "hunter origin at church",
  /npcs\.push\(makeNpc\("hunter", 300, 336, \{ active: false, hidden: true, behavior: "ambush", dirX: 1, dirY: 0 \}\)\);\n    npcs\.push\(makeNpc\("hunter", 566, 526, \{ active: false, hidden: true, behavior: "ambush", dirX: -1, dirY: 0 \}\)\);/,
  `npcs.push(makeNpc("hunter", 736, 486, { active: false, hidden: true, behavior: "ambush", dirX: -1, dirY: 0 }));
    npcs.push(makeNpc("hunter", 820, 548, { active: false, hidden: true, behavior: "ambush", dirX: -1, dirY: -1 }));`
);

replace(
  "report points reflect station church avenues",
  /const reportPoints = \[[\s\S]*?\n    \];\n\n    const hunterBlockPoints = \[/,
  `const reportPoints = [
      { id: "policeDoor", name: "the police station", x: 760, y: 216, severityBonus: 10 },
      { id: "mainCross", name: "the central crossroad", x: 484, y: 324, severityBonus: 5 },
      { id: "clubCrowd", name: "the club queue", x: 638, y: 390, severityBonus: 4 }
    ];

    const hunterBlockPoints = [`
);

replace(
  "hunter route blocks new map",
  /const hunterBlockPoints = \[[\s\S]*?\n    \];/,
  `const hunterBlockPoints = [
      { id: "blockRefugeFireEscape", name: "the refuge fire escape", x: 214, y: 244, layer: LAYER.STREET },
      { id: "blockCentralSewer", name: "the central sewer entrance", x: 474, y: 352, layer: LAYER.STREET },
      { id: "blockClubRear", name: "the club rear alley", x: 676, y: 502, layer: LAYER.STREET },
      { id: "blockChurchLane", name: "the church lane", x: 782, y: 558, layer: LAYER.STREET }
    ];`
);

// ---------------------------------------------------------
// Police and hunters spawn from their buildings.
// ---------------------------------------------------------
replace(
  "police attention spawn from station",
  /const spawn = Math\.random\(\) < 0\.55 \? \{ x: 790, y: 218 \} : edgeSpawn\(\);\n        const cop = makeNpc\("police", spawn\.x, spawn\.y\);/,
  `const spawn = { x: 760 + (Math.random() - 0.5) * 34, y: 224 + Math.random() * 22 };
        const cop = makeNpc("police", spawn.x, spawn.y);`
);

replace(
  "spawn threats police from station",
  /const spawn = Math\.random\(\) < 0\.6 \? \{ x: 790, y: 218 \} : edgeSpawn\(\);\n        const cop = makeNpc\("police", spawn\.x, spawn\.y\);/,
  `const spawn = { x: 760 + (Math.random() - 0.5) * 36, y: 224 + Math.random() * 26 };
        const cop = makeNpc("police", spawn.x, spawn.y);`
);

replace(
  "spawn hunters from church",
  /const spawn = edgeSpawn\(\);\n          const hunter = makeNpc\("hunter", spawn\.x, spawn\.y\);/,
  `const spawn = { x: 760 + (Math.random() - 0.5) * 80, y: 500 + Math.random() * 58 };
          const hunter = makeNpc("hunter", spawn.x, spawn.y);`
);

// ---------------------------------------------------------
// Feeding rats in sewers.
// ---------------------------------------------------------
replace(
  "rat feedable",
  /if \(n\.type !== "civilian" && n\.type !== "target"\) continue;/,
  `if (n.type !== "civilian" && n.type !== "target" && n.type !== "rat") continue;
        if (n.type === "rat" && player.layer !== LAYER.SEWER) continue;`
);

replace(
  "rat feeding duration",
  /const baseDuration = victim\.type === "target" \? 1\.25 : 1\.05;/,
  `const baseDuration = victim.type === "target" ? 1.25 : victim.type === "rat" ? 0.45 : 1.05;`
);

replace(
  "rat hunger relief",
  /const hungerDrop = victim\.type === "target" \? BALANCE\.targetFeedRelief : BALANCE\.civilianFeedRelief;/,
  `const hungerDrop = victim.type === "target" ? BALANCE.targetFeedRelief : victim.type === "rat" ? 16 : BALANCE.civilianFeedRelief;`
);

replace(
  "rat clean feed after audio",
  /AudioBus\.play\(violentFeed \? "brutalFeed" : "feedFinish", violentFeed \? 1\.25 : 0\.95\);/,
  `AudioBus.play(violentFeed ? "brutalFeed" : "feedFinish", violentFeed ? 1.25 : 0.95);

      if (victim.type === "rat") {
        victim.hiddenBody = true;
        victim.corpseDiscovered = true;
        say(\`You feed on a sewer rat. Hunger -\${hungerDrop}%. It is filthy, but safe.\`, 2.6);
        return;
      }`
);

insertAfter(
  "sewer rat spawn helpers",
  `function updateCorpseDiscovery(dt) {`,
  `

    function spawnSewerRat() {
      const tunnels = sewerTunnels;
      const t = tunnels[Math.floor(Math.random() * tunnels.length)];
      const rat = makeNpc("rat", t.x + 12 + Math.random() * Math.max(8, t.w - 24), t.y + 12 + Math.random() * Math.max(8, t.h - 24), {
        layer: LAYER.SEWER,
        behavior: "rat",
        speed: 20,
        eventNpc: true,
        tempLife: 26 + Math.random() * 16
      });
      npcs.push(rat);
    }

    function updateSewerRats(dt) {
      if (player.layer === LAYER.SEWER && state.time >= state.nextRatSpawnAt) {
        state.nextRatSpawnAt = state.time + 10 + Math.random() * 15;
        if (npcs.filter(n => n.type === "rat" && !n.dead && !n.hiddenBody).length < 5) spawnSewerRat();
      }
      for (const rat of npcs) {
        if (rat.type !== "rat" || rat.dead || rat.hiddenBody) continue;
        rat.tempLife -= dt;
        if (rat.tempLife <= 0) { rat.hiddenBody = true; continue; }
        rat.aiTimer -= dt;
        if (rat.aiTimer <= 0) {
          rat.aiTimer = 0.45 + Math.random() * 0.9;
          const ang = Math.random() * Math.PI * 2;
          rat.vx = Math.cos(ang) * rat.speed;
          rat.vy = Math.sin(ang) * rat.speed;
        }
        moveEntity(rat, rat.vx, rat.vy, dt);
      }
    }
`
);

replace(
  "call sewer rats update",
  /updateDynamicEvents\(simDt\);\n      updateBloodStains\(simDt\);/,
  `updateDynamicEvents(simDt);
      updateSewerRats(simDt);
      updateBloodStains(simDt);`
);

// ---------------------------------------------------------
// Lamp breaking = alert level 1 minimum, repeated = level 2; nearby civilians may fight.
// ---------------------------------------------------------
insertAfter(
  "force exposure level helper",
  `function addExposure(amount, reason) {`,
  `
      // addExposure handles ordinary increments; forceExposureLevel is used for wanted-style thresholds.
`
);

insertAfter(
  "force exposure level function",
  `    }

    // ---------------------------------------------------------
    // Local heat / wanted level / reactive city
`,
  `
    function forceExposureLevel(level, reason = "") {
      const target = BALANCE.exposurePerLevel * level;
      if (player.exposure < target) {
        player.exposure = target;
        if (reason) say(reason, 3);
      }
    }

`
);

insertAfter(
  "hostile helpers before action section",
  `    // ---------------------------------------------------------
    // Input / interacciones
`,
  `
    function nearestHostilePedestrian() {
      let best = null;
      let bestD = Infinity;
      for (const n of npcs) {
        if (n.dead || n.stunned || n.hiddenBody || n.type !== "civilian" || n.hostileTimer <= 0) continue;
        if (n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        if (d < 24 && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    function shoveHostilePedestrian(n) {
      if (!n) return false;
      const dx = n.x - player.x;
      const dy = n.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = n.x + (dx / len) * 28;
      const ny = n.y + (dy / len) * 28;
      if (canStandAt(nx, ny, n.layer, false)) { n.x = nx; n.y = ny; }
      n.hostileTimer = Math.max(0, n.hostileTimer - 3.0);
      n.stunned = true;
      n.waitTimer = 0.9;
      addExposure(2, "You shove an angry pedestrian back.");
      say("You shove the angry pedestrian away and make room to run.", 2.2);
      return true;
    }

    function angerPedestrianNear(x, y) {
      const candidates = npcs.filter(n =>
        n.type === "civilian" && !n.dead && !n.stunned && !n.hiddenBody && n.layer === LAYER.STREET &&
        Math.hypot(n.x - x, n.y - y) < 145 && canSeeEntity(n, player, { range: 150, cosLimit: 0.18 })
      );
      if (!candidates.length || Math.random() > 0.45) return false;
      const n = candidates.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      n.hostileTimer = 5.5 + Math.random() * 2.5;
      n.fleeTimer = 0;
      n.alarmed = false;
      n.hasReported = false;
      n.suspiciousTimer = Math.max(n.suspiciousTimer || 0, 2.0);
      say("A pedestrian snaps: vandalism was one thing too many. They come at you.", 3);
      return true;
    }

`
);

replace(
  "handle hostile before witnesses",
  /const alarmed = nearestAlarmedWitness\(\);\n      if \(alarmed\) \{/,
  `const hostile = nearestHostilePedestrian();
      if (hostile && shoveHostilePedestrian(hostile)) return;

      const alarmed = nearestAlarmedWitness();
      if (alarmed) {`
);

replace(
  "lamp break wanted chain and pedestrian anger",
  /function breakLight\(light\) \{[\s\S]*?\n    \}\n\n    function startFeeding/,
  `function breakLight(light) {
      if (!light || light.broken) return;
      light.broken = true;
      state.stats.lightsBroken++;
      AudioBus.play("glass", 1.0);

      if (state.time <= state.lampBreakWindowUntil) state.lampBreakChainCount++;
      else state.lampBreakChainCount = 1;
      state.lampBreakWindowUntil = state.time + 12;

      const witnesses = visibleWitnessList(145).filter(w => w.type !== "hunter");
      addLocalHeat(witnesses.length > 0 ? 12 : 8, "streetlight vandalism", light.x, light.y, LAYER.STREET);
      addExposure(witnesses.length > 0 ? 5 : 3, \`${light.name} broken. The avenue gets darker, but the district notices.\`);
      forceExposureLevel(1, "Alert level 1: breaking streetlights makes the district watch you.");
      if (state.lampBreakChainCount >= 3) {
        forceExposureLevel(2, "Alert level 2: repeated vandalism brings police pressure.");
        callPoliceAttention(light.x, light.y, LAYER.STREET, "multiple streetlights broken in quick succession", 1.2);
      }
      angerPedestrianNear(light.x, light.y);
      say("The lamp goes out. Useful shadow, higher alert.", 3);
    }

    function startFeeding`
);

replace(
  "hostile civilian ai",
  /if \(updateAlarmedWitness\(n, dt\)\) return;\n      if \(n\.fleeTimer > 0\) n\.fleeTimer -= dt;/,
  `if (n.hostileTimer > 0) {
        n.hostileTimer -= dt;
        n.shoveCooldown = Math.max(0, (n.shoveCooldown || 0) - dt);
        const ax = player.x - n.x;
        const ay = player.y - n.y;
        const len = Math.hypot(ax, ay) || 1;
        if (len > 15) moveEntity(n, (ax / len) * n.speed * 1.9, (ay / len) * n.speed * 1.9, dt);
        else if (n.shoveCooldown <= 0) {
          n.shoveCooldown = 1.4;
          const px = player.x - (ax / len) * 22;
          const py = player.y - (ay / len) * 22;
          if (canStandAt(px, py)) { player.x = px; player.y = py; }
          addExposure(2, "An angry pedestrian shoves you in the street.");
          say("An angry pedestrian shoves you. Press E near them to shove back, or run.", 2.5);
        }
        return;
      }
      if (updateAlarmedWitness(n, dt)) return;
      if (n.fleeTimer > 0) n.fleeTimer -= dt;`
);

replace(
  "hostile civilian color",
  /if \(n\.fleeTimer > 0\) c = "#ffe16b";/,
  `if (n.fleeTimer > 0) c = "#ffe16b";
        if (n.hostileTimer > 0) c = "#ff6b3d";`
);

replace(
  "hostile marker render",
  /if \(n\.alarmed && !n\.hasReported\) \{/,
  `if (n.hostileTimer > 0) {
          ctx.fillStyle = "#ff6b3d";
          ctx.fillRect(Math.floor(n.x - 3), Math.floor(n.y - 16), 6, 2);
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 13), 2, 6);
        } else if (n.alarmed && !n.hasReported) {`
);

// ---------------------------------------------------------
// Rat visuals / feed text.
// ---------------------------------------------------------
replace(
  "rat draw color",
  /if \(n\.type === "hunter"\) c = "#ff9d35";/,
  `if (n.type === "hunter") c = "#ff9d35";
        if (n.type === "rat") c = "#8f7f78";`
);

replace(
  "rat npc palette",
  /if \(n\.type === "target"\) \{\n        return \{ head: "#d9bfaa", hair: "#ffb2f3", body: bodyColor, detail: "#ffd7fa", arms: bodyColor, feet: "#482345", face: "#101018" \};\n      \}/,
  `if (n.type === "target") {
        return { head: "#d9bfaa", hair: "#ffb2f3", body: bodyColor, detail: "#ffd7fa", arms: bodyColor, feet: "#482345", face: "#101018" };
      }
      if (n.type === "rat") {
        return { head: "#8f7f78", hair: "#5f5550", body: "#756861", detail: "#c0aaa0", arms: "#756861", feet: "#4d3f3a", face: "#101018" };
      }`
);

replace(
  "rat prompt",
  /return victim\.type === "target" \? `E: eliminate JOURNALIST: greatly lowers hunger \(\$\{risk\}\)` : `E: drain civilian: lowers hunger \(\$\{risk\}\)`;/,
  `if (victim.type === "rat") return "E: feed on sewer rat: small hunger relief, no exposure";
        return victim.type === "target" ? \`E: eliminate JOURNALIST: greatly lowers hunger (\${risk})\` : \`E: drain civilian: lowers hunger (\${risk})\`;`
);

// ---------------------------------------------------------
// Rendering roads: two avenues cross, alleys around them.
// ---------------------------------------------------------
replace(
  "draw two avenues and alleys",
  /\/\/ Streets principales\.[\s\S]*?\/\/ Dark alley\.[\s\S]*?for \(let x = 260; x < 650; x \+= 24\) ctx\.fillRect\(x, 306, 10, 2\);/,
  `// Two main avenues cross in the center; smaller alleys wrap around the blocks.
      drawRoad(0, 300, WORLD_W, 82);
      drawRoad(434, 0, 86, WORLD_H);
      drawRoad(88, 248, 760, 42);
      drawRoad(76, 510, 812, 42);
      drawRoad(150, 118, 48, 420);
      drawRoad(704, 146, 54, 436);

      // Alley texture strips.
      ctx.fillStyle = "#141624";
      ctx.fillRect(88, 248, 760, 42);
      ctx.fillRect(76, 510, 812, 42);
      ctx.fillStyle = "#2b2e40";
      for (let x = 96; x < 850; x += 28) ctx.fillRect(x, 268, 11, 2);
      for (let x = 84; x < 880; x += 28) ctx.fillRect(x, 530, 11, 2);`
);

// ---------------------------------------------------------
// Mission/start copy.
// ---------------------------------------------------------
replace(
  "start game copy rooftop",
  /say\("Clan order: leave the safehouse, locate the journalist, lure them away, eliminate them, then return unseen\.", 5\.5\);/,
  `say("Clan order: leave the rooftop refuge, descend into the district, locate the journalist and contain the leak however you can.", 5.5);`
);

replace(
  "mission one copy rooftop",
  /if \(state\.mission === 1\) return "1\/7 Leave the safehouse and take control of your district\.";/,
  `if (state.mission === 1) return "1/7 Leave the rooftop refuge and enter the district below.";`
);

replace(
  "mission step one message rooftop",
  /say\("Step 1: reach the pink-lit nightclub\. The journalist is meeting a source nearby\.", 4\);/,
  `say("Step 1: descend from the refuge and reach the pink-lit nightclub near the eastern avenue.", 4);`
);

if (!changed) {
  console.log("No district redesign changes were needed.");
} else {
  fs.writeFileSync(file, code);
  console.log("District redesign patch complete.");
}
