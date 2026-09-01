import crypto from "node:crypto";
import fs from "node:fs";

const DEFAULT_PPQ = 480;
const REQUIRED_MANIFEST_FIELDS = [
  "id",
  "stationId",
  "workingTitle",
  "sourceWork",
  "sourceComposer",
  "sourceEditionOrCatalogue",
  "sourceUrl",
  "sourceStatus",
  "sourceReuseTerms",
  "sourceCheckedAt",
  "arrangementLane",
  "bpm",
  "durationSeconds",
  "midiTracks",
  "status",
  "userReview",
  "attribution"
];
const ALLOWED_STATIONS = new Set([
  "blood-city-beats",
  "vice-fm",
  "night-shift",
  "pulse-94-6",
  "static",
  "tooling-smoke"
]);
const ALLOWED_STATUS = new Set(["prototype", "proof", "daw-candidate", "rejected", "fixture"]);
const ALLOWED_REVIEW = new Set(["not-requested", "pending", "approved", "revise"]);
const ALLOWED_CREDIT_MODES = new Set([
  "required-player-credit",
  "courtesy-player-credit",
  "internal-only"
]);

function assertInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}]`);
  }
}

function assertFiniteNumber(value, name, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a finite number in [${min}, ${max}]`);
  }
}

function uint16(value) {
  const out = Buffer.alloc(2);
  out.writeUInt16BE(value, 0);
  return out;
}

function uint32(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value >>> 0, 0);
  return out;
}

export function encodeVariableLength(value) {
  assertInteger(value, "variable-length value", 0, 0x0fffffff);
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return Buffer.from(bytes);
}

function metaEvent(type, payload) {
  return Buffer.concat([Buffer.from([0xff, type]), encodeVariableLength(payload.length), payload]);
}

function textMeta(type, text) {
  return metaEvent(type, Buffer.from(String(text), "utf8"));
}

function tempoMeta(bpm) {
  assertFiniteNumber(bpm, "bpm", 1, 999);
  const micros = Math.round(60000000 / bpm);
  const payload = Buffer.from([(micros >> 16) & 0xff, (micros >> 8) & 0xff, micros & 0xff]);
  return metaEvent(0x51, payload);
}

function timeSignatureMeta([numerator, denominator]) {
  assertInteger(numerator, "time signature numerator", 1, 255);
  if (![1, 2, 4, 8, 16, 32, 64].includes(denominator)) {
    throw new Error("time signature denominator must be a power of two up to 64");
  }
  const dd = Math.log2(denominator);
  return metaEvent(0x58, Buffer.from([numerator, dd, 24, 8]));
}

function makeTrackChunk(events) {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const pieces = [];
  let lastTick = 0;
  for (const event of sorted) {
    assertInteger(event.tick, "event tick", 0, 0x0fffffff);
    if (event.tick < lastTick) throw new Error("events are not monotonic");
    pieces.push(encodeVariableLength(event.tick - lastTick), event.data);
    lastTick = event.tick;
  }
  pieces.push(encodeVariableLength(0), metaEvent(0x2f, Buffer.alloc(0)));
  const body = Buffer.concat(pieces);
  return Buffer.concat([Buffer.from("MTrk", "ascii"), uint32(body.length), body]);
}

function beatToTick(beat, ppq) {
  assertFiniteNumber(beat, "beat", 0, 1000000);
  return Math.round(beat * ppq);
}

function validateNoteSpec(note, trackName) {
  assertFiniteNumber(note.start, `${trackName}.note.start`, 0, 1000000);
  assertFiniteNumber(note.duration, `${trackName}.note.duration`, Number.EPSILON, 1000000);
  assertInteger(note.note, `${trackName}.note.note`, 0, 127);
  assertInteger(note.velocity ?? 80, `${trackName}.note.velocity`, 1, 127);
}

function buildConductorTrack({ title, bpm, ppq, timeSignature, markers = [] }) {
  const events = [
    { tick: 0, order: 0, data: textMeta(0x03, "00 Conductor") },
    { tick: 0, order: 1, data: textMeta(0x01, title) },
    { tick: 0, order: 2, data: tempoMeta(bpm) },
    { tick: 0, order: 3, data: timeSignatureMeta(timeSignature) }
  ];
  markers.forEach((marker, index) => {
    events.push({
      tick: beatToTick(marker.beat, ppq),
      order: 10 + index,
      data: textMeta(0x06, marker.label)
    });
  });
  return makeTrackChunk(events);
}

function buildMusicTrack(spec, ppq, index) {
  if (!spec?.name || !String(spec.name).trim()) throw new Error(`track ${index + 1} requires a name`);
  const channel = spec.channel ?? index % 9;
  assertInteger(channel, `${spec.name}.channel`, 0, 15);
  const events = [{ tick: 0, order: 0, data: textMeta(0x03, spec.name) }];

  if (spec.program !== undefined && channel !== 9) {
    assertInteger(spec.program, `${spec.name}.program`, 0, 127);
    events.push({ tick: 0, order: 1, data: Buffer.from([0xc0 | channel, spec.program]) });
  }

  for (const note of spec.notes ?? []) {
    validateNoteSpec(note, spec.name);
    const start = beatToTick(note.start, ppq);
    const end = beatToTick(note.start + note.duration, ppq);
    const velocity = note.velocity ?? 80;
    events.push({ tick: start, order: 3, data: Buffer.from([0x90 | channel, note.note, velocity]) });
    events.push({ tick: end, order: 2, data: Buffer.from([0x80 | channel, note.note, 0]) });
  }

  return makeTrackChunk(events);
}

export function buildMidiFile({
  title,
  bpm,
  ppq = DEFAULT_PPQ,
  timeSignature = [4, 4],
  markers = [],
  tracks = []
}) {
  if (!title || !String(title).trim()) throw new Error("title is required");
  assertFiniteNumber(bpm, "bpm", 1, 999);
  assertInteger(ppq, "ppq", 24, 32767);
  if (!Array.isArray(tracks) || tracks.length === 0) throw new Error("at least one musical track is required");

  const chunks = [buildConductorTrack({ title, bpm, ppq, timeSignature, markers })];
  tracks.forEach((track, index) => chunks.push(buildMusicTrack(track, ppq, index)));

  const header = Buffer.concat([
    Buffer.from("MThd", "ascii"),
    uint32(6),
    uint16(1),
    uint16(chunks.length),
    uint16(ppq)
  ]);
  return Buffer.concat([header, ...chunks]);
}

function readVlq(buffer, start, limit) {
  let value = 0;
  let offset = start;
  for (let i = 0; i < 4; i += 1) {
    if (offset >= limit) throw new Error("truncated variable-length value");
    const byte = buffer[offset++];
    value = (value << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) return { value, offset };
  }
  throw new Error("variable-length value exceeds four bytes");
}

function parseTrack(buffer, start, end) {
  let offset = start;
  let runningStatus = null;
  let absoluteTick = 0;
  let name = null;
  let tempo = null;
  const active = new Map();
  let noteOnCount = 0;

  while (offset < end) {
    const delta = readVlq(buffer, offset, end);
    absoluteTick += delta.value;
    offset = delta.offset;
    if (offset >= end) throw new Error("truncated MIDI event");

    let status = buffer[offset];
    if (status < 0x80) {
      if (runningStatus === null) throw new Error("running status without prior channel status");
      status = runningStatus;
    } else {
      offset += 1;
      if (status < 0xf0) runningStatus = status;
    }

    if (status === 0xff) {
      runningStatus = null;
      if (offset >= end) throw new Error("truncated meta event");
      const type = buffer[offset++];
      const lengthInfo = readVlq(buffer, offset, end);
      offset = lengthInfo.offset;
      const payloadEnd = offset + lengthInfo.value;
      if (payloadEnd > end) throw new Error("meta event exceeds track boundary");
      const payload = buffer.subarray(offset, payloadEnd);
      if (type === 0x03) name = payload.toString("utf8");
      if (type === 0x51 && payload.length === 3) {
        const micros = (payload[0] << 16) | (payload[1] << 8) | payload[2];
        tempo = 60000000 / micros;
      }
      offset = payloadEnd;
      if (type === 0x2f) break;
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      runningStatus = null;
      const lengthInfo = readVlq(buffer, offset, end);
      offset = lengthInfo.offset + lengthInfo.value;
      if (offset > end) throw new Error("SysEx event exceeds track boundary");
      continue;
    }

    const type = status & 0xf0;
    const channel = status & 0x0f;
    const dataLength = type === 0xc0 || type === 0xd0 ? 1 : 2;
    if (offset + dataLength > end) throw new Error("channel event exceeds track boundary");
    const data1 = buffer[offset++];
    const data2 = dataLength === 2 ? buffer[offset++] : null;

    if (type === 0x90 && data2 > 0) {
      noteOnCount += 1;
      const key = `${channel}:${data1}`;
      active.set(key, (active.get(key) ?? 0) + 1);
    } else if (type === 0x80 || (type === 0x90 && data2 === 0)) {
      const key = `${channel}:${data1}`;
      const count = active.get(key) ?? 0;
      if (count > 1) active.set(key, count - 1);
      else active.delete(key);
    }
  }

  if (active.size) throw new Error(`track ${name ?? "<unnamed>"} has stuck notes`);
  return { name, tempo, noteOnCount, endTick: absoluteTick };
}

export function inspectMidiBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error("MIDI input must be a Buffer");
  if (buffer.length < 14 || buffer.subarray(0, 4).toString("ascii") !== "MThd") {
    throw new Error("invalid MIDI header");
  }
  const headerLength = buffer.readUInt32BE(4);
  if (headerLength !== 6) throw new Error("unsupported MIDI header length");
  const format = buffer.readUInt16BE(8);
  const trackCount = buffer.readUInt16BE(10);
  const division = buffer.readUInt16BE(12);
  if (format !== 1) throw new Error("radio composer requires Standard MIDI File type 1");
  if (trackCount < 2) throw new Error("type-1 radio MIDI requires conductor plus at least one musical track");
  if (division & 0x8000) throw new Error("SMPTE time division is not supported");

  let offset = 8 + headerLength;
  const tracks = [];
  for (let i = 0; i < trackCount; i += 1) {
    if (offset + 8 > buffer.length || buffer.subarray(offset, offset + 4).toString("ascii") !== "MTrk") {
      throw new Error(`missing MTrk chunk ${i + 1}`);
    }
    const length = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) throw new Error(`track ${i + 1} exceeds file boundary`);
    tracks.push(parseTrack(buffer, start, end));
    offset = end;
  }
  if (offset !== buffer.length) throw new Error("unexpected trailing bytes after final MIDI track");
  if (!tracks[0].name || !tracks[0].name.toLowerCase().includes("conductor")) {
    throw new Error("first track must be a named conductor track");
  }
  if (!tracks[0].tempo) throw new Error("conductor track requires tempo metadata");
  for (const [index, track] of tracks.entries()) {
    if (!track.name?.trim()) throw new Error(`track ${index + 1} is missing a track name`);
  }

  return {
    format,
    ppq: division,
    trackCount,
    bpm: tracks[0].tempo,
    trackNames: tracks.map((track) => track.name),
    endTick: Math.max(...tracks.map((track) => track.endTick)),
    noteOnCount: tracks.reduce((sum, track) => sum + track.noteOnCount, 0)
  };
}

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["manifest must be an object"];
  }
  for (const key of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[key] === undefined || manifest[key] === null || manifest[key] === "") {
      errors.push(`missing required field: ${key}`);
    }
  }

  if (manifest.stationId && !ALLOWED_STATIONS.has(manifest.stationId)) errors.push(`unsupported stationId: ${manifest.stationId}`);
  if (manifest.status && !ALLOWED_STATUS.has(manifest.status)) errors.push(`unsupported status: ${manifest.status}`);
  if (manifest.userReview && !ALLOWED_REVIEW.has(manifest.userReview)) errors.push(`unsupported userReview: ${manifest.userReview}`);
  if (manifest.bpm !== undefined && (!Number.isFinite(manifest.bpm) || manifest.bpm <= 0)) errors.push("bpm must be > 0");
  if (manifest.durationSeconds !== undefined && (!Number.isFinite(manifest.durationSeconds) || manifest.durationSeconds <= 0)) errors.push("durationSeconds must be > 0");
  if (manifest.midiTracks !== undefined && (!Array.isArray(manifest.midiTracks) || manifest.midiTracks.some((name) => !String(name).trim()))) {
    errors.push("midiTracks must be a non-empty-string array");
  }

  const attribution = manifest.attribution;
  if (attribution && typeof attribution === "object" && !Array.isArray(attribution)) {
    if (!ALLOWED_CREDIT_MODES.has(attribution.creditMode)) errors.push("attribution.creditMode is invalid");
    if (!String(attribution.playerCredit ?? "").trim()) errors.push("attribution.playerCredit is required");
    if (!String(attribution.internalSourceCredit ?? "").trim()) errors.push("attribution.internalSourceCredit is required");
    if (!String(attribution.licenseOrStatus ?? "").trim()) errors.push("attribution.licenseOrStatus is required");
    if (attribution.thirdPartyAssets !== undefined && !Array.isArray(attribution.thirdPartyAssets)) {
      errors.push("attribution.thirdPartyAssets must be an array");
    }
  } else if (manifest.attribution !== undefined) {
    errors.push("attribution must be an object");
  }

  if (manifest.status === "daw-candidate" && errors.some((error) => error.includes("attribution") || error.includes("source"))) {
    errors.push("daw-candidate cannot have unresolved source/attribution metadata");
  }
  return errors;
}

export function validateCandidateFiles(midiPath, manifestPath) {
  const midi = fs.readFileSync(midiPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const midiInfo = inspectMidiBuffer(midi);
  const manifestErrors = validateManifest(manifest);
  const expectedTracks = midiInfo.trackNames.slice(1);
  if (Array.isArray(manifest.midiTracks) && JSON.stringify(manifest.midiTracks) !== JSON.stringify(expectedTracks)) {
    manifestErrors.push("manifest midiTracks does not match musical MIDI track names/order");
  }
  const digest = sha256(midi);
  if (manifest.sha256 && manifest.sha256 !== digest) manifestErrors.push("manifest sha256 does not match MIDI file");
  if (manifestErrors.length) throw new Error(manifestErrors.join("\n"));
  return { midiInfo, manifest, sha256: digest };
}
