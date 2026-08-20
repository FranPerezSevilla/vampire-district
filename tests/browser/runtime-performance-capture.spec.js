import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const SAMPLE_INTERVAL_MS = 300;
const SAMPLES_PER_PHASE = 8;
const SETTLE_MS = 900;
const PERFORMANCE_CAPTURE_DIR = ".artifacts/performance";
const PERFORMANCE_CAPTURE_PATH = `${PERFORMANCE_CAPTURE_DIR}/runtime-performance-capture.json`;
const OUTER_SYSTEM_NAMES = Object.freeze([
  "StreamingPipeline",
  "TrafficPipeline",
  "MotorizedPoliceSystem",
  "PedestrianSystem",
  "GameplayRuntimeCore",
  "TerritoryRuntimeSystem"
]);
const CORE_SYSTEM_PREFIX = "Core.";
const FINALIZE_SYSTEM_PREFIX = "Finalize.";
const PUBLISH_STATE_PHASE_NAMES = Object.freeze([
  "PublishState.Prepare",
  "PublishState.Summaries",
  "PublishState.InteractionMenu",
  "PublishState.PayloadTail",
  "PublishState.RegistryCommit"
]);
const PUBLISH_STATE_SUMMARY_PREFIX = "PublishState.Summary.";
const PUBLISH_STATE_SUMMARY_GROUP_COUNT = 4;

async function waitForRuntimeDiagnostics(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_RUNTIME_DIAGNOSTICS
    && window.NBD_PHASER_GAME?.scene?.getScene("GameScene")
  ));
}

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function summarizeRanking(samples, rankingKey) {
  const winnerCounts = new Map();
  const timingTotals = new Map();
  const phaseWinners = new Map();

  for (const sample of samples) {
    const ranking = sample[rankingKey] || [];
    const winner = ranking[0]?.name;
    if (winner) {
      winnerCounts.set(winner, (winnerCounts.get(winner) || 0) + 1);
      const phaseKey = `${sample.phase}:${winner}`;
      phaseWinners.set(phaseKey, (phaseWinners.get(phaseKey) || 0) + 1);
    }

    for (const timing of ranking) {
      const current = timingTotals.get(timing.name) || {
        name: timing.name,
        observations: 0,
        averageMsTotal: 0,
        recentMaxMs: 0
      };
      current.observations += 1;
      current.averageMsTotal += finite(timing.averageMs);
      current.recentMaxMs = Math.max(current.recentMaxMs, finite(timing.recentMaxMs));
      timingTotals.set(timing.name, current);
    }
  }

  const winners = [...winnerCounts]
    .map(([name, count]) => ({
      name,
      count,
      share: Number((count / Math.max(1, samples.length)).toFixed(3))
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const systems = [...timingTotals.values()]
    .map(item => ({
      name: item.name,
      observations: item.observations,
      meanReportedAverageMs: Number((item.averageMsTotal / item.observations).toFixed(3)),
      peakRecentMaxMs: Number(item.recentMaxMs.toFixed(3))
    }))
    .sort((a, b) => (
      b.meanReportedAverageMs - a.meanReportedAverageMs
      || b.peakRecentMaxMs - a.peakRecentMaxMs
      || a.name.localeCompare(b.name)
    ));

  const phases = [...new Set(samples.map(sample => sample.phase))].map(phase => {
    const phaseSamples = samples.filter(sample => sample.phase === phase);
    const candidates = [...phaseWinners]
      .filter(([key]) => key.startsWith(`${phase}:`))
      .map(([key, count]) => ({ name: key.slice(phase.length + 1), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      phase,
      samples: phaseSamples.length,
      winner: candidates[0] || null,
      averageFrameMs: Number((phaseSamples.reduce((sum, sample) => sum + sample.averageFrameMs, 0) / phaseSamples.length).toFixed(3)),
      peakRecentMaxFrameMs: Number(Math.max(...phaseSamples.map(sample => sample.recentMaxFrameMs)).toFixed(3))
    };
  });

  return {
    sampleCount: samples.length,
    winner: winners[0] || null,
    winners,
    systems,
    phases
  };
}

function summarizeCapture(samples) {
  const outer = summarizeRanking(samples, "slowestSystems");
  return {
    ...outer,
    core: summarizeRanking(samples, "coreSystems"),
    finalize: summarizeRanking(samples, "finalizeSystems"),
    publishState: summarizeRanking(samples, "publishStateSystems"),
    publishStateSummaries: summarizeRanking(samples, "publishStateSummarySystems")
  };
}

async function persistCapture(capture) {
  await mkdir(PERFORMANCE_CAPTURE_DIR, { recursive: true });
  await writeFile(PERFORMANCE_CAPTURE_PATH, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
}

test.describe.configure({ timeout: 90_000 });

test("runtime diagnostics capture a repeatable browser hotspot ranking across city streaming pressure", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForRuntimeDiagnostics(page);

  const samples = await page.evaluate(async ({
    intervalMs,
    samplesPerPhase,
    settleMs,
    outerSystemNames,
    coreSystemPrefix,
    finalizeSystemPrefix,
    publishStatePhaseNames,
    publishStateSummaryPrefix
  }) => {
    const district = await import("/phaser/src/data/district.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const origin = { x: scene.player.x, y: scene.player.y };
    const outerNames = new Set(outerSystemNames);
    const publishStateNames = new Set(publishStatePhaseNames);
    const phases = [
      { name: "settled-street", point: origin, relocate: false },
      { name: "harbor-stream", point: district.CITY_ANCHORS.harborFar, relocate: true },
      { name: "street-return", point: origin, relocate: true }
    ];
    const captured = [];
    const rank = timings => timings.sort((a, b) => (
      b.averageMs - a.averageMs
      || b.recentMaxMs - a.recentMaxMs
      || a.name.localeCompare(b.name)
    ));

    for (const phase of phases) {
      if (phase.relocate) {
        scene.switchLayer(0, phase.point, `Runtime performance capture: ${phase.name}`);
        if (window.NBD_CITY_STREAM?.forceFocus) {
          await window.NBD_CITY_STREAM.forceFocus(phase.point.x, phase.point.y);
        }
        window.NBD_ENTITY_STREAM?.resync?.();
        scene.npcSystem?.refreshVisibility?.();
      }

      await sleep(settleMs);

      for (let index = 0; index < samplesPerPhase; index += 1) {
        await sleep(intervalMs);
        const snapshot = window.NBD_RUNTIME_DIAGNOSTICS.snapshot({ force: true });
        const timings = Object.entries(snapshot.systemTimings || {}).map(([name, timing]) => ({
          name,
          averageMs: Number(timing.averageMs) || 0,
          recentMaxMs: Number(timing.recentMaxMs) || 0,
          maxMs: Number(timing.maxMs) || 0,
          samples: Number(timing.samples) || 0
        }));
        captured.push({
          phase: phase.name,
          averageFrameMs: Number(snapshot.averageFrameMs) || 0,
          recentMaxFrameMs: Number(snapshot.recentMaxFrameMs) || 0,
          maxFrameMs: Number(snapshot.maxFrameMs) || 0,
          slowestSystems: rank(timings.filter(timing => outerNames.has(timing.name))),
          coreSystems: rank(timings.filter(timing => timing.name.startsWith(coreSystemPrefix))),
          finalizeSystems: rank(timings.filter(timing => timing.name.startsWith(finalizeSystemPrefix))),
          publishStateSystems: rank(timings.filter(timing => publishStateNames.has(timing.name))),
          publishStateSummarySystems: rank(timings.filter(timing => timing.name.startsWith(publishStateSummaryPrefix)))
        });
      }
    }

    return captured;
  }, {
    intervalMs: SAMPLE_INTERVAL_MS,
    samplesPerPhase: SAMPLES_PER_PHASE,
    settleMs: SETTLE_MS,
    outerSystemNames: OUTER_SYSTEM_NAMES,
    coreSystemPrefix: CORE_SYSTEM_PREFIX,
    finalizeSystemPrefix: FINALIZE_SYSTEM_PREFIX,
    publishStatePhaseNames: PUBLISH_STATE_PHASE_NAMES,
    publishStateSummaryPrefix: PUBLISH_STATE_SUMMARY_PREFIX
  });

  const capture = summarizeCapture(samples);
  await persistCapture(capture);
  console.log(`NBD_PERF_CAPTURE=${JSON.stringify(capture)}`);

  expect(pageErrors).toEqual([]);
  expect(capture.sampleCount).toBe(SAMPLES_PER_PHASE * 3);
  expect(capture.phases).toHaveLength(3);
  expect(capture.systems.length).toBeGreaterThanOrEqual(4);
  expect(capture.winner?.count || 0).toBeGreaterThan(0);
  expect(capture.phases.every(phase => phase.samples === SAMPLES_PER_PHASE)).toBe(true);
  expect(capture.core.sampleCount).toBe(SAMPLES_PER_PHASE * 3);
  expect(capture.core.phases).toHaveLength(3);
  expect(capture.core.systems.length).toBeGreaterThanOrEqual(4);
  expect(capture.core.winner?.count || 0).toBeGreaterThan(0);
  expect(capture.core.phases.every(phase => phase.samples === SAMPLES_PER_PHASE)).toBe(true);
  expect(capture.finalize.sampleCount).toBe(SAMPLES_PER_PHASE * 3);
  expect(capture.finalize.phases).toHaveLength(3);
  expect(capture.finalize.systems.length).toBeGreaterThanOrEqual(4);
  expect(capture.finalize.winner?.count || 0).toBeGreaterThan(0);
  expect(capture.finalize.phases.every(phase => phase.samples === SAMPLES_PER_PHASE)).toBe(true);
  expect(capture.publishState.sampleCount).toBe(SAMPLES_PER_PHASE * 3);
  expect(capture.publishState.phases).toHaveLength(3);
  expect(capture.publishState.systems.length).toBeGreaterThanOrEqual(PUBLISH_STATE_PHASE_NAMES.length);
  expect(capture.publishState.winner?.count || 0).toBeGreaterThan(0);
  expect(capture.publishState.phases.every(phase => phase.samples === SAMPLES_PER_PHASE)).toBe(true);
  expect(capture.publishStateSummaries.sampleCount).toBe(SAMPLES_PER_PHASE * 3);
  expect(capture.publishStateSummaries.phases).toHaveLength(3);
  expect(capture.publishStateSummaries.systems.length).toBeGreaterThanOrEqual(PUBLISH_STATE_SUMMARY_GROUP_COUNT);
  expect(capture.publishStateSummaries.winner?.count || 0).toBeGreaterThan(0);
  expect(capture.publishStateSummaries.phases.every(phase => phase.samples === SAMPLES_PER_PHASE)).toBe(true);
});
