// District redesign patch v2
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
  "club reposition",
  /id: "clubDoor",\n        label: "Nightclub",\n        layer: LAYER\.STREET,\n        x: 472, y: 390, r: 28,/,
  `id: "clubDoor",
        label: "Nightclub",
        layer: LAYER.STREET,
        x: 642, y: 404, r: 30,`
);

replace(
  "police station dispatch wording",
  /id: "policeStation",[\s\S]*?action: \(\) => addExposure\(18, "You got too close to the police station\. They identified you\."\)/,
  `id: "policeStation",
        label: "Police station",
        layer: LAYER.STREET,
        x: 780, y: 170, r: 32,
        prompt: () => "Police station: patrols deploy from here when exposure rises",
        action: () => addExposure(16, "You loiter outside the police station. Patrols mark you.")`
);

replace(
  "sewer main entrance reposition",
  /id: "sewerIn",[\s\S]*?x: 612, y: 348, r: 24,/,
  `id: "sewerIn",
        label: "Sewer access",
        layer: LAYER.STREET,
        x: 472, y: 326, r: 26,`
);

replace(
  "sewer main exit reposition",
  /id: "sewerOutMain",[\s\S]*?x: 612, y: 348, r: 26,/,
  `id: "sewerOutMain",
        label: "Sewer exit",
        layer: LAYER.SEWER,
        x: 472, y: 326, r: 26,`
);

replace(
  "sewer to refuge exit",
  /id: "sewerOutHome",[\s\S]*?x: 162, y: 432, r: 26,/,
  `id: "sewerOutHome",
        label: "Tunnel to rooftop refuge",
        layer: LAYER.SEWER,
        x: 176, y: 180, r: 26,`
);

replace(
  "fire escape from street to refuge",
  /id: "fireEscape",[\s\S]*?x: 348, y: 292, r: 28,/,
  `id: "fireEscape",
        label: "Fire escape",
        layer: LAYER.STREET,
        x: 176, y: 244, r: 28,`
);

replace(
  "fire escape up landing",
  /player\.layer = LAYER\.ROOF_LOW;\n          player\.x = 350; player\.y = 258;\n          say\("You climb to a low rooftop\. The street fades below\.", 4\);/,
  `player.layer = LAYER.ROOF_LOW;
          player.x = 166; player.y = 206;
          say("You climb toward the rooftop refuge. The crossroad glows below.", 4);`
);

replace(
  "fire escape down reposition",
  /id: "fireEscapeDown",[\s\S]*?x: 350, y: 258, r: 24,/,
  `id: "fireEscapeDown",
        label: "Climb down",
        layer: LAYER.ROOF_LOW,
        x: 166, y: 206, r: 24,`
);

replace(
  "fire escape down landing",
  /player\.layer = LAYER\.STREET;\n          player\.x = 348; player\.y = 292;\n          say\("You climb down into the alley\.", 3\);/,
  `player.layer = LAYER.STREET;
          player.x = 176; player.y = 244;
          say("You climb down into the west alley.", 3);`
);

// ---------------------------------------------------------
// NPC locations and spawn origins.
// ---------------------------------------------------------
replace(
  "redesign civilian list",
  /\[\n      \/\/ Fewer people around the club so the first hunt is possible\.[\s\S]*?\n    \]\.forEach\(\(\[x, y\]\) => npcs\.push\(makeNpc\("civilian", x, y, \{ behavior: "wander" \}\)\)\);/,
  `[
      // Pedestrians mostly use the two avenues. Alleys stay useful but not empty.
      [430, 132], [520, 170], [360, 326], [586, 326], [670, 326], [246, 326],
      [642, 406], [720, 456], [206, 524], [420, 526], [810, 326]
    ].forEach(([x, y]) => npcs.push(makeNpc("civilian", x, y, { behavior: "wander" })));`
);

replace(
  "redesign loiterers",
  /npcs\.push\(makeNpc\("civilian", 346, 340,[\s\S]*?npcs\.push\(makeNpc\("civilian", 694, 392, \{ behavior: "loiter", dirX: 0, dirY: 1, waitTimer: 999 \}\)\);/,
  `npcs.push(makeNpc("civilian", 324, 262, { behavior: "loiter", dirX: 1, dirY: 0, waitTimer: 999 }));
    npcs.push(makeNpc("civilian", 674, 502, { behavior: "loiter", dirX: -1, dirY: 0, waitTimer: 999 }));
    npcs.push(makeNpc("civilian", 784, 558, { behavior: "loiter", dirX: -1, dirY: -1, waitTimer: 999 }));`
);

replace(
  "target beside new club",
  /npcs\.push\(makeNpc\("target", 450, 370, \{ behavior: "loiter", dirX: -1, dirY: 0, waitTimer: 999 \}\)\);/,
  `npcs.push(makeNpc("target", 638, 370, { behavior: "loiter", dirX: -1, dirY: 0, waitTimer: 999 }));`
);

replace(
  "hunters start at church",
  /npcs\.push\(makeNpc\("hunter", 300, 336,[\s\S]*?npcs\.push\(makeNpc\("hunter", 566, 526, \{ active: false, hidden: true, behavior: "ambush", dirX: -1, dirY: 0 \}\)\);/,
  `npcs.push(makeNpc("hunter", 742, 474, { active: false, hidden: true, behavior: "ambush", dirX: -1, dirY: 0 }));
    npcs.push(makeNpc("hunter", 810, 532, { active: false, hidden: true, behavior: "ambush", dirX: -1, dirY: -1 }));`
);

replace(
  "report points new geography",
  /const reportPoints = \[[\s\S]*?\n    \];\n\n    const hunterBlockPoints = \[/,
  `const reportPoints = [
      { id: "policeDoor", name: "the police station", x: 780, y: 170, severityBonus: 10 },
      { id: "centralCross", name: "the central crossroad", x: 488, y: 326, severityBonus: 6 },
      { id: "clubCrowd", name: "the club queue", x: 642, y: 404, severityBonus: 4 }
    ];

    const hunterBlockPoints = [`
);

replace(
  "hunter block points new geography",
  /const hunterBlockPoints = \[[\s\S]*?\n    \];/,
  `const hunterBlockPoints = [
      { id: "blockFireEscape", name: "the refuge fire escape", x: 176, y: 244, layer: LAYER.STREET },
      { id: "blockSewerCross", name: "the crossroad manhole", x: 472, y: 326, layer: LAYER.STREET },
      { id: "blockClubAlley", name: "the club rear alley", x: 676, y: 502, layer: LAYER.STREET },
      { id: "blockChurch", name: "the church gate", x: 742, y: 474, layer: LAYER.STREET }
    ];`
);

// ---------------------------------------------------------
// Utility helpers: force wanted level, rats, station/church spawns.
// ---------------------------------------------------------
insertAfter(
  "force exposure helper",
  `function exposureLevel() {
      return clamp(Math.floor(player.exposure / BALANCE.exposurePerLevel), 0, 5);
    }
`,
  `
    function forceExposureLevel(level, reason = "") {
      const target = clamp(level, 0, 5) * BALANCE.exposurePerLevel;
      if (player.exposure < target) addExposure(target - player.exposure, reason);
    }
`
);

insertAfter(
  "rat helpers after makeNpc",
  `      return data;
    }
`,
  `

    function makeRat(x, y) {
      const rat = makeNpc("rat", x, y, { layer: LAYER.SEWER, behavior: "wander", speed: 20, eventNpc: true, tempLife: 28 });
      rat.w = 6;
      rat.h = 5;
      return rat;
    }
`
);

insertAfter(
  "rat feed relief helper",
  `function nearestFeedable() {
`,
  `      // Rats in the sewers are small emergency feeding targets.
`
);

replace(
  "nearest feedable includes rats",
  /if \(n\.type !== "civilian" && n\.type !== "target"\) continue;/,
  `if (n.type !== "civilian" && n.type !== "target" && n.type !== "rat") continue;`
);

replace(
  "rat feed relief",
  /const hungerDrop = victim\.type === "target" \? BALANCE\.targetFeedRelief : BALANCE\.civilianFeedRelief;/,
  `const hungerDrop = victim.type === "target" ? BALANCE.targetFeedRelief : victim.type === "rat" ? 12 : BALANCE.civilianFeedRelief;`
);

insertAfter(
  "rat spawn updater after dynamic events",
  `function updateDynamicEvents(dt) {
`,
  `      updateRatSpawns(dt);
`
);

insertAfter(
  "rat spawn function before updateDynamicEvents",
  `function updateCameras(dt) {
      // Removed: the wanted system now comes from witnesses, police dispatch and hunter escalation.
    }

`,
  `    function updateRatSpawns(dt) {
      if (player.layer !== LAYER.SEWER || state.time < state.nextRatSpawnAt) return;
      state.nextRatSpawnAt = state.time + 10 + Math.random() * 14;
      const livingRats = npcs.filter(n => n.type === "rat" && !n.dead && n.layer === LAYER.SEWER).length;
      if (livingRats >= 3) return;
      const tunnel = sewerTunnels[Math.floor(Math.random() * sewerTunnels.length)];
      const x = tunnel.x + 12 + Math.random() * Math.max(6, tunnel.w - 24);
      const y = tunnel.y + 12 + Math.random() * Math.max(6, tunnel.h - 24);
      npcs.push(makeRat(x, y));
      say("Something small scratches through the sewer dark. A rat: poor blood, but blood.", 2.6);
    }

`
);

// Police spawn from station and hunters from church.
replace(
  "police spawn from station",
  /const spawn = Math\.random\(\) < 0\.6 \? \{ x: 790, y: 218 \} : edgeSpawn\(\);\n        const cop = makeNpc\("police", spawn\.x, spawn\.y\);/,
  `const spawn = { x: 780 + (Math.random() - 0.5) * 36, y: 178 + (Math.random() - 0.5) * 28 };
        const cop = makeNpc("police", spawn.x, spawn.y);`
);

replace(
  "hunter spawn from church",
  /const spawn = edgeSpawn\(\);\n          const hunter = makeNpc\("hunter", spawn\.x, spawn\.y\);/,
  `const spawn = { x: 742 + (Math.random() - 0.5) * 58, y: 474 + (Math.random() - 0.5) * 48 };
          const hunter = makeNpc("hunter", spawn.x, spawn.y);`
);

// ---------------------------------------------------------
// Break lights: force level 1, repeated breaks to level 2, possible pedestrian anger.
// ---------------------------------------------------------
insertAfter(
  "hostile pedestrian helpers before handleAction",
  `function handleAction() {
`,
  `      const hostile = nearestHostilePedestrian();
      if (hostile && shoveHostilePedestrian(hostile)) return;
`
);

insertAfter(
  "hostile helpers before input section",
  `// ---------------------------------------------------------
    // Input / interacciones
    // ---------------------------------------------------------
`,
  `
    function nearestHostilePedestrian() {
      let best = null;
      let bestD = Infinity;
      for (const n of npcs) {
        if (!n.hostileTimer || n.dead || n.stunned || n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        if (d < 24 && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    function shoveHostilePedestrian(n) {
      if (!n) return false;
      n.hostileTimer = 0;
      n.stunned = true;
      n.waitTimer = 1.6;
      const dx = n.x - player.x;
      const dy = n.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      n.x += (dx / len) * 26;
      n.y += (dy / len) * 26;
      addExposure(2, "A street scuffle draws eyes.");
      say("You shove the pedestrian back. Enough to move, not enough to stay quiet.", 2.4);
      return true;
    }

    function angerPedestrianNear(x, y) {
      const candidates = npcs.filter(n => n.type === "civilian" && !n.dead && !n.stunned && n.layer === LAYER.STREET && Math.hypot(n.x - x, n.y - y) < 118);
      if (!candidates.length || Math.random() > 0.45) return;
      const n = candidates.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      n.hostileTimer = 7.0;
      n.suspiciousTimer = 4.0;
      n.fleeTimer = 0;
      say("A pedestrian snaps: 'Hey! What are you doing?' They come at you.", 2.8);
    }

`
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
      addExposure(witnesses.length > 0 ? 5 : 3, \`\${light.name} broken. The avenue gets darker, but the district notices.\`);
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
        moveEntity(n, (ax / len) * n.speed * 2.05, (ay / len) * n.speed * 2.05, dt);
        if (len < 16 && n.shoveCooldown <= 0) {
          n.shoveCooldown = 1.6;
          const bx = player.x - n.x;
          const by = player.y - n.y;
          const blen = Math.hypot(bx, by) || 1;
          const px = player.x + (bx / blen) * 18;
          const py = player.y + (by / blen) * 18;
          if (canStandAt(px, py)) { player.x = px; player.y = py; }
          addExposure(2, "A pedestrian shoves you in the street.");
          say("A pedestrian shoves you back. This street is awake now.", 1.8);
        }
        return;
      }
      if (updateAlarmedWitness(n, dt)) return;
      if (n.fleeTimer > 0) n.fleeTimer -= dt;`
);

// ---------------------------------------------------------
// Rendering: avenues/alleys and rats.
// ---------------------------------------------------------
replace(
  "redesign roads rendering",
  /\/\/ Streets principales\.\n      drawRoad\(0, 322, WORLD_W, 70\);\n      drawRoad\(236, 0, 68, WORLD_H\);\n      drawRoad\(646, 0, 70, WORLD_H\);\n      drawRoad\(0, 538, WORLD_W, 52\);/,
  `// Two main avenues crossing, plus service alleys.
      drawRoad(0, 292, WORLD_W, 92);
      drawRoad(426, 0, 92, WORLD_H);
      drawRoad(90, 502, 790, 44);
      drawRoad(246, 244, 474, 44);
      drawRoad(96, 382, 198, 44);`
);

replace(
  "remove old alley rendering",
  /\/\/ Dark alley\.\n      ctx\.fillStyle = "#141624";[\s\S]*?for \(let x = 260; x < 650; x \+= 24\) ctx\.fillRect\(x, 306, 10, 2\);/,
  `// Alleys are already drawn as roads and dark zones.`
);

replace(
  "rat color draw",
  /if \(n\.type === "target"\) c = "#ff4bd8";/,
  `if (n.type === "rat") c = "#9c8f7a";
        if (n.type === "target") c = "#ff4bd8";`
);

replace(
  "rat marker draw",
  /marker: n\.type === "police" \? "police" : n\.type === "hunter" \? "hunter" : n\.type === "target" \? "target" : "civilian",/,
  `marker: n.type === "police" ? "police" : n.type === "hunter" ? "hunter" : n.type === "target" ? "target" : "civilian",`
);

// ---------------------------------------------------------
// Text polish.
// ---------------------------------------------------------
replace(
  "start game rooftop copy",
  /say\("Clan order: leave the safehouse, locate the journalist, lure them away, eliminate them, then return unseen\.", 5\.5\);/,
  `say("Clan order: leave the rooftop refuge, locate the journalist below, eliminate them your way, then get back above the street.", 5.5);`
);

replace(
  "mission text roof start",
  /if \(state\.mission === 1\) return "1\/7 Leave the safehouse and take control of your district\.";/,
  `if (state.mission === 1) return "1/7 Leave the rooftop refuge and descend into your district.";`
);

replace(
  "first mission trigger rooftop",
  /if \(state\.mission === 1 && !player\.inSafehouse\) \{\n        state\.mission = 2;\n        say\("Step 1: reach the pink-lit nightclub\. The journalist is meeting a source nearby\.", 4\);\n      \}/,
  `if (state.mission === 1 && !player.inSafehouse) {
        state.mission = 2;
        say("Step 1: descend from the rooftop and reach the pink-lit nightclub by the east avenue.", 4);
      }`
);

replace(
  "club proximity mission",
  /if \(state\.mission === 2 && club && Math\.hypot\(player\.x - club\.x, player\.y - club\.y\) < 105 && player\.layer === LAYER\.STREET\) \{/,
  `if (state.mission === 2 && club && Math.hypot(player.x - club.x, player.y - club.y) < 115 && player.layer === LAYER.STREET) {`
);

replace(
  "blood sense rat copy",
  /say\(`Blood Sense \[\+\$\{senseHunger\} hunger\]: the journalist, isolated civilians, trails, hunters and escape routes glow for a few seconds\.\$\{hungerWarning\}`, hungerWarning \? 3\.8 : 3\.2\);/,
  `say(\`Blood Sense [+\${senseHunger} hunger]: journalist, victims, rats, trails, hunters and escape routes glow for a few seconds.\${hungerWarning}\`, hungerWarning ? 3.8 : 3.2);`
);

fs.writeFileSync(file, code);
console.log(changed ? "District redesign patch complete." : "No district redesign changes were needed.");
