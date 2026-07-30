import test from "node:test";
import assert from "node:assert/strict";
import { buildPlaytestFeedbackPayload } from "../phaser/src/playtest/PlaytestFeedback.js";
import {
  PLAYTEST_STATUS,
  advancePlaytestSession,
  createPlaytestSessionState,
  playtestObjectiveText,
  playtestResult,
  startPlaytestSession
} from "../phaser/src/playtest/PlaytestSessionModel.js";

function observation(overrides = {}) {
  return {
    dt: 1,
    hunger: 72,
    feedCount: 0,
    quickBites: 0,
    fullFeeds: 0,
    drains: 0,
    heatLevel: 0,
    exposure: 0,
    witnessReports: 0,
    driving: false,
    layer: 0,
    nearRefuge: true,
    distanceFromRefuge: 0,
    ...overrides
  };
}

test("playtest starts with three clear objectives and a fifteen-minute limit", () => {
  const ready = createPlaytestSessionState();
  assert.equal(ready.status, PLAYTEST_STATUS.READY);
  assert.equal(ready.objectives.length, 3);
  assert.equal(ready.config.startHunger, 72);
  assert.equal(ready.config.targetHunger, 25);
  assert.equal(ready.timeRemainingSeconds, 900);

  const active = startPlaytestSession(ready);
  assert.equal(active.status, PLAYTEST_STATUS.ACTIVE);
  assert.match(playtestObjectiveText(active), /1\/3 HUNT/);
});

test("feeding advances the session to the Hunger objective", () => {
  let state = startPlaytestSession(createPlaytestSessionState());
  state = advancePlaytestSession(state, observation({
    distanceFromRefuge: 180,
    nearRefuge: false,
    hunger: 58,
    feedCount: 1,
    quickBites: 1
  }));

  assert.equal(state.leftRefuge, true);
  assert.equal(state.objectiveIndex, 1);
  assert.equal(state.objectives[0].state, "done");
  assert.equal(state.metrics.quickBites, 1);
  assert.match(playtestObjectiveText(state), /2\/3 FEED/);
});

test("the run cannot complete while pursued, driving or outside the refuge", () => {
  let state = startPlaytestSession(createPlaytestSessionState());
  state = advancePlaytestSession(state, observation({
    distanceFromRefuge: 220,
    nearRefuge: false,
    hunger: 20,
    feedCount: 1,
    fullFeeds: 1,
    heatLevel: 2,
    driving: true
  }));
  assert.equal(state.status, PLAYTEST_STATUS.ACTIVE);
  assert.equal(state.objectiveIndex, 2);

  state = advancePlaytestSession(state, observation({
    distanceFromRefuge: 0,
    nearRefuge: true,
    hunger: 20,
    feedCount: 1,
    fullFeeds: 1,
    heatLevel: 0,
    driving: true
  }));
  assert.equal(state.status, PLAYTEST_STATUS.ACTIVE);
  assert.match(playtestObjectiveText(state), /Exit the vehicle/);
});

test("feeding, escaping and returning on foot completes the playtest", () => {
  let state = startPlaytestSession(createPlaytestSessionState());
  state = advancePlaytestSession(state, observation({
    distanceFromRefuge: 220,
    nearRefuge: false,
    hunger: 20,
    feedCount: 1,
    drains: 1,
    heatLevel: 2,
    exposure: 37,
    witnessReports: 1,
    driving: true,
    layer: -1
  }));
  state = advancePlaytestSession(state, observation({
    distanceFromRefuge: 20,
    nearRefuge: true,
    hunger: 20,
    feedCount: 1,
    drains: 1,
    heatLevel: 0,
    exposure: 22,
    witnessReports: 1,
    driving: false,
    layer: 0
  }));

  assert.equal(state.status, PLAYTEST_STATUS.COMPLETE);
  assert.equal(state.objectives.every(item => item.state === "done"), true);
  assert.equal(state.metrics.maxHeatLevel, 2);
  assert.equal(state.metrics.maxExposure, 37);
  assert.equal(state.metrics.vehicleUsed, true);
  assert.equal(state.metrics.alternateRouteUsed, true);
  assert.equal(playtestObjectiveText(state).startsWith("COMPLETE"), false);

  const result = playtestResult(state);
  assert.equal(result.title, "NIGHT SURVIVED");
  assert.equal(result.stats.drains, 1);
  assert.equal(result.stats.witnessReports, 1);
});

test("the session fails cleanly when the time limit expires", () => {
  let state = startPlaytestSession(createPlaytestSessionState({ durationSeconds: 1 }));
  state = advancePlaytestSession(state, observation({ dt: 1 }));
  assert.equal(state.status, PLAYTEST_STATUS.FAILED);
  assert.match(state.failureReason, /playtest window ended/i);
  assert.equal(playtestObjectiveText(state).startsWith("FAILED"), false);
  assert.equal(playtestResult(state).title, "NIGHT LOST");
});

test("feedback payload preserves the existing Google Sheets contract", () => {
  const payload = buildPlaytestFeedbackPayload({
    values: {
      reason: "result",
      rating: "4",
      understood: "mostly",
      mostFun: "Feeding and the getaway",
      frustration: "I lost the refuge marker once",
      systemsClarity: "mixed",
      playAgain: "yes",
      playerName: "tester-7",
      extra: "No blocking bugs"
    },
    session: {
      status: "complete",
      elapsedSeconds: 521,
      objectiveText: "NIGHT SURVIVED · Run complete.",
      metrics: { finalHunger: 18, maxExposure: 33 },
      current: { layer: 0 }
    },
    result: { status: "complete" },
    client: {
      pageUrl: "https://example.test/?mode=playtest",
      viewport: "1440x900",
      userAgent: "test-browser",
      timestamp: "2026-07-30T15:00:00.000Z"
    }
  });

  assert.equal(payload.rating, 4);
  assert.equal(payload.liked, "Feeding and the getaway");
  assert.equal(payload.disliked, "I lost the refuge marker once");
  assert.equal(payload.playerName, "tester-7");
  assert.match(payload.missing, /Objective understood: mostly/);
  assert.match(payload.missing, /Systems clarity: mixed/);
  assert.equal(payload.snapshot.buildVersion, "playtest-0.1-hunt-feed-escape");
  assert.equal(payload.snapshot.missionVerdict, "complete");
  assert.equal(payload.snapshot.exposure, 33);
  assert.equal(payload.snapshot.hunger, 18);
  assert.equal(payload.snapshot.timePlayedSeconds, 521);
  assert.equal(payload.snapshot.pageUrl, "https://example.test/?mode=playtest");
});
