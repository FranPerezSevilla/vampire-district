import { buildMidiFile } from "../midi-workbench.js";

const BAR = 4;
const BARS = 52;
const TOTAL_BEATS = BARS * BAR;
const bar = (index) => index * BAR;
const note = (start, duration, pitch, velocity = 72) => ({ start, duration, note: pitch, velocity });

const ROOTS = [44, 41, 37, 39];
const CHORDS = [
  [56, 60, 63, 67],
  [53, 56, 60, 63],
  [49, 53, 56, 60],
  [51, 55, 58, 61]
];

function sourceHookNotes() {
  const notes = [];
  const fragmentA = [[0, 68, 0.38], [0.5, 75, 0.38], [1, 68, 0.38], [1.5, 72, 0.38], [2, 75, 0.7]];
  const fragmentB = [[0, 67, 0.38], [0.5, 75, 0.38], [1, 67, 0.38], [1.5, 70, 0.38], [2, 75, 0.7]];
  const placements = [
    [8, fragmentA, 0, 62],
    [32, fragmentB, 0, 68],
    [64, fragmentA, 0, 80],
    [72, fragmentB, 0, 76],
    [144, fragmentA, 12, 82],
    [152, fragmentB, 12, 80],
    [176, fragmentA, 0, 86],
    [184, fragmentB, 0, 84],
    [196, fragmentA, 0, 58]
  ];
  for (const [start, fragment, transpose, velocity] of placements) {
    fragment.forEach(([offset, pitch, duration]) => notes.push(note(start + offset, duration, pitch + transpose, velocity)));
  }
  return notes;
}

function hipHopDrumNotes() {
  const notes = [];
  const kickPatterns = [
    [0, 0.75, 2.25, 3.25],
    [0, 1.5, 2.5, 3.5],
    [0, 0.75, 1.75, 2.75, 3.5],
    [0, 1.25, 2.25, 3.25]
  ];

  for (let index = 0; index < BARS; index += 1) {
    const start = bar(index);

    if (index < 2) {
      for (let hat = 0; hat < 8; hat += 1) {
        notes.push(note(start + hat * 0.5 + (hat % 2 ? 0.07 : 0), 0.025, 42, hat % 2 ? 22 : 32));
      }
      if (index === 1) {
        notes.push(note(start, 0.04, 36, 82));
        notes.push(note(start + 1, 0.04, 38, 88));
        notes.push(note(start + 3, 0.04, 38, 92));
      }
      continue;
    }

    const kicks = index >= 32 && index < 36 ? [0, 1.75, 3] : kickPatterns[index % 4];
    kicks.forEach((offset) => notes.push(note(start + offset, 0.035, 36, offset === 0 ? 104 : 74)));

    [[1, 104], [3, 110]].forEach(([offset, velocity]) => {
      notes.push(note(start + offset, 0.035, 38, velocity));
      notes.push(note(start + offset + 0.015, 0.035, 39, 56));
    });

    if (index % 2) notes.push(note(start + 2.62, 0.03, 38, 34));
    if (index % 4 === 2) notes.push(note(start + 0.47, 0.025, 38, 28));

    for (let hat = 0; hat < 8; hat += 1) {
      notes.push(note(start + hat * 0.5 + (hat % 2 ? 0.075 : 0), 0.025, 42, hat % 2 ? 29 : 43));
    }

    if (index >= 4) {
      const openOffsets = index % 2 === 0 ? [1.55, 3.55] : [2.55];
      openOffsets.forEach((offset) => notes.push(note(start + offset, 0.08, 46, 34)));
    }

    if (index >= 7 && index % 8 === 7) {
      [38, 40, 45, 47, 45, 40, 38].forEach((pitch, fill) => {
        notes.push(note(start + 2.4 + fill * 0.22, 0.03, pitch, 48 + fill * 6));
      });
    } else if (index >= 3 && index % 4 === 3) {
      notes.push(note(start + 3.42, 0.03, 40, 48));
      notes.push(note(start + 3.68, 0.03, 38, 62));
    }
  }
  return notes;
}

function funkPercussionNotes() {
  const notes = [];
  for (let index = 4; index < BARS; index += 1) {
    const start = bar(index);
    [0.5, 1.5, 2.5, 3.5].forEach((offset) => notes.push(note(start + offset + 0.04, 0.025, 54, index < 24 ? 30 : 38)));
    const sticks = index % 2 === 0 ? [0.75, 2.75] : [1.75, 3.25];
    sticks.forEach((offset) => notes.push(note(start + offset, 0.025, 37, 42)));
    if ([17, 18, 41, 42].includes(index)) {
      notes.push(note(start + 0.75, 0.04, 56, 34));
      notes.push(note(start + 2.75, 0.04, 56, 32));
    }
  }
  return notes;
}

function funkBassNotes() {
  const notes = [];
  for (let index = 4; index < BARS; index += 1) {
    const start = bar(index);
    const root = ROOTS[index % 4];
    const pattern = index >= 32 && index < 36
      ? [
          [0, 0.42, root, 82], [0.55, 0.22, root + 12, 58], [1, 0.32, root + 7, 66],
          [1.7, 0.22, root + 10, 58], [2, 0.48, root, 78], [2.75, 0.22, root + 5, 58],
          [3.1, 0.2, root + 7, 64], [3.45, 0.18, root + 10, 56], [3.7, 0.2, root + 12, 62]
        ]
      : [
          [0, 0.4, root, 86], [0.52, 0.2, root + 12, 62], [0.82, 0.18, root + 7, 58],
          [1.28, 0.34, root + 5, 70], [1.82, 0.18, root + 7, 54],
          [2, 0.42, root, 80], [2.55, 0.18, root + 12, 58],
          [2.86, 0.24, root + (index % 4 === 3 ? 10 : 7), 64],
          [3.28, 0.28, root + 5, 60], [3.68, 0.18, root + 12, 52]
        ];

    pattern.forEach(([offset, duration, pitch, velocity]) => notes.push(note(start + offset, duration, pitch, velocity)));

    if (index % 4 === 3 && index < BARS - 1) {
      const nextRoot = ROOTS[(index + 1) % 4];
      notes.push(note(start + 3.76, 0.1, nextRoot - 2, 46));
      notes.push(note(start + 3.9, 0.08, nextRoot - 1, 50));
    }
  }
  return notes;
}

function rhodesNotes() {
  const notes = [];
  for (let index = 0; index < BARS; index += 1) {
    const start = bar(index);
    const chord = CHORDS[index % 4];

    if (index < 4) {
      [0, 2.5].forEach((offset) => chord.forEach((pitch) => notes.push(note(start + offset, 0.85, pitch, 40))));
      continue;
    }

    if (index >= 32 && index < 36) {
      chord.forEach((pitch) => {
        notes.push(note(start, 1.1, pitch, 52));
        notes.push(note(start + 2.75, 0.55, pitch, 44));
      });
      continue;
    }

    [[0, 48, 0.55], [1.6, 44, 0.4], [2.55, 50, 0.48], [3.45, 38, 0.28]].forEach(([offset, velocity, duration]) => {
      chord.forEach((pitch) => notes.push(note(start + offset, duration, pitch, velocity)));
    });
  }
  return notes;
}

function clavinetNotes() {
  const notes = [];
  for (let index = 4; index < BARS; index += 1) {
    const start = bar(index);
    const chord = CHORDS[index % 4];
    const voicing = [chord[1] + 12, chord[2] + 12];
    let offsets = index % 2 === 0 ? [0.35, 0.9, 1.85, 2.35, 3.1, 3.62] : [0.55, 1.2, 1.72, 2.7, 3.22, 3.72];
    if (index >= 32 && index < 36) offsets = [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75];
    offsets.forEach((offset, step) => voicing.forEach((pitch) => notes.push(note(start + offset, 0.12, pitch, step % 2 === 0 ? 46 : 38))));
  }
  return notes;
}

function mutedGuitarNotes() {
  const notes = [];
  for (let index = 8; index < BARS; index += 1) {
    if (index >= 32 && index < 36) continue;
    const start = bar(index);
    const chord = CHORDS[index % 4];
    const top = [chord[2] + 12, chord[3] + 12];
    [1.35, 2.85].forEach((offset) => top.forEach((pitch) => notes.push(note(start + offset, 0.1, pitch, 36))));
    if (index >= 36) top.forEach((pitch) => notes.push(note(start + 3.55, 0.1, pitch, 42)));
  }
  return notes;
}

function synthLeadNotes() {
  const notes = [];
  const phrases = [
    [[0, 80, 0.55], [0.65, 79, 0.3], [1.05, 75, 0.42], [1.65, 72, 0.55], [2.4, 75, 0.35], [2.9, 79, 0.6]],
    [[0, 75, 0.4], [0.5, 77, 0.3], [0.92, 79, 0.48], [1.65, 82, 0.6], [2.55, 80, 0.35], [3.05, 79, 0.55]]
  ];

  [16, 18, 20, 22, 36, 38, 40, 42, 44, 46].forEach((index) => {
    const start = bar(index);
    phrases[(index / 2) % 2].forEach(([offset, pitch, duration]) => {
      notes.push(note(start + offset, duration, pitch, index < 36 ? 68 : 78));
    });
  });

  [37, 41, 45].forEach((index) => {
    const start = bar(index);
    notes.push(note(start + 3.35, 0.22, 84, 74));
    notes.push(note(start + 3.65, 0.22, 82, 74));
  });
  return notes;
}

function hookOrganNotes() {
  const notes = [];
  [...Array(8).keys()].map((i) => 16 + i).concat([...Array(12).keys()].map((i) => 36 + i)).forEach((index) => {
    const start = bar(index);
    const chord = CHORDS[index % 4];
    [chord[0] - 12, chord[1], chord[2]].forEach((pitch) => notes.push(note(start, 3.7, pitch, index < 36 ? 28 : 36)));
  });
  return notes;
}

function hornNotes() {
  const notes = [];
  [15, 19, 23, 31, 35, 39, 43, 47].forEach((index) => {
    const start = bar(index);
    const chord = CHORDS[index % 4];
    [2.75, 3.25].forEach((offset) => {
      [chord[0] + 12, chord[2] + 12, chord[3] + 12].forEach((pitch) => notes.push(note(start + offset, 0.11, pitch, index < 36 ? 54 : 64)));
    });
  });
  return notes;
}

function fxGuideNotes() {
  const notes = [];
  [3, 11, 15, 23, 31, 35, 47, 51].forEach((index) => {
    const start = bar(index);
    [72, 70, 73, 69].forEach((pitch, step) => notes.push(note(start + 3 + step * 0.18, 0.12, pitch, 34 + step * 4)));
  });
  notes.push(note(TOTAL_BEATS - 0.75, 0.45, 44, 88));
  return notes;
}

export const MAPLE_LEAF_GFUNK_C_PLAN = Object.freeze({
  bpm: 94,
  bars: 52,
  targetDurationSeconds: 132.8,
  sections: ["INTRO", "VERSE A", "HOOK A", "VERSE B", "FUNK BREAK", "HOOK B / PEAK", "OUTRO"],
  userDirection: "more hip-hop and more funk",
  priorityOrder: ["hip-hop groove", "funk bass/riff", "hook identity", "harmonic color"],
  measuredCoreMinActiveRoles: 5,
  measuredCoreAverageActiveRoles: 6.9,
  measuredPeakActiveRoles: 9,
  coreBarsBelowFourRoles: 0
});

export function buildMapleLeafGfunkC() {
  return buildMidiFile({
    title: "ViceBlood - Maple Leaf / Hip-Hop Funk C",
    bpm: 94,
    markers: [
      { beat: 0, label: "INTRO 4" },
      { beat: 16, label: "VERSE A 12" },
      { beat: 64, label: "HOOK A 8" },
      { beat: 96, label: "VERSE B 8" },
      { beat: 128, label: "FUNK BREAK 4" },
      { beat: 144, label: "HOOK B / PEAK 12" },
      { beat: 192, label: "OUTRO 4" }
    ],
    tracks: [
      { name: "01 Source Hook - Joplin", channel: 0, program: 0, notes: sourceHookNotes() },
      { name: "02 Hip-Hop Drums", channel: 9, notes: hipHopDrumNotes() },
      { name: "03 Funk Percussion", channel: 9, notes: funkPercussionNotes() },
      { name: "04 Funk Bass", channel: 1, program: 33, notes: funkBassNotes() },
      { name: "05 Rhodes Stabs", channel: 2, program: 4, notes: rhodesNotes() },
      { name: "06 Clavinet Chops", channel: 3, program: 7, notes: clavinetNotes() },
      { name: "07 Muted Funk Guitar Guide", channel: 4, program: 28, notes: mutedGuitarNotes() },
      { name: "08 G-Funk Mono Lead", channel: 5, program: 81, notes: synthLeadNotes() },
      { name: "09 Hook Organ", channel: 6, program: 16, notes: hookOrganNotes() },
      { name: "10 Funk Horn Stabs", channel: 7, program: 61, notes: hornNotes() },
      { name: "11 Scratch / FX Guide", channel: 8, program: 120, notes: fxGuideNotes() }
    ]
  });
}
