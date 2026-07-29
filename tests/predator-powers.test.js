import test from "node:test";
import assert from "node:assert/strict";

import { COMBAT_STATES } from "../phaser/src/data/combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import {
  BEAST_STATES,
  WHISPER_COMMANDS,
  beastModifiers,
  beastStateForHunger,
  bloodSenseReading,
  evaluateWhisperCommand,
  whisperCommandAvailability
} from "../phaser/src/data/predator-powers.js";

function npc(overrides = {}) {
  return {
    id: "civilian-1",
    type: NPC_TYPES.CIVILIAN,
    x: 50,
    y: 0,
    layer: 0,
    inactive: false,
    dead: false,
    hiddenBody: false,
    intercepted: false,
    alarmed: false,
    hasReported: false,
    combat: {
      state: COMBAT_STATES.ACTIVE,
      resilience: 2,
      maxResilience: 2
    },
    ...overrides
  };
}

test("Hunger creates four readable Beast pressure states without random control loss", () => {
  assert.equal(beastStateForHunger(0), BEAST_STATES.CONTROLLED);
  assert.equal(beastStateForHunger(49.9), BEAST_STATES.CONTROLLED);
  assert.equal(beastStateForHunger(50), BEAST_STATES.STRAINED);
  assert.equal(beastStateForHunger(70), BEAST_STATES.RAVENOUS);
  assert.equal(beastStateForHunger(85), BEAST_STATES.CRITICAL);

  const controlled = beastModifiers(20);
  const critical = beastModifiers(92);
  const burst = beastModifiers(92, { givenIn: true });
  assert.ok(critical.feedingMultiplier > controlled.feedingMultiplier);
  assert.ok(critical.heartbeatIntensity > controlled.heartbeatIntensity);
  assert.ok(critical.whisperPower < controlled.whisperPower);
  assert.ok(burst.movementMultiplier > 1);
  assert.ok(burst.feedingMultiplier > critical.feedingMultiplier);
  assert.equal(burst.meleeDamageBonus, 1);
});

test("Blood Sense distinguishes heartbeats, wounds, feeding outcomes and silence", () => {
  const player = { x: 0, y: 0 };
  assert.equal(bloodSenseReading(npc(), { player, hunger: 20 }).kind, "heartbeat");
  assert.equal(bloodSenseReading(npc({ combat: { state: COMBAT_STATES.ACTIVE, resilience: 1, maxResilience: 3 } }), { player }).kind, "wounded");
  assert.equal(bloodSenseReading(npc({ feedingDepth: "quick_bite" }), { player }).kind, "bitten");
  assert.equal(bloodSenseReading(npc({ feedingUnconscious: true }), { player }).kind, "unconscious");
  assert.equal(bloodSenseReading(npc({ dead: true, deathKind: "drained", feedingDepth: "drain" }), { player }).kind, "drained");
  const silent = bloodSenseReading(npc({ noHeartbeat: true }), { player });
  assert.equal(silent.kind, "silent");
  assert.equal(silent.heartbeat, false);
});

test("Blood Sense never invents protected-prey knowledge", () => {
  const subject = npc();
  const unknown = bloodSenseReading(subject, { player: { x: 0, y: 0 }, protectionKnown: false });
  const learned = bloodSenseReading(subject, { player: { x: 0, y: 0 }, protectionKnown: true });
  assert.equal(unknown.protectionKnown, false);
  assert.equal(unknown.protectedLabel, null);
  assert.equal(learned.protectionKnown, true);
  assert.equal(learned.protectedLabel, "PROTECTED");
});

test("Whisper commands are contextual and resistance is deterministic", () => {
  const calmCivilian = npc();
  const come = evaluateWhisperCommand(WHISPER_COMMANDS.COME_HERE, calmCivilian, { hunger: 20 });
  assert.equal(come.availability.available, true);
  assert.equal(come.succeeds, true);

  const alarmed = npc({ alarmed: true, reportTarget: { id: "police" } });
  assert.equal(whisperCommandAvailability(WHISPER_COMMANDS.COME_HERE, alarmed).available, false);
  assert.equal(whisperCommandAvailability(WHISPER_COMMANDS.STAY_CALM, alarmed).available, true);

  const forgetContext = { latentMemoryIds: ["memory-1"] };
  const forgetControlled = evaluateWhisperCommand(WHISPER_COMMANDS.FORGET_THIS, alarmed, {
    hunger: 20,
    ...forgetContext
  });
  const forgetCritical = evaluateWhisperCommand(WHISPER_COMMANDS.FORGET_THIS, alarmed, {
    hunger: 92,
    ...forgetContext
  });
  assert.equal(forgetControlled.succeeds, true);
  assert.equal(forgetCritical.succeeds, false);
});

test("trained hunters are immune and ordinary police cannot be called off without a susceptible authority context", () => {
  const hunter = npc({ type: NPC_TYPES.HUNTER });
  assert.equal(evaluateWhisperCommand(WHISPER_COMMANDS.WALK_AWAY, hunter, { hunger: 0 }).availability.available, false);

  const officer = npc({ id: "police-1", type: NPC_TYPES.POLICE });
  assert.equal(whisperCommandAvailability(WHISPER_COMMANDS.CALL_THEM_OFF, officer, {
    heatLevel: 2,
    canCallOff: false
  }).available, false);
  const compromised = evaluateWhisperCommand(WHISPER_COMMANDS.CALL_THEM_OFF, {
    ...officer,
    compromised: true,
    whisperAuthority: true
  }, {
    hunger: 10,
    heatLevel: 2,
    canCallOff: true,
    susceptible: true
  });
  assert.equal(compromised.availability.available, true);
  assert.equal(compromised.succeeds, true);
});


test("Stay calm cannot retract a completed report", () => {
  const reported = npc({
    alarmed: true,
    hasReported: true,
    reportTarget: { id: "police" }
  });
  const availability = whisperCommandAvailability(WHISPER_COMMANDS.STAY_CALM, reported);
  assert.equal(availability.available, false);
  assert.match(availability.reason, /already left/i);
});
