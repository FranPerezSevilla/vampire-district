import test from "node:test";
import assert from "node:assert/strict";
import {
  RADIO_STATIONS,
  isRadioDeployPreviewHostname,
  resolveRadioTrackSrc
} from "../phaser/src/audio/RadioCatalog.js";

const DAI_SUKE_PREVIEW = "https://cdn.pixabay.com/download/audio/2022/05/18/audio_1adefe18a4.mp3?filename=25562653-daisuke-teiko-the-real-deal-90s-hip-hop-instrumental-111454.mp3";
const DAI_SUKE_FILENAME = "vice-fm__daisuke-teiko__the-real-deal-90s-hip-hop-instrumental.mp3";

test("Netlify host matcher only recognizes automatic project deploy previews", () => {
  assert.equal(isRadioDeployPreviewHostname("deploy-preview-78--vampire-district.netlify.app"), true);
  assert.equal(isRadioDeployPreviewHostname("deploy-preview-123--vampire-district.netlify.app"), true);
  assert.equal(isRadioDeployPreviewHostname("vampire-district.netlify.app"), false);
  assert.equal(isRadioDeployPreviewHostname("radio-78--vampire-district.netlify.app"), false);
  assert.equal(isRadioDeployPreviewHostname("localhost"), false);
});

test("Deploy Preview resolves to the verified official CDN master while normal runtime stays private-local", () => {
  const preview = resolveRadioTrackSrc(
    DAI_SUKE_FILENAME,
    DAI_SUKE_PREVIEW,
    "deploy-preview-78--vampire-district.netlify.app"
  );
  assert.equal(preview, DAI_SUKE_PREVIEW);

  const production = resolveRadioTrackSrc(
    DAI_SUKE_FILENAME,
    DAI_SUKE_PREVIEW,
    "vampire-district.netlify.app"
  );
  assert.match(production, /\/phaser\/assets\/audio\/radio-private\/vice-fm__daisuke-teiko__the-real-deal-90s-hip-hop-instrumental\.mp3$/);
});

test("ViceBlood Pages resolves all nine existing masters at root and nested game entry points", () => {
  for (const pathname of ["/vampire-district", "/vampire-district/", "/vampire-district/index.html", "/vampire-district/phaser/"]) {
    for (const track of RADIO_STATIONS.flatMap(station => station.tracks)) {
      assert.equal(
        resolveRadioTrackSrc(track.filename, track.previewSrc, "franperezsevilla.github.io", pathname),
        track.previewSrc,
        `${pathname} must load the existing official master for ${track.id}`
      );
    }
  }
});

test("Pages exception does not replace staged masters on unrelated hosts or project paths", () => {
  for (const [hostname, pathname] of [
    ["localhost", "/vampire-district/"],
    ["vampire-district.netlify.app", "/vampire-district/"],
    ["another-user.github.io", "/vampire-district/"],
    ["franperezsevilla.github.io.example.com", "/vampire-district/"],
    ["franperezsevilla.github.io", "/"],
    ["franperezsevilla.github.io", "/another-project/"],
    ["franperezsevilla.github.io", "/vampire-district-copy/"],
    ["franperezsevilla.github.io", "/another-project/vampire-district/"]
  ]) {
    assert.match(
      resolveRadioTrackSrc(DAI_SUKE_FILENAME, DAI_SUKE_PREVIEW, hostname, pathname),
      /\/phaser\/assets\/audio\/radio-private\//,
      `${hostname}${pathname} must retain the staged local source`
    );
  }
  assert.match(
    resolveRadioTrackSrc(DAI_SUKE_FILENAME, null, "franperezsevilla.github.io", "/vampire-district/"),
    /\/phaser\/assets\/audio\/radio-private\//,
    "a track without a pinned source still resolves locally"
  );
});

test("catalogue boot on Pages selects remote sources using the actual document location", async t => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  t.after(() => {
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation);
    else delete globalThis.location;
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("https://franperezsevilla.github.io/vampire-district/?playtest=1")
  });
  const { RADIO_STATIONS: pagesStations } = await import("../phaser/src/audio/RadioCatalog.js?pages-regression");
  const tracks = pagesStations.flatMap(station => station.tracks);
  assert.equal(tracks.length, 9);
  assert.ok(tracks.every(track => track.src === track.previewSrc));
});

test("all nine locked tracks expose unique Pixabay preview sources", () => {
  const tracks = RADIO_STATIONS.flatMap(station => station.tracks);
  assert.equal(tracks.length, 9);
  const previewSources = tracks.map(track => track.previewSrc);
  assert.equal(new Set(previewSources).size, 9);
  assert.ok(previewSources.every(src => /^https:\/\/cdn\.pixabay\.com\/download\/audio\/.+\.mp3\?filename=.+\.mp3$/i.test(src)));
});
