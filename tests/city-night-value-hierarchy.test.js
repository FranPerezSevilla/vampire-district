import assert from "node:assert/strict";
import test from "node:test";

import { COLORS } from "../phaser/src/data/balance.js";

function rgb(color) {
  const value = Number(color) >>> 0;
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff
  };
}

function relativeLuma(color) {
  const { r, g, b } = rgb(color);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

test("night world values reserve most of the frame for dark broad surfaces", () => {
  const broadSurfaces = [
    COLORS.void,
    COLORS.streetBase,
    COLORS.road,
    COLORS.sidewalk,
    COLORS.roofDim
  ];

  assert.ok(broadSurfaces.every(color => relativeLuma(color) < 60));
  assert.ok(relativeLuma(COLORS.void) < relativeLuma(COLORS.streetBase));
  assert.ok(relativeLuma(COLORS.streetBase) < relativeLuma(COLORS.road));
  assert.ok(relativeLuma(COLORS.road) < relativeLuma(COLORS.sidewalk));
});

test("navigation edges remain readable without consuming practical-light headroom", () => {
  const road = relativeLuma(COLORS.road);
  const sidewalk = relativeLuma(COLORS.sidewalk);
  const curb = relativeLuma(COLORS.sidewalkCurb);
  const crosswalk = relativeLuma(COLORS.crosswalk);
  const player = relativeLuma(COLORS.player);

  assert.ok(sidewalk - road >= 12, "sidewalk must separate clearly from asphalt");
  assert.ok(curb > sidewalk, "curb edge must remain visible against sidewalk fill");
  assert.ok(crosswalk > curb, "crosswalk remains a local high-value navigation mark");
  assert.ok(player > crosswalk, "player presentation retains value priority over broad street markings");
});

test("surface wear stays subordinate to navigation structure", () => {
  const road = relativeLuma(COLORS.road);
  const patch = relativeLuma(COLORS.roadPatch);
  const stripe = relativeLuma(COLORS.roadStripe);
  const drainTrim = relativeLuma(COLORS.roadDrainTrim);

  assert.ok(patch > road);
  assert.ok(relativeLuma(COLORS.roadCrack) < road);
  assert.ok(stripe > patch);
  assert.ok(drainTrim < stripe);
});