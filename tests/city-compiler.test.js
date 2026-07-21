import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { blockTemplates, districtRecipes } from "../tools/city-compiler/catalog.js";
import { currentCityBlueprint, currentCityManifest } from "../tools/city-compiler/current-city.js";
import { defineBlockTemplate, defineCityBlueprint, defineDistrictRecipe } from "../tools/city-compiler/model.js";
import { renderCityDebugSvg } from "../tools/city-compiler/render-svg.js";
import { scoreCityBlueprint } from "../tools/city-compiler/score.js";
import { validateCityBlueprint } from "../tools/city-compiler/validate.js";

test("city compiler domain models normalize and freeze authored inputs", () => {
  const recipe = defineDistrictRecipe({ id: "test-recipe", label: "Test" });
  const template = defineBlockTemplate({ id: "test-block", family: "test" });
  const blueprint = defineCityBlueprint({
    id: "test-city",
    world: { width: 100, height: 80 },
    recipes: [recipe],
    blockTemplates: [template]
  });

  assert.equal(Object.isFrozen(recipe), true);
  assert.equal(Object.isFrozen(template), true);
  assert.equal(Object.isFrozen(blueprint), true);
  assert.deepEqual(recipe.roadWidths.major, [92, 128]);
  assert.equal(template.roof.enabled, true);
});

test("catalog exposes distinct recipes and reusable block families", () => {
  assert.equal(new Set(districtRecipes.map(item => item.id)).size, districtRecipes.length);
  assert.equal(new Set(blockTemplates.map(item => item.id)).size, blockTemplates.length);
  assert.ok(districtRecipes.length >= 6);
  assert.ok(blockTemplates.some(template => template.family === "warehouse"));
  assert.ok(blockTemplates.some(template => template.passages.length > 0));
});

test("the authored district imports as a valid compiler blueprint", () => {
  const validation = validateCityBlueprint(currentCityBlueprint);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.equal(validation.errors.length, 0);
  assert.equal(validation.metrics.roadComponents, 1);
  assert.ok(validation.metrics.roadCycleSurplus >= 1);
  assert.equal(validation.metrics.legacyBuildingRoadOverlapCount, 10);
  assert.equal(currentCityBlueprint.protectedZones.includes("old-quarter"), true);
});

test("current city scoring is bounded and exposes actionable components", () => {
  const validation = validateCityBlueprint(currentCityBlueprint);
  const score = scoreCityBlueprint(currentCityBlueprint, validation);
  assert.ok(score.total >= 0 && score.total <= 100);
  assert.match(score.grade, /^[A-E]$/);
  assert.deepEqual(Object.keys(score.components).sort(), [
    "districtIdentity",
    "hardValidity",
    "pedestrianCoverage",
    "roadConnectivity",
    "systemicDistribution",
    "verticalAndUnderground"
  ]);
  assert.equal(score.components.hardValidity, 100);
});

test("current city manifest is serializable and omits runtime geometry payloads", () => {
  const manifest = currentCityManifest();
  const serialized = JSON.stringify(manifest);
  assert.ok(serialized.includes("bloodnight-current-city"));
  assert.equal(Object.hasOwn(manifest, "runtime"), false);
  assert.equal(manifest.counts.districts, currentCityBlueprint.districts.length);
  assert.equal(manifest.counts.vehicles, 5);
});

test("debug renderer emits a self-contained SVG with city layers and score", () => {
  const validation = validateCityBlueprint(currentCityBlueprint);
  const score = scoreCityBlueprint(currentCityBlueprint, validation);
  const svg = renderCityDebugSvg(currentCityBlueprint, validation, score);
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg/);
  assert.match(svg, /id="districts"/);
  assert.match(svg, /id="roads"/);
  assert.match(svg, /id="buildings"/);
  assert.match(svg, /City Compiler/);
  assert.match(svg, new RegExp(`Score ${score.total}`));
});

test("compiler CLI writes manifest, report and layered SVG", () => {
  const outputDir = mkdtempSync(path.join(tmpdir(), "bloodnight-city-compiler-"));
  try {
    const result = spawnSync(process.execPath, [
      "tools/city-compiler/compile.js",
      `--output-dir=${outputDir}`
    ], {
      cwd: path.resolve("."),
      encoding: "utf8"
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    for (const filename of ["city-blueprint.json", "city-report.json", "city-debug.svg"]) {
      assert.equal(existsSync(path.join(outputDir, filename)), true, `${filename} was not generated`);
    }

    const report = JSON.parse(readFileSync(path.join(outputDir, "city-report.json"), "utf8"));
    const svg = readFileSync(path.join(outputDir, "city-debug.svg"), "utf8");
    assert.equal(report.validation.valid, true);
    assert.equal(report.validation.metrics.legacyBuildingRoadOverlapCount, 10);
    assert.ok(report.score.total > 0);
    assert.match(svg, /City Compiler/);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("validator rejects a building placed across an authored road", () => {
  const invalid = {
    ...currentCityBlueprint,
    runtime: {
      ...currentCityBlueprint.runtime,
      buildings: [
        ...currentCityBlueprint.runtime.buildings,
        { id: "invalid-road-building", x: 440, y: 310, w: 30, h: 30 }
      ]
    }
  };
  const validation = validateCityBlueprint(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => error.code === "BUILDING_OVER_ROAD"));
});
