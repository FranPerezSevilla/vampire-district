import { buildMidiFile } from "../midi-workbench.js";

const BAR = 4;
const BARS = 56;
const bar = (index) => index * BAR;
const note = (start, duration, pitch, velocity = 72) => ({ start, duration, note: pitch, velocity });

const SOURCE_MOTIF = [68, 75, 68, 72, 75, 67, 75, 67, 70, 75];
const SOURCE_DURS = [0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 1];
const ROOTS = [44, 41, 37, 39];
const CHORDS = [
  [56, 60, 63, 67],
  [53, 56, 60, 63],
  [49, 53, 56, 60],
  [51, 55, 58, 61]
];

function sourceMotifNotes() {
  const notes = [];
  const placements = [
    [8, 0, 62, false], [16, 0, 76, false], [32, 0, 72, true], [48, 0, 78, false],
    [72, 12, 68, true], [112, 0, 68, true], [160, 0, 84, false], [176, 12, 78, true],
    [192, 0, 86, false], [208, 0, 60, true]
  ];
  for (const [start, transpose, velocity, shorten] of placements) {
    let cursor = start;
    SOURCE_MOTIF.forEach((pitch, index) => {
      const raw = SOURCE_DURS[index];
      notes.push(note(cursor, raw * (shorten ? 0.72 : 0.88), pitch + transpose, velocity + ([1, 4, 9].includes(index) ? 5 : 0)));
      cursor += raw;
    });
  }
  return notes;
}

function drumNotes() {
  const notes = [];
  for (let index = 0; index < BARS; index += 1) {
    const start = bar(index);
    if (index < 2) {
      for (let hat = 0; hat < 8; hat += 1) notes.push(note(start + hat * 0.5, 0.04, 42, hat % 2 ? 20 : 28));
      if (index === 1) notes.push(note(start, 0.05, 36, 62), note(start + 3, 0.05, 38, 48));
      continue;
    }

    let kicks = [0, 0.75, 2, 3.25];
    if (index % 4 === 1) kicks = [0, 1.5, 2.5, 3.25];
    if (index >= 24 && index < 36) kicks = [0, 0.75, 1.75, 2.5, 3.5];
    if (index >= 36 && index < 40) kicks = [0, 2.5];
    if (index >= 40) kicks = [0, 0.75, 1.75, 2.5, 3.25];
    kicks.forEach((offset) => notes.push(note(start + offset, 0.045, 36, offset === 0 ? 88 : 62)));
    notes.push(note(start + 1, 0.045, 38, 92), note(start + 3, 0.045, 38, 98));
    if (index >= 4 && index % 2) notes.push(note(start + 2.72, 0.035, 38, 34));
    for (let hat = 0; hat < 8; hat += 1) notes.push(note(start + hat * 0.5 + (hat % 2 ? 0.06 : 0), 0.03, 42, hat % 2 ? 25 : 34));
    if (index >= 4 && index % 2 === 0) notes.push(note(start + 3.55, 0.1, 46, 36));

    if ([11, 19, 27, 35, 47, 51].includes(index)) {
      [38, 40, 38, 40, 45, 47].forEach((pitch, fill) => notes.push(note(start + 2.5 + fill * 0.25, 0.04, pitch, 50 + fill * 7)));
    } else if (index >= 7 && index % 4 === 3) {
      notes.push(note(start + 3.5, 0.04, 40, 46), note(start + 3.75, 0.04, 38, 58));
    }
  }
  return notes;
}

function percussionNotes() {
  const notes = [];
  for (let index = 4; index < BARS; index += 1) {
    const start = bar(index);
    [1.5, 3.5].forEach((offset) => notes.push(note(start + offset, 0.04, 37, index < 24 ? 38 : 46)));
    if (index >= 16) [0.5, 2.5].forEach((offset) => notes.push(note(start + offset, 0.04, 54, index < 40 ? 30 : 38)));
  }
  return notes;
}

function bassNotes() {
  const notes = [];
  for (let index = 4; index < BARS; index += 1) {
    const start = bar(index);
    const root = ROOTS[index % 4];
    const pattern = index >= 36 && index < 40
      ? [[0, 1.25, root, 58], [2.5, 0.65, root + 7, 48], [3.35, 0.45, root + 12, 54]]
      : [[0, 0.58, root, 72], [0.75, 0.38, root + 12, 54], [1.5, 0.42, root + 7, 60], [2.25, 0.48, root + (index % 4 === 3 ? 10 : 5), 56], [3, 0.55, root, 68], [3.65, 0.25, root + 12, 46]];
    pattern.forEach(([offset, duration, pitch, velocity]) => notes.push(note(start + offset, duration, pitch, velocity)));
    if (index % 4 === 3 && !(index >= 36 && index < 40)) {
      notes.push(note(start + 3.25, 0.22, root + 2, 45), note(start + 3.5, 0.22, root + 4, 48));
    }
  }
  return notes;
}

function rhodesNotes() {
  const notes = [];
  for (let index = 0; index < BARS; index += 1) {
    const start = bar(index);
    const chord = CHORDS[index % 4];
    if (index < 4) chord.forEach((pitch) => notes.push(note(start, 3.6, pitch, 44)));
    else if (index >= 36 && index < 40) chord.forEach((pitch) => notes.push(note(start, 3.4, pitch, 50)));
    else {
      [[0, 1.55, 52], [2, 1.45, 48]].forEach(([offset, duration, velocity]) => chord.forEach((pitch) => notes.push(note(start + offset, duration, pitch, velocity))));
      if (index >= 16) chord.slice(1).forEach((pitch) => notes.push(note(start + 3.5, 0.3, pitch + 12, 38)));
    }
  }
  return notes;
}

function clavNotes() {
  const notes = [];
  for (let index = 4; index < BARS; index += 1) {
    if (index >= 36 && index < 40) continue;
    const start = bar(index);
    const chord = CHORDS[index % 4];
    const voicing = [chord[1] + 12, chord[2] + 12];
    const offsets = index % 2 === 0 ? [0.5, 1.75, 2.5, 3.5] : [0.75, 1.5, 2.75, 3.5];
    offsets.forEach((offset) => voicing.forEach((pitch) => notes.push(note(start + offset, 0.16, pitch, index < 24 ? 38 : 48))));
  }
  return notes;
}

function leadNotes() {
  const notes = [];
  const phrases = [
    [[0, 75, 0.6], [0.75, 72, 0.35], [1.25, 70, 0.35], [1.75, 68, 0.6], [2.75, 72, 0.45], [3.35, 75, 0.5]],
    [[0, 79, 0.45], [0.55, 80, 0.35], [1.1, 79, 0.35], [1.75, 75, 0.55], [2.5, 72, 0.4], [3.1, 70, 0.65]]
  ];
  [...Array(6).keys()].map((i) => 24 + i * 2).concat([...Array(6).keys()].map((i) => 40 + i * 2)).forEach((index) => {
    const start = bar(index);
    phrases[(index / 2) % 2].forEach(([offset, pitch, duration]) => notes.push(note(start + offset, duration, pitch, index < 40 ? 60 : 72)));
  });
  return notes;
}

function counterNotes() {
  const notes = [];
  [...Array(8).keys()].map((i) => 16 + i).concat([...Array(8).keys()].map((i) => 44 + i)).forEach((index) => {
    const start = bar(index);
    [80, 79, 75, 72, 75, 77, 75, 72].forEach((pitch, step) => {
      if (step % 2 === 0 || index % 2 === 0) notes.push(note(start + step * 0.5, 0.3, pitch, index < 40 ? 36 : 44));
    });
  });
  return notes;
}

function padNotes() {
  const notes = [];
  for (let index = 12; index < BARS; index += 1) {
    const start = bar(index);
    const chord = CHORDS[index % 4];
    let velocity = index < 24 ? 24 : index < 40 ? 30 : 38;
    if (index >= 36 && index < 40) velocity = 42;
    [chord[0] - 12, chord[2], chord[3]].forEach((pitch) => notes.push(note(start, 3.8, pitch, velocity)));
  }
  return notes;
}

function brassNotes() {
  const notes = [];
  [12, 20, 24, 28, 32, 40, 44, 48, 52].forEach((index) => {
    const start = bar(index);
    const chord = CHORDS[index % 4];
    [0, 3.5].forEach((offset) => chord.slice(0, 3).forEach((pitch) => notes.push(note(start + offset, 0.18, pitch + 12, index < 40 ? 50 : 64))));
  });
  return notes;
}

function fxNotes() {
  const notes = [];
  [3, 15, 23, 35, 39, 51, 55].forEach((index) => {
    const start = bar(index);
    for (let step = 0; step < 4; step += 1) notes.push(note(start + 3 + step * 0.22, 0.16, 72 + step * 2, 26 + step * 5));
  });
  notes.push(note(BARS * BAR - 0.5, 0.45, 44, 84));
  return notes;
}

export const MAPLE_LEAF_GFUNK_B_PLAN = Object.freeze({
  bpm: 96,
  bars: 56,
  targetDurationSeconds: 140,
  sections: ["INTRO", "A1", "A2 VARIATION", "B SECTION", "BREAKDOWN", "A PRIME / PEAK", "OUTRO"],
  measuredCoreMinActiveRoles: 5,
  measuredCoreAverageActiveRoles: 6.8,
  measuredPeakActiveRoles: 10,
  coreBarsBelowThreeRoles: 0
});

export function buildMapleLeafGfunkB() {
  return buildMidiFile({
    title: "ViceBlood - Maple Leaf / G-Funk Full Song B",
    bpm: 96,
    markers: [
      { beat: 0, label: "INTRO 4" },
      { beat: 16, label: "A1 12" },
      { beat: 64, label: "A2 VARIATION 8" },
      { beat: 96, label: "B SECTION 12" },
      { beat: 144, label: "BREAKDOWN 4" },
      { beat: 160, label: "A PRIME / PEAK 12" },
      { beat: 208, label: "OUTRO 4" }
    ],
    tracks: [
      { name: "01 Source Motif - Joplin", channel: 0, program: 0, notes: sourceMotifNotes() },
      { name: "02 G-Funk Drums", channel: 9, notes: drumNotes() },
      { name: "03 Percussion / Tambourine", channel: 9, notes: percussionNotes() },
      { name: "04 Funk Bass", channel: 1, program: 33, notes: bassNotes() },
      { name: "05 Rhodes Chord Bed", channel: 2, program: 4, notes: rhodesNotes() },
      { name: "06 Clav / Muted Chops", channel: 3, program: 7, notes: clavNotes() },
      { name: "07 Mono Synth Lead", channel: 4, program: 81, notes: leadNotes() },
      { name: "08 Counter Melody", channel: 5, program: 11, notes: counterNotes() },
      { name: "09 Low Strings / Pad", channel: 6, program: 49, notes: padNotes() },
      { name: "10 Brass Stabs", channel: 7, program: 62, notes: brassNotes() },
      { name: "11 Transition FX Guide", channel: 8, program: 95, notes: fxNotes() }
    ]
  });
}
