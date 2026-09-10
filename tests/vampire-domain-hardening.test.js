import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("one compiled view loads before the game without retired render bridges", () => {
  const source = readFileSync(new URL("../phaser/src/app-bootstrap.js", import.meta.url), "utf8");
  assert.ok(source.indexOf('import("../ui-dist/interface.js")') < source.indexOf('await import("./main.js")'));
  for (const name of ["DomainUiBridge", "DomainUiHardening", "DomainViewportPortal", "VampireDomainPanel", "VampireHud"]) {
    assert.equal(existsSync(new URL(`../phaser/src/vampire/${name}.js`, import.meta.url)), false);
    assert.doesNotMatch(source, new RegExp(name));
  }
});
