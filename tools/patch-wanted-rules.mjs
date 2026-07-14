import fs from "node:fs";

const file = "js/game.js";
let code = fs.readFileSync(file, "utf8");

function replaceOnce(label, pattern, replacement) {
  const next = code.replace(pattern, replacement);
  if (next === code) throw new Error(`Patch failed: ${label}`);
  code = next;
  console.log(`Patched: ${label}`);
}

replaceOnce(
  "hunter route blocking starts later",
  /hunterRouteBlockMinLevel: 3,/,
  "hunterRouteBlockMinLevel: 4,"
);

replaceOnce(
  "remove fixed surveillance cameras from map data",
  /const cameras = \[[\s\S]*?\n    \];/,
  `const cameras = [
      // Fixed surveillance cameras removed: the city reacts through witnesses, police heat and wanted level.
    ];`
);

replaceOnce(
  "remove initial visible police patrols",
  /\n    \/\/ Police: visibles desde el principio[\s\S]*?\n    \}\)\);\n\n    \/\/ Hunters hidden:/,
  `
    // Police are not visible from the start anymore. They spawn only when exposure reaches wanted levels.

    // Hunters hidden:`
);

replaceOnce(
  "wanted level copy",
  /if \(after === 1\) say\("Exposure 1: civilians start getting scared\."[\s\S]*?if \(after >= 4\) \{ AudioBus\.play\("alert", 1\.4\); say\("Critical exposure: break line of sight or hide now\."[\s\S]*?\}/,
  `if (after === 1) say("Exposure 1: civilians get nervous. You are not wanted yet.", 3);
        if (after === 2) { AudioBus.play("police", 1.0); say("Exposure 2: police are dispatched. The chase can start.", 3); }
        if (after === 3) { AudioBus.play("police", 1.15); say("Exposure 3: police pressure rises. Escape routes matter.", 3); }
        if (after === 4) { AudioBus.play("hunterReveal", 0.85); say("Exposure 4: the situation is too strange. Hunters start paying attention.", 3); }
        if (after >= 5) { AudioBus.play("alert", 1.4); say("Blood hunt level: the district is no longer treating this as normal crime.", 3); }`
);

replaceOnce(
  "reactive city section label",
  /\/\/ Local heat \/ cameras \/ reactive city/,
  "// Local heat / wanted level / reactive city"
);

replaceOnce(
  "cameras disabled function",
  /function exposeToCameras\(baseGain, reason, x = player\.x, y = player\.y, layer = player\.layer\) \{[\s\S]*?\n    \}/,
  `function exposeToCameras(baseGain, reason, x = player.x, y = player.y, layer = player.layer) {
      // Surveillance cameras were removed. Exposure now comes from witnesses, violence, heat and wanted level.
      return 0;
    }`
);

replaceOnce(
  "nearest breakable camera disabled",
  /function nearestBreakableCamera\(\) \{[\s\S]*?\n    \}/,
  `function nearestBreakableCamera() {
      return null;
    }`
);

replaceOnce(
  "remove camera branch from action",
  /\n      const cam = nearestBreakableCamera\(\);\n      if \(cam\) \{\n        breakCamera\(cam\);\n        return;\n      \}\n/,
  "\n"
);

replaceOnce(
  "lamp breaking as minor vandalism",
  /function breakLight\(light\) \{[\s\S]*?\n    \}\n\n    function startFeeding/,
  `function breakLight(light) {
      if (!light || light.broken) return;
      light.broken = true;
      state.stats.lightsBroken++;
      AudioBus.play("glass", 1.0);

      const witnesses = visibleWitnessList(145).filter(w => w.type !== "hunter");
      addLocalHeat(witnesses.length > 0 ? 10 : 6, "streetlight vandalism", light.x, light.y, LAYER.STREET);
      if (witnesses.length > 0) {
        addExposure(4, \`${light.name} broken in front of witnesses. Police may care, but this is still just vandalism.\`);
      } else {
        addExposure(2, \`${light.name} broken. Minor vandalism raises the district heat.\`);
      }
      say("The lamp goes out. You create a useful shadow, but the street gets a little hotter.", 3);
    }

    function startFeeding`
);

replaceOnce(
  "update hunters only at high wanted level",
  /if \(n\.type === "hunter" && level >= 3 && !n\.hidden\) n\.active = true;/,
  `if (n.type === "hunter" && level >= 4 && !n.hidden) n.active = true;`
);

replaceOnce(
  "hidden hunters need high exposure",
  /function maybeRevealHunter\(n, level\) \{\n      if \(!n\.hidden \|\| n\.revealed \|\| player\.inSafehouse \|\| player\.layer !== LAYER\.STREET\) return;\n      const d = Math\.hypot\(n\.x - player\.x, n\.y - player\.y\);\n      const triggeredByExposure = level >= 3 && d < 190;\n      const triggeredByMessyHunt = state\.targetFed && player\.exposure >= 30 && d < 140;\n      const triggeredByDash = player\.dashFlash > 0 && d < 120;\n      const triggeredByBeast = beastStage\(\)\.level >= 3 && d < 155 && publicWitnesses\(110\) > 0;\n      const nearbyBlood = state\.bloodStains\.find\(s => !s\.cleaned && s\.layer === LAYER\.STREET && Math\.hypot\(s\.x - n\.x, s\.y - n\.y\) < \(s\.brutal \? 230 : 145\)\);\n      const triggeredByBlood = Boolean\(nearbyBlood && \(nearbyBlood\.brutal \|\| nearbyBlood\.age < 35\)\);/,
  `function maybeRevealHunter(n, level) {
      if (!n.hidden || n.revealed || player.inSafehouse || player.layer !== LAYER.STREET) return;
      if (level < 4) return;
      const d = Math.hypot(n.x - player.x, n.y - player.y);
      const triggeredByExposure = level >= 4 && d < 190;
      const triggeredByMessyHunt = state.targetFed && player.exposure >= 80 && d < 150;
      const triggeredByDash = player.dashFlash > 0 && d < 120;
      const triggeredByBeast = beastStage().level >= 3 && d < 155 && publicWitnesses(110) > 0;
      const nearbyBlood = state.bloodStains.find(s => !s.cleaned && s.layer === LAYER.STREET && Math.hypot(s.x - n.x, s.y - n.y) < (s.brutal ? 230 : 145));
      const triggeredByBlood = Boolean(nearbyBlood && (stainIsSeriousForHunters(nearbyBlood)));`
);

replaceOnce(
  "add hunter blood seriousness helper",
  /function maybeRevealHunter\(n, level\) \{/,
  `function stainIsSeriousForHunters(stain) {
      return Boolean(stain && (stain.brutal || stain.discovered || stain.age < 18));
    }

    function maybeRevealHunter(n, level) {`
);

replaceOnce(
  "spawn hunters only at critical exposure",
  /if \(level >= 3\) \{\n        const desiredHunters = Math\.min\(BALANCE\.maxHunters, Math\.max\(1, level - 3\)\);/,
  `if (level >= 4) {
        const desiredHunters = Math.min(BALANCE.maxHunters, Math.max(1, level - 3));`
);

replaceOnce(
  "remove camera draw call",
  /\n      drawCameras\(\);/,
  ""
);

replaceOnce(
  "draw cameras disabled",
  /function drawCameras\(\) \{[\s\S]*?\n    \}\n\n    function drawRoad/,
  `function drawCameras() {
      // Removed: no fixed surveillance cameras in the prototype.
    }

    function drawRoad`
);

replaceOnce(
  "camera update disabled",
  /function updateCameras\(dt\) \{[\s\S]*?\n    \}\n\n    function updateDynamicEvents/,
  `function updateCameras(dt) {
      // Removed: the wanted system now comes from witnesses, police dispatch and hunter escalation.
    }

    function updateDynamicEvents`
);

replaceOnce(
  "camera terminology in report alert tags",
  /if \(r\.includes\("camera"\) \|\| r\.includes\("record"\)\) return "camera";\n/,
  ""
);

replaceOnce(
  "blood sense copy removes cameras",
  /say\(`Blood Sense \[\+\$\{senseHunger\} hunger\]: the journalist, isolated civilians, trails, hunters and routes glow for a few seconds\.\$\{hungerWarning\}`, hungerWarning \? 3\.8 : 3\.2\);/,
  `say(\`Blood Sense [+\${senseHunger} hunger]: the journalist, isolated civilians, trails, hunters and escape routes glow for a few seconds.\${hungerWarning}\`, hungerWarning ? 3.8 : 3.2);`
);

fs.writeFileSync(file, code);
console.log("Wanted/camera rules patched.");
