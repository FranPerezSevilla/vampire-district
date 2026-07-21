import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import {
  generateFoundryCandidate,
  generateFoundryCandidates,
  rankFoundryCandidates
} from "../tools/city-compiler/foundry-generator.js";
import { renderFoundryComparisonSvg } from "../tools/city-compiler/render-foundry-comparison.js";
import { scoreCityBlueprint } from "../tools/city-compiler/score.js";
import { validateCityBlueprint } from "../tools/city-compiler/validate.js";

function generatedSnapshot(blueprint) {
  const runtime = blueprint.runtime;
  const generated = items => items
    .filter(item => String(item?.id || "").startsWith("foundry:"))
    .map(item => ({ ...item }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    roads: generated(runtime.roads),
    buildings: generated(runtime.buildings),
    roofs: generated(Object.values(runtime.roofAreas || {}).flat()),
    routes: generated(runtime.rooftopRoutes),
    lights: generated(runtime.lights),
    dumpsters: generated(runtime.dumpsters),
    vehicles: generated(runtime.vehicles),
    plan: blueprint.metadata.foundryPilot
  };
}

test("Foundry generation is deterministic for a fixed seed", () => {
  const first = generateFoundryCandidate("foundry-test-01");
  const second = generateFoundryCandidate("foundry-test-01");
  assert.deepEqual(generatedSnapshot(first), generatedSnapshot(second));
});

test("different Foundry seeds preserve semantic ids while varying their plans", () => {
  const first = generateFoundryCandidate("foundry-test-01");
  const second = generateFoundryCandidate("foundry-test-02");
  const firstSnapshot = generatedSnapshot(first);
  const secondSnapshot = generatedSnapshot(second);
  assert.notDeepEqual(firstSnapshot.plan, secondSnapshot.plan);
  assert.deepEqual(firstSnapshot.buildings.map(item => item.id), secondSnapshot.buildings.map(item => item.id));
  assert.deepEqual(firstSnapshot.roads.map(item => item.id), secondSnapshot.roads.map(item => item.id));
});

test("Foundry candidates preserve authored buildings outside the pilot district", () => {
  const candidate = generateFoundryCandidate("foundry-preservation");
  const bounds = currentCityBlueprint.districts.find(item => item.id === "foundry").bounds;
  const outside = item => {
    const point = { x: item.x + item.w / 2, y: item.y + item.h / 2 };
    return point.x < bounds.x || point.x > bounds.x + bounds.w || point.y < bounds.y || point.y > bounds.y + bounds.h;
  };
  const baselineIds = currentCityBlueprint.runtime.buildings.filter(outside).map(item => item.id).sort();
  const candidateIds = candidate.runtime.buildings.filter(outside).map(item => item.id).sort();
  assert.deepEqual(candidateIds, baselineIds);
  assert.ok(candidate.runtime.buildings.some(item => item.id === "harborRegistry"));
});

test("generated Foundry candidates satisfy hard and gameplay contracts", () => {
  const results = generateFoundryCandidates({ seedPrefix: "foundry-contract", count: 12 });
  assert.equal(results.length, 12);
  for (const result of results) {
    assert.equal(result.validation.valid, true, JSON.stringify(result.validation.errors, null, 2));
    assert.equal(result.foundryScore.acceptance.chaseLoops, true);
    assert.equal(result.foundryScore.acceptance.rooftopNetwork, true);
    assert.equal(result.foundryScore.acceptance.sewerEntrances, true);
    assert.equal(result.foundryScore.acceptance.darkRoutes, true);
    assert.equal(result.foundryScore.acceptance.hidingSockets, true);
    assert.equal(result.foundryScore.acceptance.parkedVehicle, true);
    assert.equal(result.foundryScore.acceptance.templateFit, true);
  }
  assert.ok(results.filter(result => result.foundryScore.accepted).length >= 3);
});

test("ranking prefers accepted candidates that meet or improve the city baseline", () => {
  const baselineValidation = validateCityBlueprint(currentCityBlueprint);
  const baselineScore = scoreCityBlueprint(currentCityBlueprint, baselineValidation);
  const ranked = rankFoundryCandidates(generateFoundryCandidates({ seedPrefix: "foundry-ranking", count: 18 }));
  const best = ranked[0];
  assert.equal(best.foundryScore.accepted, true);
  assert.equal(best.validation.valid, true);
  assert.ok(best.cityScore.total >= baselineScore.total);
  assert.ok(best.foundryScore.total >= 75);
});

test("Foundry comparison renderer emits three ranked panels", () => {
  const ranked = rankFoundryCandidates(generateFoundryCandidates({ seedPrefix: "foundry-render", count: 6 }));
  const accepted = ranked.filter(result => result.foundryScore.accepted).slice(0, 3);
  assert.equal(accepted.length, 3);
  const svg = renderFoundryComparisonSvg(accepted);
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /#1/);
  assert.match(svg, /#2/);
  assert.match(svg, /#3/);
  assert.match(svg, /ACCEPTED/);
});

test("Foundry compiler CLI writes rankings, comparison and candidate reports", () => {
  const outputDir = mkdtempSync(path.join(tmpdir(), "bloodnight-foundry-pilot-"));
  try {
    const result = spawnSync(process.execPath, [
      "tools/city-compiler/compile-foundry.js",
      `--output-dir=${outputDir}`,
      "--seed-prefix=foundry-cli",
      "--count=8",
      "--top=3"
    ], { cwd: path.resolve("."), encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(existsSync(path.join(outputDir, "foundry-summary.json")), true);
    assert.equal(existsSync(path.join(outputDir, "foundry-comparison.svg")), true);
    const candidateDirs = readdirSync(outputDir).filter(name => name.startsWith("candidate-"));
    assert.equal(candidateDirs.length, 3);
    const summary = JSON.parse(readFileSync(path.join(outputDir, "foundry-summary.json"), "utf8"));
    assert.ok(summary.acceptedCandidates >= 3);
    assert.equal(summary.rankings[0].foundryScore.accepted, true);
    for (const directory of candidateDirs) {
      assert.equal(existsSync(path.join(outputDir, directory, "city-report.json")), true);
      assert.equal(existsSync(path.join(outputDir, directory, "city-debug.svg")), true);
      assert.equal(existsSync(path.join(outputDir, directory, "foundry-plan.json")), true);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});