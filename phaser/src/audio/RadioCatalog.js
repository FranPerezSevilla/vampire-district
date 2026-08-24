const RADIO_ASSET_BASE = "phaser/assets/audio/radio-private";

function radioTrack(id, title, creator, filename) {
  return Object.freeze({
    id,
    title,
    creator,
    filename,
    src: `${RADIO_ASSET_BASE}/${filename}`
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
      "vice-fm__daisuke-teiko__the-real-deal-90s-hip-hop-instrumental.mp3"
    ),
    radioTrack(
      "catch22-coasting-west-coast-hip-hop",
      "Coasting West Coast Hip Hop",
      "catch22music",
      "vice-fm__catch22music__coasting-west-coast-hip-hop.mp3"
    )
  ]),
  radioStation("blood-city-beats", "Blood City Beats", [
    radioTrack(
      "abydos-trip-hop-lovers",
      "Trip Hop Lovers",
      "Abydos_Music",
      "blood-city-beats__abydos-music__trip-hop-lovers.mp3"
    )
  ]),
  radioStation("night-shift", "Night Shift", [
    radioTrack(
      "ejah-big-beat-industrial-breakbeat-1",
      "Big Beat Rave _ Industrial Breakbeat 1",
      "ejah_music",
      "night-shift__ejah-music__big-beat-industrial-breakbeat-1.mp3"
    ),
    radioTrack(
      "natureseye-dirty-industrial-rave",
      "Dirty Industrial Rave",
      "NaturesEye",
      "night-shift__natureseye__dirty-industrial-rave.mp3"
    ),
    radioTrack(
      "delon-big-beat-industrial-breakbeat-3",
      "Big Beat Rave _ Industrial Breakbeat 3",
      "ejah_music",
      "night-shift__ejah-music__big-beat-industrial-breakbeat-3.mp3"
    )
  ]),
  radioStation("pulse-94-6", "Pulse 94.6", [
    radioTrack(
      "maty1309-tema-acid-house",
      "Tema Acid House",
      "maty1309",
      "pulse-94-6__maty1309__tema-acid-house.mp3"
    ),
    radioTrack(
      "placidplace-franic-acid-trance",
      "Franic (acid trance)",
      "Placidplace",
      "pulse-94-6__placidplace__franic-acid-trance.mp3"
    ),
    radioTrack(
      "berrydeep-back-to-90s",
      "Back To 90s",
      "BerryDeep",
      "pulse-94-6__berrydeep__back-to-90s.mp3"
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
