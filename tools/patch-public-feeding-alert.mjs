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

insertAfter(
  "force exposure helper",
  `    function addExposure(amount, reason) {
      if (amount <= 0) return;
      const before = exposureLevel();
      const beast = beastStage();
      const multiplier = player.inSafehouse ? 1 : beast.exposureMul;
      const finalAmount = Math.max(1, Math.round(amount * multiplier));
      player.exposure = clamp(player.exposure + finalAmount, 0, 100);
      addLocalHeat(finalAmount * 0.42, null, player.x, player.y, player.layer);
      const after = exposureLevel();
      if (reason) {
        state.lastAlert = { text: reason, tag: alertTag(reason), timer: 5.0 };
        AudioBus.play("alert", Math.min(1.6, 0.8 + finalAmount / 18));
        say(\`ALERT (\${alertTag(reason)}): \${reason}\`, 3.5);
      }
      if (beast.level >= 2 && finalAmount > amount + 1 && state.messageTimer <= 3.4) {
        say(\`\${reason || "Risky action"} The Beast makes it harder to hide.\`, 3.5);
      }
      if (after > before) {
        if (after === 1) say("Exposure 1: civilians get nervous. You are not wanted yet.", 3);
        if (after === 2) { AudioBus.play("police", 1.0); say("Exposure 2: police are dispatched. The chase can start.", 3); }
        if (after === 3) { AudioBus.play("police", 1.15); say("Exposure 3: police pressure rises. Escape routes matter.", 3); }
        if (after === 4) { AudioBus.play("hunterReveal", 0.85); say("Exposure 4: the situation is too strange. Hunters start paying attention.", 3); }
        if (after >= 5) { AudioBus.play("alert", 1.4); say("Blood hunt level: the district is no longer treating this as normal crime.", 3); }
      }
    }
`,
  `

    function forceExposureLevel(minLevel, reason = "") {
      const target = clamp(minLevel * BALANCE.exposurePerLevel, 0, 100);
      if (player.exposure >= target) return false;
      const before = exposureLevel();
      player.exposure = Math.max(player.exposure, target);
      addLocalHeat(10 + minLevel * 5, reason || null, player.x, player.y, player.layer);
      const after = exposureLevel();
      if (reason) {
        state.lastAlert = { text: reason, tag: "exposure", timer: 5.0 };
        AudioBus.play(after >= 3 ? "police" : "alert", 1.1);
        say(reason, 3.5);
      }
      return after > before;
    }
`
);

insertAfter(
  "public feeding alarm helper",
  `    function startFeeding(victim) {
`,
  `    function escalatePublicFeeding(witnesses, victim, phase = "seen") {
      if (!witnesses || witnesses <= 0 || player.layer !== LAYER.STREET || player.inSafehouse) return;
      const beast = beastStage();
      const isTarget = victim && victim.type === "target";
      const gain = phase === "finish"
        ? 22 + witnesses * 10 + (isTarget ? 8 : 0) + (beast.level >= 2 ? 8 : 0)
        : 12 + witnesses * 6 + (beast.level >= 2 ? 5 : 0);
      addLocalHeat(22 + witnesses * 8, "public feeding", player.x, player.y, player.layer);
      addExposure(gain, phase === "finish"
        ? `PUBLIC FEEDING: ${witnesses} witness(es) saw the body drop. The street explodes into panic.`
        : `PUBLIC FEEDING: ${witnesses} witness(es) see the vampire feed. Alarms spread fast.`);
      forceExposureLevel(witnesses >= 3 || beast.level >= 2 || phase === "finish" ? 3 : 2,
        phase === "finish" ? "Public feeding completed: police response escalates." : "Public feeding spotted: wanted level jumps.");
      callPoliceAttention(player.x, player.y, player.layer, "public feeding in the street", 1.6 + witnesses * 0.35);
    }

`
);

replace(
  "public feeding seen escalation",
  /if \(!f\.seenNotified\) \{\n\s*f\.seenNotified = true;\n\s*createNoise\(player\.x, player\.y, player\.layer, 112, 3\.2, "feed", \{ exposure: false \}\);\n\s*addExposure\(3 \+ witnesses\.length \* 2, "A witness sees the feeding and runs to report it\."\);\n\s*\}/,
  `if (!f.seenNotified) {
          f.seenNotified = true;
          createNoise(player.x, player.y, player.layer, 146, 4.6, "feed", { exposure: false });
          escalatePublicFeeding(witnesses.length, victim, "seen");
        }`
);

replace(
  "public feeding completion escalation",
  /exposureGain = 9 \+ witnesses \* 6;\n\s*if \(hungerBefore > 75\) exposureGain \+= 4;\n\s*say\(`Elimination complete: hunger -\$\{hungerDrop\}% with \$\{witnesses\} witness\(es\)\.`\, 3\);/,
  `exposureGain = 20 + witnesses * 10;
        if (hungerBefore > 75) exposureGain += 8;
        say(`PUBLIC FEEDING: hunger -${hungerDrop}% with ${witnesses} witness(es). The district panics.`, 3.6);`
);

replace(
  "public feeding post-completion force level",
  /addExposure\(exposureGain, exposureGain > 0 \? "The Masquerade cracks: exposure rises\." : ""\);/,
  `addExposure(exposureGain, exposureGain > 0 ? "The Masquerade cracks: exposure rises." : "");
      if (witnesses > 0 && victim.type !== "rat") escalatePublicFeeding(witnesses, victim, "finish");`
);

if (!changed) {
  console.log("No public feeding alert changes needed.");
} else {
  fs.writeFileSync(file, code);
  console.log("Public feeding alert patch applied.");
}
