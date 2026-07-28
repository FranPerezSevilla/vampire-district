import test from "node:test";
import assert from "node:assert/strict";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import {
  FEEDING_DEPTHS,
  deepestFeedingDepthAt,
  feedingDepthRank,
  feedingDurationFor,
  feedingIncrementalRelief,
  feedingOutcomeFor,
  feedingThresholdFor,
  nextFeedingDepth
} from "../phaser/src/data/feeding.js";

test("held feeding exposes Quick Bite, Full Feed and Drain in deterministic order", () => {
  assert.equal(feedingDepthRank(FEEDING_DEPTHS.NONE), 0);
  assert.equal(feedingDepthRank(FEEDING_DEPTHS.QUICK_BITE), 1);
  assert.equal(feedingDepthRank(FEEDING_DEPTHS.FULL_FEED), 2);
  assert.equal(feedingDepthRank(FEEDING_DEPTHS.DRAIN), 3);

  assert.equal(feedingThresholdFor(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.QUICK_BITE), 0.65);
  assert.equal(feedingThresholdFor(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.FULL_FEED), 1.65);
  assert.equal(feedingDurationFor(NPC_TYPES.CIVILIAN), 3);

  assert.equal(deepestFeedingDepthAt(0.64, NPC_TYPES.CIVILIAN), FEEDING_DEPTHS.NONE);
  assert.equal(deepestFeedingDepthAt(0.65, NPC_TYPES.CIVILIAN), FEEDING_DEPTHS.QUICK_BITE);
  assert.equal(deepestFeedingDepthAt(1.64, NPC_TYPES.CIVILIAN), FEEDING_DEPTHS.QUICK_BITE);
  assert.equal(deepestFeedingDepthAt(1.65, NPC_TYPES.CIVILIAN), FEEDING_DEPTHS.FULL_FEED);
  assert.equal(deepestFeedingDepthAt(3, NPC_TYPES.CIVILIAN), FEEDING_DEPTHS.DRAIN);
});

test("continued feeding starts after the victim's previous depth and cannot farm Hunger", () => {
  assert.equal(nextFeedingDepth(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.NONE), FEEDING_DEPTHS.QUICK_BITE);
  assert.equal(nextFeedingDepth(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.QUICK_BITE), FEEDING_DEPTHS.FULL_FEED);
  assert.equal(nextFeedingDepth(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.FULL_FEED), FEEDING_DEPTHS.DRAIN);
  assert.equal(nextFeedingDepth(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.DRAIN), null);

  assert.equal(feedingIncrementalRelief(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.QUICK_BITE), 14);
  assert.equal(feedingIncrementalRelief(
    NPC_TYPES.CIVILIAN,
    FEEDING_DEPTHS.FULL_FEED,
    FEEDING_DEPTHS.QUICK_BITE
  ), 20);
  assert.equal(feedingIncrementalRelief(
    NPC_TYPES.CIVILIAN,
    FEEDING_DEPTHS.DRAIN,
    FEEDING_DEPTHS.FULL_FEED
  ), 24);
  assert.equal(14 + 20 + 24, 58);
  assert.equal(feedingIncrementalRelief(
    NPC_TYPES.CIVILIAN,
    FEEDING_DEPTHS.QUICK_BITE,
    FEEDING_DEPTHS.QUICK_BITE
  ), 0);
});

test("each human feeding depth has a distinct victim and evidence outcome", () => {
  const quick = feedingOutcomeFor(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.QUICK_BITE);
  assert.deepEqual(quick, {
    victimOutcome: "disoriented",
    victimAlive: true,
    victimConscious: true,
    bodyEvidence: false,
    biteEvidence: true,
    memoryState: "partial",
    bloodStains: 0,
    neutralized: false,
    lethal: false,
    recoverableVictim: false
  });

  const full = feedingOutcomeFor(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.FULL_FEED);
  assert.equal(full.victimOutcome, "unconscious");
  assert.equal(full.victimAlive, true);
  assert.equal(full.victimConscious, false);
  assert.equal(full.bodyEvidence, false);
  assert.equal(full.biteEvidence, true);
  assert.equal(full.bloodStains, 1);
  assert.equal(full.neutralized, true);

  const drain = feedingOutcomeFor(NPC_TYPES.CIVILIAN, FEEDING_DEPTHS.DRAIN);
  assert.equal(drain.victimOutcome, "dead");
  assert.equal(drain.victimAlive, false);
  assert.equal(drain.bodyEvidence, true);
  assert.equal(drain.biteEvidence, true);
  assert.equal(drain.bloodStains, 3);
  assert.equal(drain.lethal, true);
});

test("rats retain one simplified exempt feed outcome", () => {
  assert.equal(feedingThresholdFor(NPC_TYPES.RAT, FEEDING_DEPTHS.QUICK_BITE), null);
  assert.equal(feedingDurationFor(NPC_TYPES.RAT), 1);
  assert.equal(deepestFeedingDepthAt(0.99, NPC_TYPES.RAT), FEEDING_DEPTHS.NONE);
  assert.equal(deepestFeedingDepthAt(1, NPC_TYPES.RAT), FEEDING_DEPTHS.DRAIN);
  assert.equal(feedingIncrementalRelief(NPC_TYPES.RAT, FEEDING_DEPTHS.DRAIN), 12);

  const outcome = feedingOutcomeFor(NPC_TYPES.RAT, FEEDING_DEPTHS.DRAIN);
  assert.equal(outcome.victimAlive, false);
  assert.equal(outcome.bodyEvidence, false);
  assert.equal(outcome.biteEvidence, false);
});
