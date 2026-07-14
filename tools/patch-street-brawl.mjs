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

function insertAfter(label, marker, insertion) {
  if (code.includes(insertion.trim().split("\n")[0].trim())) {
    console.log(`Already present: ${label}`);
    return false;
  }
  const idx = code.indexOf(marker);
  if (idx < 0) {
    console.warn(`Skipped: ${label}`);
    return false;
  }
  const end = idx + marker.length;
  code = code.slice(0, end) + insertion + code.slice(end);
  changed = true;
  console.log(`Patched: ${label}`);
  return true;
}

replace(
  "NPC hostile fields",
  /alertTimer: 0,\n\s*dragged: false,/,
  `alertTimer: 0,
        hostileTimer: 0,
        hostileAttackCooldown: 0,
        hostileSource: "",
        dragged: false,`
);

insertAfter(
  "street brawl helpers",
  `    function alarmCivilianWitnesses(witnesses, reason, severity = 14) {
      for (const n of witnesses) {
        if (n.type === "civilian" || n.type === "target") alarmWitness(n, reason, severity);
      }
    }
`,
  `

    function nearestHostileCivilian(range = 24) {
      let best = null;
      let bestD = Infinity;
      for (const n of npcs) {
        if (n.dead || n.stunned || n.hiddenBody || n.hostileTimer <= 0) continue;
        if (n.type !== "civilian" && n.type !== "target") continue;
        if (n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        if (d < range && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    function shoveHostileCivilian(n) {
      if (!n || n.dead || n.hostileTimer <= 0) return false;
      n.hostileTimer = Math.max(0, n.hostileTimer - 4.2);
      n.hostileAttackCooldown = 1.2;
      n.stunned = true;
      n.waitTimer = 0.85;
      n.fleeTimer = Math.max(n.fleeTimer, 1.6);
      n.suspiciousTimer = 0;
      const dx = n.x - player.x;
      const dy = n.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = n.x + (dx / len) * 18;
      const ny = n.y + (dy / len) * 18;
      if (canStandAt(nx, ny, n.layer, false)) { n.x = nx; n.y = ny; }
      addExposure(2, "A street scuffle draws attention.");
      say("You shove the angry pedestrian away. Time to move.", 1.8);
      return true;
    }

    function provokeStreetBrawlers(x, y, witnesses = []) {
      const candidates = witnesses.filter(n =>
        n.type === "civilian" && !n.dead && !n.stunned && !n.hiddenBody &&
        n.layer === LAYER.STREET && n.hostileTimer <= 0 &&
        Math.hypot(n.x - x, n.y - y) < 125
      );
      if (!candidates.length) return 0;
      candidates.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
      const angry = candidates[0];
      if (Math.random() > 0.45) return 0;
      angry.hostileTimer = 6.5 + Math.random() * 3.5;
      angry.hostileAttackCooldown = 0.65;
      angry.hostileSource = "streetlight vandalism";
      angry.alarmed = false;
      angry.hasReported = false;
      angry.fleeTimer = 0;
      angry.suspiciousTimer = 1.2;
      angry.waitTimer = 0;
      angry.aiTimer = 0;
      say("A pedestrian takes the vandalism personally and comes at you.", 2.4);
      return 1;
    }

    function updateHostileCivilian(n, dt) {
      if (!n.hostileTimer || n.hostileTimer <= 0 || n.dead || n.stunned) return false;
      if (player.inSafehouse || player.layer !== n.layer) {
        n.hostileTimer = Math.max(0, n.hostileTimer - dt * 2.0);
        return false;
      }

      n.hostileTimer = Math.max(0, n.hostileTimer - dt);
      n.hostileAttackCooldown = Math.max(0, (n.hostileAttackCooldown || 0) - dt);
      n.alarmed = false;
      n.fleeTimer = 0;
      n.suspiciousTimer = Math.max(n.suspiciousTimer || 0, 0.35);

      const ax = player.x - n.x;
      const ay = player.y - n.y;
      const len = Math.hypot(ax, ay) || 1;
      n.dirX = ax / len;
      n.dirY = ay / len;

      if (len > 16) {
        moveEntity(n, (ax / len) * n.speed * 2.05, (ay / len) * n.speed * 2.05, dt);
      } else if (n.hostileAttackCooldown <= 0) {
        n.hostileAttackCooldown = 1.65;
        const px = player.x + (ax / -len) * 22;
        const py = player.y + (ay / -len) * 22;
        if (canStandAt(px, py)) { player.x = px; player.y = py; }
        addExposure(2, "A pedestrian swings at you and the street notices.");
        say("A furious pedestrian shoves you back.", 1.5);
      }

      if (n.hostileTimer <= 0) {
        n.fleeTimer = Math.max(n.fleeTimer, 1.8);
        say("The pedestrian loses nerve and backs off.", 1.6);
      }
      return true;
    }
`
);

replace(
  "handle action can shove hostile pedestrian",
  /      const alarmed = nearestAlarmedWitness\(\);\n      if \(alarmed\) \{\n        interceptWitness\(alarmed\);\n        return;\n      \}\n\n      const victim = nearestFeedable\(\);/,
  `      const alarmed = nearestAlarmedWitness();
      if (alarmed) {
        interceptWitness(alarmed);
        return;
      }

      const hostile = nearestHostileCivilian();
      if (hostile) {
        shoveHostileCivilian(hostile);
        return;
      }

      const victim = nearestFeedable();`
);

replace(
  "hostile civilian update priority",
  /      if \(updateAlarmedWitness\(n, dt\)\) return;\n      if \(n\.fleeTimer > 0\) n\.fleeTimer -= dt;/,
  `      if (updateAlarmedWitness(n, dt)) return;
      if (updateHostileCivilian(n, dt)) return;
      if (n.fleeTimer > 0) n.fleeTimer -= dt;`
);

replace(
  "lamp break can provoke pedestrian",
  /      const witnesses = visibleWitnessList\(145\)\.filter\(w => w\.type !== "hunter"\);\n      addLocalHeat/,
  `      const witnesses = visibleWitnessList(145).filter(w => w.type !== "hunter");
      provokeStreetBrawlers(light.x, light.y, witnesses);
      addLocalHeat`
);

replace(
  "context prompt hostile",
  /      const victim = nearestFeedable\(\);\n      if \(victim\) \{/,
  `      const hostile = nearestHostileCivilian();
      if (hostile) return "E: shove angry pedestrian away";
      const victim = nearestFeedable();
      if (victim) {`
);

replace(
  "draw hostile color",
  /        if \(n\.luredTimer > 0\) c = "#d7c8ff";\n/,
  `        if (n.luredTimer > 0) c = "#d7c8ff";
        if (n.hostileTimer > 0) c = "#ff5c35";
`
);

replace(
  "draw hostile marker",
  /        if \(n\.alarmed && !n\.hasReported\) \{\n          ctx\.fillStyle = "#ff3b50";\n          ctx\.fillRect\(Math\.floor\(n\.x - 1\), Math\.floor\(n\.y - 16\), 2, 7\);\n          ctx\.fillRect\(Math\.floor\(n\.x - 1\), Math\.floor\(n\.y - 7\), 2, 2\);\n        \} else if \(n\.luredTimer > 0\) \{/,
  `        if (n.hostileTimer > 0) {
          ctx.fillStyle = "#ff5c35";
          ctx.fillRect(Math.floor(n.x - 3), Math.floor(n.y - 16), 6, 2);
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 14), 2, 5);
        } else if (n.alarmed && !n.hasReported) {
          ctx.fillStyle = "#ff3b50";
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 16), 2, 7);
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 7), 2, 2);
        } else if (n.luredTimer > 0) {`
);

replace(
  "blood sense hostile marker",
  /        else if \(n\.alarmed && !n\.hasReported && d < 300\) drawSenseMarker\(n\.x, n\.y, "witness", "#ff3b50", true\);\n/,
  `        else if (n.hostileTimer > 0 && d < 300) drawSenseMarker(n.x, n.y, "angry", "#ff5c35", true);
        else if (n.alarmed && !n.hasReported && d < 300) drawSenseMarker(n.x, n.y, "witness", "#ff3b50", true);
`
);

if (!changed) {
  console.log("No changes needed.");
} else {
  fs.writeFileSync(file, code);
  console.log("Street brawl rules patched.");
}
