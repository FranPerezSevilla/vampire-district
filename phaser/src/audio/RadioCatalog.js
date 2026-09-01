const NETLIFY_DEPLOY_PREVIEW_HOST = /^deploy-preview-\d+--vampire-district\.netlify\.app$/i;

export function isRadioDeployPreviewHostname(hostname) {
  return NETLIFY_DEPLOY_PREVIEW_HOST.test(String(hostname || ""));
}

export function resolveRadioTrackSrc(
  filename,
  previewSrc = null,
  hostname = globalThis.location?.hostname || ""
) {
  if (previewSrc && isRadioDeployPreviewHostname(hostname)) return previewSrc;
  return new URL(`../../assets/audio/radio-private/${filename}`, import.meta.url).href;
}

function radioTrack(id, title, creator, durationSeconds, filename, previewSrc) {
  return Object.freeze({
    id,
    title,
    creator,
    durationSeconds,
    filename,
    previewSrc,
    src: resolveRadioTrackSrc(filename, previewSrc)
  });
}

function radioStation(id, label, tracks) {
  return Object.freeze({ id, label, tracks: Object.freeze([...tracks]) });
}

export const RADIO_STATIONS = Object.freeze([
  radioStation("vice-fm", "Vice FM", [
    radioTrack(
      "daisuke-teiko-real-deal-90s-hip-hop",
      "The Real Deal 90s hip hop instrumental",
      "Daisuke Teiko",
      200,
      "vice-fm__daisuke-teiko__the-real-deal-90s-hip-hop-instrumental.mp3",
      "https://cdn.pixabay.com/download/audio/2022/05/18/audio_1adefe18a4.mp3?filename=25562653-daisuke-teiko-the-real-deal-90s-hip-hop-instrumental-111454.mp3"
    ),
    radioTrack(
      "catch22-coasting-west-coast-hip-hop",
      "Coasting West Coast Hip Hop",
      "catch22music",
      189,
      "vice-fm__catch22music__coasting-west-coast-hip-hop.mp3",
      "https://cdn.pixabay.com/download/audio/2025/07/28/audio_eb5639a6c2.mp3?filename=catch22music-coasting-west-coast-hip-hop-381615.mp3"
    ),
    radioTrack(
      "abydos-trip-hop-lovers",
      "Trip Hop Lovers",
      "Abydos_Music",
      187,
      "vice-fm__abydos-music__trip-hop-lovers.mp3",
      "https://cdn.pixabay.com/download/audio/2024/05/05/audio_963db85fda.mp3?filename=abydos_music-trip-hop-lovers-206690.mp3"
    )
  ]),
  radioStation("night-shift", "Night Shift", [
    radioTrack(
      "ejah-big-beat-industrial-breakbeat-1",
      "Big Beat Rave _ Industrial Breakbeat 1",
      "ejah_music",
      138,
      "night-shift__ejah-music__big-beat-industrial-breakbeat-1.mp3",
      "https://cdn.pixabay.com/download/audio/2026/01/23/audio_2a37b5ba73.mp3?filename=ejah_music-big-beat-rave-_-industrial-breakbeat-1-472114.mp3"
    ),
    radioTrack(
      "natureseye-dirty-industrial-rave",
      "Dirty Industrial Rave",
      "NaturesEye",
      200,
      "night-shift__natureseye__dirty-industrial-rave.mp3",
      "https://cdn.pixabay.com/download/audio/2023/11/23/audio_4de2256b59.mp3?filename=natureseye-dirty-industrial-rave-177919.mp3"
    ),
    radioTrack(
      "delon-big-beat-industrial-breakbeat-3",
      "Big Beat Rave _ Industrial Breakbeat 3",
      "ejah_music",
      253,
      "night-shift__ejah-music__big-beat-industrial-breakbeat-3.mp3",
      "https://cdn.pixabay.com/download/audio/2026/01/25/audio_68b584da36.mp3?filename=ejah_music-big-beat-rave-_-industrial-breakbeat-3-473019.mp3"
    )
  ]),
  radioStation("pulse-94-6", "Pulse 94.6", [
    radioTrack(
      "maty1309-tema-acid-house",
      "Tema Acid House",
      "maty1309",
      238,
      "pulse-94-6__maty1309__tema-acid-house.mp3",
      "https://cdn.pixabay.com/download/audio/2025/04/18/audio_692b94d24f.mp3?filename=maty1309-tema-acid-house-329018.mp3"
    ),
    radioTrack(
      "placidplace-franic-acid-trance",
      "Franic (acid trance)",
      "Placidplace",
      246,
      "pulse-94-6__placidplace__franic-acid-trance.mp3",
      "https://cdn.pixabay.com/download/audio/2025/08/27/audio_9b7d48803a.mp3?filename=placidplace-franic-acid-trance-395688.mp3"
    ),
    radioTrack(
      "berrydeep-back-to-90s",
      "Back To 90s",
      "BerryDeep",
      147,
      "pulse-94-6__berrydeep__back-to-90s.mp3",
      "https://cdn.pixabay.com/download/audio/2026/08/03/audio_f8c8062775.mp3?filename=berrydeep-back-to-90s-579460.mp3"
    )
  ])
]);

export const RADIO_STATION_ORDER = Object.freeze([
  "off",
  ...RADIO_STATIONS.map(station => station.id)
]);

const STATIONS_BY_ID = new Map(RADIO_STATIONS.map(station => [station.id, station]));

export function radioStationById(id) {
  return STATIONS_BY_ID.get(String(id || "")) || null;
}

export function radioTrackCount() {
  return RADIO_STATIONS.reduce((count, station) => count + station.tracks.length, 0);
}

export function radioCatalogSnapshot() {
  return RADIO_STATIONS.map(station => ({
    id: station.id,
    label: station.label,
    tracks: station.tracks.map(track => ({ ...track }))
  }));
}
