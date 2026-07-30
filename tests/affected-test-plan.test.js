import test from "node:test";
import assert from "node:assert/strict";
import { buildTestPlan } from "../tools/dev/affected-test-plan.js";

test("documentation-only changes do not select runtime checks", () => {
  const plan = buildTestPlan(["docs/ROADMAP.md", "AGENTS.md"]);
  assert.deepEqual(plan.groups, ["documentation"]);
  assert.deepEqual(plan.commands, []);
});

test("input changes select the unit suite and focused input browser test", () => {
  const plan = buildTestPlan(["phaser/src/input/InputSystem.js"]);
  assert.deepEqual(plan.commands.map((command) => command.id), ["unit", "browser"]);
  assert.ok(plan.commands[1].args.includes("tests/browser/input-locks.spec.js"));
  assert.equal(plan.commands[1].args.includes("tests/browser/vehicle-core.spec.js"), false);
});

test("city compiler changes select validation and focused city coverage", () => {
  const plan = buildTestPlan(["tools/city-compiler/compile.js"]);
  assert.deepEqual(
    plan.commands.map((command) => command.id),
    ["unit", "city-validation", "browser"]
  );
  assert.ok(plan.commands[2].args.includes("tests/browser/road-graph-geometry.spec.js"));
  assert.ok(plan.commands[2].args.includes("tests/browser/city-topology-v2.spec.js"));
});

test("overlapping traffic and vehicle matches do not duplicate specs", () => {
  const plan = buildTestPlan(["phaser/src/traffic/TrafficVehicleSystem.js"]);
  const specs = plan.commands.find((command) => command.id === "browser").args;
  assert.equal(
    specs.filter((value) => value === "tests/browser/vehicle-core.spec.js").length,
    1
  );
});

test("a changed browser spec selects itself", () => {
  const plan = buildTestPlan(["tests/browser/night-ledger.spec.js"]);
  const browser = plan.commands.find((command) => command.id === "browser");
  assert.ok(browser.args.includes("tests/browser/night-ledger.spec.js"));
});

test("test infrastructure changes require the release-candidate suite", () => {
  const plan = buildTestPlan(["playwright.config.js"]);
  assert.deepEqual(plan.commands, [
    {
      id: "release-candidate",
      command: "npm",
      args: ["run", "test:rc"],
      reason: "Test infrastructure or dependency configuration changed."
    }
  ]);
});
