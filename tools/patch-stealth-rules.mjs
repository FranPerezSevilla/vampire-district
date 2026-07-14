import fs from "node:fs";

const file = "js/game.js";
let code = fs.readFileSync(file, "utf8");

function replaceOnce(label, pattern, replacement) {
  const next = code.replace(pattern, replacement);
  if (next === code) {
    throw new Error(`Patch failed: ${label}`);
  }
  code = next;
  console.log(`Patched: ${label}`);
}

replaceOnce(
  "whisper should not alarm witnesses or cameras",
  /\n\s*\/\/ The whisper is a subtle power, not a free button:[\s\S]*?\n\s*if \(witnesses > 0\) \{[\s\S]*?\n\s*\} else \{\n\s*const baseMessage = target\.type === "target"[\s\S]*?\n\s*say\(`\$\{baseMessage\}\$\{hungerWarning\}`, hungerWarning \? 3\.4 : 2\.6\);\n\s*\}\n\s*\}/,
  `
      // Whisper is intentionally subtle: it should lure the target without making bystanders suspicious.
      // Its cost is hunger and positioning, not automatic witness suspicion.
      target.luredTimer = target.type === "target" ? 7.5 : 4.5;
      state.usedWhisper = true;
      if (target.type === "target") state.targetLured = true;
      target.fleeTimer = 0;
      target.stunned = false;
      target.waitTimer = 0;
      target.aiTimer = 0.2;
      target.suspiciousTimer = 0;
      player.lureCooldown = 5.5 * beastStage().whisperCooldownMul;

      const baseMessage = target.type === "target"
        ? \`You whisper to the target [+\${whisperHunger} hunger]. They will follow you for a few seconds.\`
        : \`You whisper to a civilian [+\${whisperHunger} hunger]. They approach, confused.\`;
      say(\`\${baseMessage}\${hungerWarning}\`, hungerWarning ? 3.4 : 2.6);
    }`
);

replaceOnce(
  "dragging bodies should not create noise or blood trails",
  /\n\s*if \(!player\.inSafehouse && player\.layer === LAYER\.STREET && state\.dragNoiseTimer <= 0\) \{[\s\S]*?\n\s*\}\n\s*if \(!player\.inSafehouse && state\.dragBloodTimer <= 0\) \{[\s\S]*?\n\s*\}\n\s*const witnesses = visibleWitnessList\(145, body\)\.filter\(w => w !== body\);/,
  `
      // Dragging a body is visually risky if someone sees it, but it should not emit automatic noise
      // or create blood trails. Evidence comes from the corpse being visible, not from a passive trail.
      const witnesses = visibleWitnessList(145, body).filter(w => w !== body);`
);

fs.writeFileSync(file, code);
console.log("Stealth/evidence rules patched.");
