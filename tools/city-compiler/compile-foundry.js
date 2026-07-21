import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { currentCityBlueprint, currentCityManifest } from "./current-city.js";
import {
  foundryCandidateSummary,
  generateFoundryCandidates,
  rankFoundryCandidates,
  selectDiverseFoundryCandidates
} from "./foundry-pilot.js";
import { renderFoundryComparisonSvg } from "./render-foundry-comparison.js";
import { renderCityDebugSvg } from "./render-svg.js";
import { scoreCityBlueprint } from "./score.js";
import { validateCityBlueprint } from "./validate.js";

function argumentValue(prefix) {
  const argument = process.argv.slice(2).find(item => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

const outputDir = path.resolve(argumentValue("--output-dir=") || ".city-compiler/foundry-pilot");
const seedPrefix = argumentValue("--seed-prefix=") || "foundry-pilot";
const count = positiveInteger(argumentValue("--count="), 24);
const topCount = Math.min(5, positiveInteger(argumentValue("--top="), 3));
const baselineValidation = validateCityBlueprint(currentCityBlueprint);
const baselineScore = scoreCityBlueprint(currentCityBlueprint, baselineValidation);
const ranked = rankFoundryCandidates(generateFoundryCandidates({ seedPrefix, count }));
const accepted = ranked.filter(result => result.foundryScore.accepted);
const selected = selectDiverseFoundryCandidates(ranked, topCount);

await mkdir(outputDir, { recursive: true });

const selectedSeeds = selected.map(result => result.blueprint.seed);
const summary = {
  generatedAt: new Date().toISOString(),
  compilerVersion: 2,
  pilot: "foundry",
  seedPrefix,
  generatedCandidates: ranked.length,
  acceptedCandidates: accepted.length,
  rejectedCandidates: ranked.length - accepted.length,
  selectedSeeds,
  selectionPolicy: {
    first: "highest Foundry score",
    remaining: "maximum structural distance within four score points of the best candidate",
    dimensions: ["block templates", "building geometry", "local road geometry", "roof count", "vehicle archetype"]
  },
  baseline: {
    id: currentCityBlueprint.id,
    seed: currentCityBlueprint.seed,
    cityScore: baselineScore,
    validation: {
      valid: baselineValidation.valid,
      errors: baselineValidation.errors.length,
      warnings: baselineValidation.warnings.length
    }
  },
  acceptanceTargets: {
    hardValid: true,
    chaseLoops: 2,
    rooftopAreas: 3,
    rooftopRoutes: 2,
    fireEscapes: 2,
    sewerEntrances: 2,
    darkRoutes: 3,
    hidingSockets: 4,
    parkedVehicles: 1,
    minimumCityScore: baselineScore.total
  },
  rankings: ranked.map((result, index) => ({
    ...foundryCandidateSummary(result, index + 1),
    selectedForComparison: selectedSeeds.includes(result.blueprint.seed)
  }))
};

await writeFile(path.join(outputDir, "foundry-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

for (let index = 0; index < selected.length; index++) {
  const result = selected[index];
  const candidateDir = path.join(outputDir, `candidate-${String(index + 1).padStart(2, "0")}-${result.blueprint.seed}`);
  await mkdir(candidateDir, { recursive: true });
  const report = {
    generatedAt: summary.generatedAt,
    compilerVersion: 2,
    comparisonSlot: index + 1,
    ranking: ranked.indexOf(result) + 1,
    blueprint: currentCityManifest(result.blueprint),
    validation: result.validation,
    cityScore: result.cityScore,
    foundryScore: result.foundryScore,
    foundryPlan: result.blueprint.metadata?.foundryPilot || null
  };
  await Promise.all([
    writeFile(path.join(candidateDir, "city-blueprint.json"), `${JSON.stringify(report.blueprint, null, 2)}\n`, "utf8"),
    writeFile(path.join(candidateDir, "city-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(path.join(candidateDir, "foundry-plan.json"), `${JSON.stringify(report.foundryPlan, null, 2)}\n`, "utf8"),
    writeFile(path.join(candidateDir, "city-debug.svg"), renderCityDebugSvg(result.blueprint, result.validation, result.cityScore), "utf8")
  ]);
}

if (selected.length) {
  await writeFile(path.join(outputDir, "foundry-comparison.svg"), renderFoundryComparisonSvg(selected), "utf8");
}

console.log("City Compiler 2 · Foundry pilot");
console.log(`Generated ${ranked.length} · accepted ${accepted.length} · rejected ${ranked.length - accepted.length}`);
console.log(`Baseline city score ${baselineScore.total}`);
for (let index = 0; index < selected.length; index++) {
  const result = selected[index];
  console.log(`#${index + 1} ${result.blueprint.seed} · rank ${ranked.indexOf(result) + 1} · Foundry ${result.foundryScore.total} · City ${result.cityScore.total}`);
}
console.log(`Artifacts ${outputDir}`);

if (selected.length < topCount) {
  console.error(`Only ${selected.length} accepted Foundry candidates were available; ${topCount} required.`);
  process.exitCode = 1;
}