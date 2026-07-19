import test from "node:test";
import assert from "node:assert/strict";
import { TutorialDirector } from "../phaser/src/tutorial/TutorialDirector.js";

function fakeDirector() {
  const calls = [];
  return {
    director: {
      scene: { player: { x: 150, y: 146 } },
      busy: false,
      state: "waiting",
      setControlMode(mode) {
        calls.push(`control:${mode}`);
      },
      setTip(key, text) {
        calls.push(text ? `tip:${key}` : "tip:clear");
      },
      freezeWorld(frozen) {
        calls.push(`freeze:${frozen}`);
      },
      async zoomToPlayer() {
        calls.push("zoom-in");
      },
      async showDialogue(payload = {}) {
        const segments = Array.isArray(payload.segments) && payload.segments.length
          ? payload.segments
          : [payload.text || ""];
        for (const text of segments) calls.push(`dialogue:${text}`);
      },
      async zoomBackToWorld() {
        calls.push("zoom-out");
      }
    },
    calls
  };
}

test("all opening bubbles finish before the intro camera starts zooming out", async () => {
  const { director, calls } = fakeDirector();

  await TutorialDirector.prototype.runIntro.call(director);

  const zoomInIndex = calls.indexOf("zoom-in");
  const zoomOutIndex = calls.indexOf("zoom-out");
  const dialogues = calls
    .map((value, index) => ({ value, index }))
    .filter(entry => entry.value.startsWith("dialogue:"));

  assert.equal(dialogues.length, 6);
  assert.ok(zoomInIndex >= 0);
  assert.ok(zoomOutIndex > zoomInIndex);
  assert.ok(dialogues.every(entry => entry.index > zoomInIndex && entry.index < zoomOutIndex));
  assert.match(dialogues[0].value, /Another night/);
  assert.match(dialogues.at(-1).value, /silence the journalist/);
  assert.ok(calls.indexOf("freeze:false") > zoomOutIndex);
  assert.ok(calls.indexOf("control:movement") > zoomOutIndex);
  assert.equal(director.state, "rooftop-movement");
  assert.equal(director.busy, false);
});
