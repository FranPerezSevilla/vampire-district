import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCurbOverlaySegments,
  clipLineSegmentToRect,
  subtractLineSegmentByRect
} from "../phaser/src/rendering/CurbOverlayGeometry.js";

test("building clipping returns only the curb portion that can be overpainted", () => {
  const clipped = clipLineSegmentToRect(
    { x1: 0, y1: 100, x2: 100, y2: 100 },
    { x: 40, y: 90, w: 20, h: 20 }
  );

  assert.deepEqual(clipped, { x1: 40, y1: 100, x2: 60, y2: 100 });
});

test("crosswalk subtraction leaves a real opening in the repaired curb", () => {
  const pieces = subtractLineSegmentByRect(
    { x1: 0, y1: 100, x2: 100, y2: 100 },
    { x: 40, y: 90, w: 20, h: 20 }
  );

  assert.deepEqual(pieces, [
    { x1: 0, y1: 100, x2: 40, y2: 100 },
    { x1: 60, y1: 100, x2: 100, y2: 100 }
  ]);
});

test("final overlay repairs only building-obscured curb and remains clipped around crosswalks", () => {
  const boundary = {
    curbSegments: [{ x1: 0, y1: 100, x2: 200, y2: 100 }],
    corners: []
  };
  const segments = buildCurbOverlaySegments(boundary, {
    occluders: [{ x: 40, y: 90, w: 120, h: 20 }],
    crosswalks: [{ x: 90, y: 90, w: 20, h: 20 }],
    occluderPadding: 0,
    crosswalkPadding: 0
  });

  assert.deepEqual(segments, [
    { x1: 40, y1: 100, x2: 90, y2: 100, overlaySource: "curb" },
    { x1: 110, y1: 100, x2: 160, y2: 100, overlaySource: "curb" }
  ]);
});

test("rounded corner arcs participate in the same building repair pass", () => {
  const boundary = {
    curbSegments: [],
    corners: [{
      corner: "nw",
      walkId: "corner-1",
      arc: [{ x: 10, y: 20 }, { x: 14, y: 16 }, { x: 20, y: 14 }]
    }]
  };
  const segments = buildCurbOverlaySegments(boundary, {
    occluders: [{ x: 8, y: 12, w: 14, h: 10 }],
    occluderPadding: 0
  });

  assert.equal(segments.length, 2);
  assert.ok(segments.every(segment => segment.overlaySource === "corner"));
});
