import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { civilianTrafficPlayerImpact } from "../phaser/src/streaming/TrafficLocalBehaviorSystem.js";

const slot = { x: 100, y: 100, angle: 0, archetype: { width: 30, height: 14 } };

test("civilian traffic keeps clear non-collisions harmless", () => {
  assert.equal(civilianTrafficPlayerImpact(slot, { x: 150, y: 100 }, 70), null);
});

test("a near-stopped civilian car can overlap without damaging the player", () => {
  const impact = civilianTrafficPlayerImpact(slot, { x: 108, y: 100 }, 12);
  assert.ok(impact);
  assert.equal(impact.damage, 0);
  assert.equal(impact.pushDistance, 0);
});

test("a real-speed civilian collision produces bounded Vitality damage and a shove", () => {
  const impact = civilianTrafficPlayerImpact(slot, { x: 108, y: 100 }, 68);
  assert.ok(impact);
  assert.ok(impact.damage >= 10 && impact.damage <= 22);
  assert.ok(impact.pushDistance >= 8 && impact.pushDistance <= 18);
  assert.deepEqual(impact.direction, { x: 1, y: 0 });
});

test("runtime brakes for an on-foot player before allowing fortuitous traffic impact damage", () => {
  const code = readFileSync(new URL("../phaser/src/streaming/TrafficLocalBehaviorSystem.js", import.meta.url), "utf8");
  assert.match(code, /reason: "player-on-foot"/);
  assert.match(code, /processPlayerImpact\(slot, state\)/);
  assert.match(code, /playerDamageSystem\?\.damagePlayer\?/);
  assert.match(code, /damageKind: "vehicle"/);
  assert.match(code, /"traffic:player-impact"/);
});
