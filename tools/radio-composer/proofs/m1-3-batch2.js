import { buildMidiFile } from "../midi-workbench.js";

const bar = (index) => index * 4;

function griegSourceNotes() {
  const pitches = [66, 68, 70, 71, 73, 70, 73, 74, 70, 74, 73, 70, 73];
  const offsets = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 4.5, 5, 6, 6.5, 7];
  const notes = [];
  for (const [start, transpose, velocity] of [[0, 0, 64], [80, 24, 82]]) {
    pitches.forEach((note, index) => notes.push({
      start: start + offsets[index],
      duration: 0.35,
      note: note + transpose,
      velocity
    }));
  }
  return notes;
}

function griegDrums() {
  const notes = [];
  for (let index = 0; index < 26; index += 1) {
    const start = bar(index);
    notes.push({ start, duration: 0.04, note: 36, velocity: 82 });
    notes.push({ start: start + 2, duration: 0.04, note: 38, velocity: 76 });
    if (index >= 12 && index % 2 === 1) {
      notes.push({ start: start + 3, duration: 0.04, note: 38, velocity: 45 });
    }
  }
  return notes;
}

export function buildGriegProofMidi() {
  return buildMidiFile({
    title: "ViceBlood - Mountain King / Big Beat Proof A",
    bpm: 138,
    markers: [
      { beat: 0, label: "INTRO" },
      { beat: 48, label: "BUILD" },
      { beat: 80, label: "FULL" }
    ],
    tracks: [
      { name: "01 Source Motif - Grieg", channel: 0, program: 0, notes: griegSourceNotes() },
      { name: "02 Big Beat Break", channel: 9, notes: griegDrums() },
      {
        name: "03 Distorted Bass", channel: 1, program: 38,
        notes: [[16, 42], [32, 45], [48, 40], [64, 42], [80, 54], [96, 52]].map(([start, note]) => ({ start, duration: 12, note, velocity: 58 }))
      },
      {
        name: "04 Industrial Hits", channel: 2, program: 55,
        notes: [16, 48, 80, 100].map((start) => ({ start, duration: 0.15, note: 48, velocity: 70 }))
      },
      {
        name: "05 Low Strings / Pulse", channel: 3, program: 48,
        notes: [
          { start: 48, duration: 16, note: 54, velocity: 34 },
          { start: 48, duration: 16, note: 61, velocity: 30 },
          { start: 80, duration: 16, note: 66, velocity: 42 },
          { start: 80, duration: 16, note: 73, velocity: 38 }
        ]
      },
      {
        name: "06 Riser / FX Guide", channel: 4, program: 95,
        notes: [
          { start: 48, duration: 0.3, note: 48, velocity: 30 },
          { start: 80, duration: 0.3, note: 60, velocity: 45 },
          { start: 100, duration: 0.3, note: 35, velocity: 100 }
        ]
      }
    ]
  });
}

function bachSourceNotes() {
  const pitches = [48, 52, 55, 60, 64, 55, 60, 64, 48, 50, 57, 62, 65, 57, 62, 65];
  const notes = [];
  for (const [start, velocity] of [[0, 58], [64, 72]]) {
    pitches.forEach((note, index) => notes.push({
      start: start + index * 0.5,
      duration: 0.35,
      note,
      velocity
    }));
  }
  return notes;
}

function bachDrums() {
  const notes = [];
  for (let index = 0; index < 24; index += 1) {
    const start = bar(index);
    notes.push({ start, duration: 0.04, note: 36, velocity: 82 });
    notes.push({ start: start + 2, duration: 0.04, note: 36, velocity: 78 });
    if (index >= 8) {
      notes.push({ start: start + 1, duration: 0.04, note: 39, velocity: 42 });
      notes.push({ start: start + 3, duration: 0.04, note: 39, velocity: 48 });
    }
  }
  return notes;
}

export function buildBachProofMidi() {
  return buildMidiFile({
    title: "ViceBlood - BWV 846 / Acid Proof A",
    bpm: 128,
    markers: [
      { beat: 0, label: "INTRO" },
      { beat: 32, label: "ACID" },
      { beat: 64, label: "FULL" }
    ],
    tracks: [
      { name: "01 Source Pattern - Bach", channel: 0, program: 6, notes: bachSourceNotes() },
      { name: "02 909-Style Placeholder Drums", channel: 9, notes: bachDrums() },
      {
        name: "03 Acid Bass - 303 Guide", channel: 1, program: 38,
        notes: [[32, 36], [40, 39], [48, 39], [56, 42], [64, 43], [72, 46], [80, 41], [88, 44]].map(([start, note]) => ({ start, duration: 7, note, velocity: start % 16 === 0 ? 64 : 54 }))
      },
      {
        name: "04 Piano / Organ Stabs", channel: 2, program: 16,
        notes: [32, 48, 64, 80].flatMap((start) => [72, 76, 79].map((note) => ({ start: start + 6, duration: 0.2, note, velocity: 48 })))
      },
      {
        name: "05 Club Pad", channel: 3, program: 89,
        notes: [
          { start: 48, duration: 16, note: 48, velocity: 28 },
          { start: 48, duration: 16, note: 55, velocity: 26 },
          { start: 64, duration: 16, note: 50, velocity: 30 },
          { start: 64, duration: 16, note: 57, velocity: 28 }
        ]
      },
      {
        name: "06 Club FX Guide", channel: 4, program: 95,
        notes: [
          { start: 32, duration: 0.3, note: 48, velocity: 30 },
          { start: 64, duration: 0.3, note: 60, velocity: 45 },
          { start: 92, duration: 0.3, note: 36, velocity: 95 }
        ]
      }
    ]
  });
}
