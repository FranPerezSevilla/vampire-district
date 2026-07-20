import test from "node:test";
import assert from "node:assert/strict";
import { CampaignCheckpointSystem } from "../phaser/src/campaign/CampaignCheckpointSystem.js";
import { CampaignEventBus } from "../phaser/src/campaign/CampaignEventBus.js";
import { createCampaignState } from "../phaser/src/campaign/CampaignState.js";
import { MissionRunner } from "../phaser/src/campaign/MissionRunner.js";
import { ReputationSystem } from "../phaser/src/campaign/ReputationSystem.js";
import { WalletSystem } from "../phaser/src/campaign/WalletSystem.js";
import { CAMPAIGN_EVENT_TYPES, MISSION_STATUS } from "../phaser/src/campaign/constants.js";
import { cleanTheSceneMission } from "../phaser/src/campaign/missions/cleanTheScene.js";
import {
  SILENCE_THE_JOURNALIST_ID,
  silenceTheJournalistMission
} from "../phaser/src/campaign/missions/silenceTheJournalist.js";

function fixture(definitions = [silenceTheJournalistMission, cleanTheSceneMission]) {
  let now = 10_000;
  const state = createCampaignState({ now });
  const events = new CampaignEventBus(state, { now: () => now++ });
  const wallet = new WalletSystem(state, { events, now: () => now++ });
  const reputation = new ReputationSystem(state, { events });
  const checkpoints = new CampaignCheckpointSystem(state, { events, now: () => now++ });
  const runner = new MissionRunner(state, {
    definitions,
    events,
    wallet,
    reputation,
    checkpoints,
    now: () => now++
  });
  return { state, events, wallet, reputation, checkpoints, runner };
}

function completeJournalistMission(runner, outcome = "killed") {
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" }), true);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" }), true);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" }), true);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, { targetId: "journalist", outcome }), true);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.RETURNED, { refugeId: "rooftop_refuge" }), true);
}

test("journalist mission progresses only through matching typed events", () => {
  const { runner } = fixture();
  const started = runner.start(SILENCE_THE_JOURNALIST_ID);
  assert.equal(started.currentObjective.id, "reach_police_roof");

  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" }), false);
  assert.equal(runner.currentObjective().id, "reach_police_roof");
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" }), true);
  assert.equal(runner.currentObjective().id, "speak_to_informant");
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "wrong_contact" }), false);
  assert.equal(runner.currentObjective().id, "speak_to_informant");
});

test("objective activation captures authored stable checkpoints", () => {
  const { checkpoints, runner } = fixture();
  runner.start(SILENCE_THE_JOURNALIST_ID);
  assert.equal(checkpoints.snapshot().id, "journalist_mission_start");
  assert.equal(checkpoints.snapshot().locationId, "rooftop_refuge");

  runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
  // Informant dialogue is intentionally not a safe checkpoint. Reloading here
  // restarts the compact tutorial rather than reconstructing a half-open scene.
  assert.equal(checkpoints.snapshot().id, "journalist_mission_start");

  runner.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
  assert.equal(checkpoints.snapshot().id, "journalist_tip_acquired");
  assert.equal(checkpoints.snapshot().objectiveId, "reach_nightclub");
  assert.equal(checkpoints.snapshot().locationId, "police_roof");

  runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });
  assert.equal(checkpoints.snapshot().id, "journalist_target_reached");
  runner.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, { targetId: "journalist", outcome: "drained" });
  assert.equal(checkpoints.snapshot().id, "journalist_handled");
  assert.equal(checkpoints.snapshot().payload.previousOutcome, "drained");
});

test("killed and drained outcomes both complete the journalist mission", () => {
  for (const outcome of ["killed", "drained"]) {
    const { state, wallet, reputation, checkpoints, runner } = fixture();
    runner.start(SILENCE_THE_JOURNALIST_ID);
    completeJournalistMission(runner, outcome);

    const record = state.missions.records[SILENCE_THE_JOURNALIST_ID];
    assert.equal(record.status, MISSION_STATUS.COMPLETED);
    assert.equal(record.objectives.neutralize_journalist.outcome, outcome);
    assert.equal(state.missions.activeMissionId, null);
    assert.deepEqual(state.missions.completed, [SILENCE_THE_JOURNALIST_ID]);
    assert.equal(wallet.balance(), 500);
    assert.equal(reputation.faction("blackglass_directorate"), 5);
    assert.equal(reputation.contact("your_sire"), 1);
    assert.equal(state.world.flags.journalist_silenced, true);
    assert.equal(checkpoints.snapshot().id, "journalist_report_accepted");
    assert.equal(checkpoints.snapshot().locationId, "rooftop_refuge");
  }
});

test("invalid neutralization outcome cannot advance the mission", () => {
  const { runner } = fixture();
  runner.start(SILENCE_THE_JOURNALIST_ID);
  runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
  runner.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
  runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });

  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
    targetId: "journalist",
    outcome: "escaped"
  }), false);
  assert.equal(runner.currentObjective().id, "neutralize_journalist");
});

test("mission rewards remain idempotent across standalone replay", () => {
  const { state, wallet, runner } = fixture();
  runner.start(SILENCE_THE_JOURNALIST_ID);
  completeJournalistMission(runner);
  assert.equal(wallet.balance(), 500);
  assert.equal(runner.completeMission(), false);
  assert.equal(wallet.balance(), 500);
  assert.equal(state.ledger.length, 1);
  assert.throws(() => runner.start(SILENCE_THE_JOURNALIST_ID), /not replayable/);

  const replay = runner.start(SILENCE_THE_JOURNALIST_ID, { replay: true });
  assert.equal(replay.rewardsGranted, true);
  completeJournalistMission(runner, "drained");
  assert.equal(wallet.balance(), 500);
  assert.equal(state.ledger.length, 1);
  assert.equal(state.missions.records[SILENCE_THE_JOURNALIST_ID].completionCount, 2);
});

test("failing a mission records reason without granting rewards", () => {
  const { state, wallet, runner } = fixture();
  runner.start(SILENCE_THE_JOURNALIST_ID);
  assert.equal(runner.fail("The Veil was broken.", { source: "witness" }), true);
  const record = state.missions.records[SILENCE_THE_JOURNALIST_ID];
  assert.equal(record.status, MISSION_STATUS.FAILED);
  assert.equal(record.failureReason, "The Veil was broken.");
  assert.equal(state.missions.activeMissionId, null);
  assert.equal(wallet.balance(), 0);
  assert.deepEqual(state.missions.failed, [SILENCE_THE_JOURNALIST_ID]);
});

test("Clean the Scene is authored entirely through the same generic runner", () => {
  const { state, wallet, reputation, checkpoints, runner } = fixture();
  runner.start("clean_the_scene");
  assert.equal(checkpoints.snapshot().id, "clean_scene_start");
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "club_service_alley" }), true);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.COLLECTED, { itemId: "compromised_camera_roll" }), true);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.DESTROYED, { entityId: "exposed_body" }), true);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.WANTED_CHANGED, { level: 2 }), false);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.WANTED_CHANGED, { level: 0 }), true);
  assert.equal(runner.handle(CAMPAIGN_EVENT_TYPES.RETURNED, { refugeId: "rooftop_refuge" }), true);

  assert.equal(state.missions.records.clean_the_scene.status, MISSION_STATUS.COMPLETED);
  assert.equal(wallet.balance(), 275);
  assert.equal(reputation.contact("directorate_cleaner"), 3);
  assert.equal(state.world.flags.cleaner_contact_unlocked, true);
  assert.equal(checkpoints.snapshot().id, "clean_scene_complete");
});
