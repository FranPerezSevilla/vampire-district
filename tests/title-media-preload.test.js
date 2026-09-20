import test from 'node:test';
import assert from 'node:assert/strict';
import { preloadTitleExperience } from '../phaser/src/ui/TitleAssetPreloader.js';
for (const networkState of [0, 2]) {
  test(`title preserves active media loading (networkState ${networkState})`, async () => {
    const media = new EventTarget();
    let loads = 0;
    Object.assign(media, {readyState: 1, networkState, load() { loads++; }});
    const pending = preloadTitleExperience({
      documentRef: {getElementById: () => media, querySelectorAll: () => []},
      windowRef: {setTimeout, clearTimeout},
      sampleCache: {preload: async () => true}, timeoutMs: 1000
    });
    media.readyState = 3;
    media.dispatchEvent(new Event('canplay'));
    assert.equal(await pending, true);
    assert.equal(loads, networkState === 0 ? 1 : 0);
  });
}
