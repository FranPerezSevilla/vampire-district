import test from "node:test";
import assert from "node:assert/strict";
import { uiHarness } from "./helpers/ui-harness.js";

test("a locked gameplay frame cannot hide the separately owned React domain", async () => {
  const h = await uiHarness(); h.ui.openDomain("city");
  h.scene.currentInputFrame.worldEnabled = false;
  h.runtime.present(h.scene.currentInputFrame); h.ui.refresh();
  assert.equal(h.ui.store.getSnapshot().mode, "domain");
  assert.equal(h.ui.store.getSnapshot().domain.contacts.length, 4);
  assert.equal(h.paused(), true);
  h.destroy();
});
