import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { currentCityBlueprint, currentCityManifest } from "./current-city.js";
import { renderCityDebugSvg } from "./render-svg.js";
import { scoreCityBlueprint } from "./score.js";
import { validateCityBlueprint } from "./validate.js";

function argumentValue(prefix) {
  const argument = process.argv.slice(2).find(item => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

const validateOnly = process.argv.includes("--validate-only");
const outputDir = path.resolve(argumentValue("--output-dir=") || ".city-compiler/current-city");
const validation = validateCityBlueprint(currentCityBlueprint);
const score = scoreCityBlueprint(currentCityBlueprint, validation);
const manifest = currentCityManifest(currentCityBlueprint);
const report = {
  generatedAt: new Date().toISOString(),
  compilerVersion: 1,
  blueprint: manifest,
  validation,
  score,
  nextStage: {
    id: "foundry-pilot",
    goal: "Regenerate Foundry Ward from recipes and block templates while preserving the rest of the authored city.",
    protectedZones: currentCityBlueprint.protectedZones
  }
};

if (!validateOnly) {
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "city-blueprint.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDir, "city-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDir, "city-debug.svg"), renderCityDebugSvg(currentCityBlueprint, validation, score), "utf8")
  ]);
}

console.log(`City Compiler · ${currentCityBlueprint.id}`);
console.log(`World ${currentCityBlueprint.world.width}×${currentCityBlueprint.world.height}`);
console.log(`Validation ${validation.valid ? "PASS" : "FAIL"} · errors ${validation.errors.length} · warnings ${validation.warnings.length}`);
console.log(`Score ${score.total}/100 · grade ${score.grade}`);
if (!validateOnly) console.log(`Artifacts ${outputDir}`);

if (validation.errors.length) {
  for (const error of validation.errors) console.error(`[${error.code}] ${error.message}`);
  process.exitCode = 1;
}
