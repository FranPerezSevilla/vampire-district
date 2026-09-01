import test from "node:test";
import assert from "node:assert/strict";
import {
  RADIO_STATIONS,
  isRadioDeployPreviewHostname,
  resolveRadioTrackSrc
} from "../phaser/src/audio/RadioCatalog.js";

const DAI_SUKE_PREVIEW = "https://cdn.pixabay.com/download/audio/2022/05/18/audio_1adefe18a4.mp3?filename=25562653-daisuke-teiko-the-real-deal-90s-hip-hop-instrumental-111454.mp3";
const DAI_SUKE_FILENAME = "vice-fm__daisuke-teiko__the-real-deal-90s-hip-hop-instrumental.mp3";

test("only automatic Netlify Deploy Preview hosts use remote radio masters", () => {
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

test("all nine locked tracks expose unique Pixabay preview sources", () => {
  const tracks = RADIO_STATIONS.flatMap(station => station.tracks);
  assert.equal(tracks.length, 9);
  const previewSources = tracks.map(track => track.previewSrc);
  assert.equal(new Set(previewSources).size, 9);
  assert.ok(previewSources.every(src => /^https:\/\/cdn\.pixabay\.com\/download\/audio\/.+\.mp3\?filename=.+\.mp3$/i.test(src)));
});
