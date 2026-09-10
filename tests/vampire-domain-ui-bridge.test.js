import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDomainMenu } from "../phaser/src/vampire/DomainUiBridge.js";

test("domain UI bridge recognizes published vampire-domain menus even if view metadata is lost", () => {
  assert.equal(isDomainMenu({ view: "vampire-domain", options: [] }), true);
  assert.equal(isDomainMenu({ title: "Your vampire domain", options: [] }), true);
  assert.equal(isDomainMenu({ options: [
    { id: "domain:overview" },
    { id: "domain:contacts" },
    { id: "domain:close" }
  ] }), true);
  assert.equal(isDomainMenu({ title: "Choose interaction", options: [{ id: "talk:sire" }] }), false);
});

test("bootstrap installs the domain UI bridge after Phaser is available and before main starts", () => {
  const source = readFileSync(new URL("../phaser/src/app-bootstrap.js", import.meta.url), "utf8");
  const ensure = source.indexOf("const phaser = await ensurePhaser()");
  const install = source.indexOf("installDomainUiBridge(UIScene)");
  const main = source.indexOf('await import("./main.js")');
  assert.ok(ensure >= 0 && install > ensure && main > install);
});
