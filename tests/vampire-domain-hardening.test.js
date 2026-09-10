import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("domain UI hardening is installed before gameplay boot", () => {
  const bootstrap = source("phaser/src/app-bootstrap.js");
  const hardening = source("phaser/src/vampire/DomainUiHardening.js");

  assert.match(bootstrap, /import "\.\/vampire\/DomainUiHardening\.js"/);
  assert.match(hardening, /proto\.show = function hardenedShow/);
  assert.match(hardening, /root\.hidden = false/);
  assert.match(hardening, /VICEBLOOD · YOUR DOMAIN/);
  assert.match(hardening, /DOMAIN UI error/);
  assert.match(hardening, /originalRender\.call\(this, menu, blocked\)/);
});
