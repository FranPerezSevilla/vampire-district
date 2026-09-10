import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TitleScreenAudioGate } from "../phaser/src/ui/TitleScreenAudioGate.js";

function gateHarness() {
  const bootMessage = { textContent: "", dataset: {} };
  const root = {
    hidden: true,
    dataset: {},
    setAttribute() {},
    querySelector(selector) { return selector === "[data-title-boot-message]" ? bootMessage : null; },
    addEventListener() {},
    removeEventListener() {}
  };
  const head = { appendChild() {} };
  const documentRef = {
    head,
    getElementById(id) { return id === "viceblood-title-screen" ? root : null; },
    createElement() { return { id: "", textContent: "" }; },
    querySelector() { return null; }
  };
  const listeners = new Map();
  let startCalled = 0;
  const neverReady = new Promise(() => {});
  const windowRef = {
    NBD_MAIN_MENU_THEME: { start() { startCalled++; return neverReady; } },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    setTimeout(fn) { fn(); },
    MutationObserver: undefined
  };
  return { gate: new TitleScreenAudioGate({ documentRef, windowRef }), bootMessage, startCalled: () => startCalled };
}

test("title gesture releases the menu without waiting for slow audio readiness", async () => {
  const h = gateHarness();
  const waiting = h.gate.waitForStart();
  h.gate.unlock({ preventDefault() {}, stopPropagation() {} });
  assert.equal(await waiting, true);
  assert.equal(h.startCalled(), 1);
  assert.equal(h.bootMessage.textContent, "The city never sleeps");
});

test("main menu music is parser-preloaded before the application module boots", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const audioIndex = html.indexOf('id="viceblood-main-menu-theme"');
  const bootstrapIndex = html.indexOf('src="phaser/src/app-bootstrap.js"');
  assert.ok(audioIndex > 0);
  assert.ok(bootstrapIndex > audioIndex);
  assert.match(html, /viceblood-main-menu-theme[^>]+preload="auto"/);
  assert.match(html, /viceblood-main-menu-theme[^>]+main-menu-theme-01\.mp3/);
});
