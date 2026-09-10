import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../phaser/src/vampire/DomainUiBridge.js", import.meta.url), "utf8");

test("domain dashboard is responsive and city-first", () => {
  assert.match(source, /container-type:size/);
  assert.match(source, /@container \(max-width:760px\)/);
  assert.match(source, /const labels = \["City", "Contacts", "Herd", "Resources", "Errand", "Map"\]/);
  assert.match(source, /viewBox="0 0 \$\{CITY_WORLD\.width\} \$\{CITY_WORLD\.height\}"/);
});

test("districts expose meaningful access status from live domain state", () => {
  assert.match(source, /WELCOME · HUNTING PERMITTED/);
  assert.match(source, /CONNECTED · NO HUNTING RIGHT/);
  assert.match(source, /KNOWN · NO HUNTING RIGHT/);
  assert.match(source, /UNSECURED · NO HUNTING RIGHT/);
  assert.match(source, /data-domain-district/);
});

test("ambiguous map tracking actions are replaced by one explicit objective action", () => {
  assert.doesNotMatch(source, />Show on map</);
  assert.doesNotMatch(source, />Track & return</);
  assert.match(source, /Set as objective · show HUD arrow/);
  assert.match(source, /Objective set\. Follow the HUD arrow\./);
});
