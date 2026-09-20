import { CITY_ANCHORS, CITY_WORLD } from "./generated/city-topology-v2.js";

export const WORLD = Object.freeze({
  width: CITY_WORLD.width,
  height: CITY_WORLD.height,
  viewportWidth: 960,
  viewportHeight: 640,
  tile: 16,
  renderScale: 1.35
});

const SAFE_STREET_SPAWN_OFFSET_X = -64;

export const PLAYER = Object.freeze({
  // Start on the refuge frontage rather than directly framing the nearby
  // traffic edge handoff/intersection where macro cars visibly recycle.
  startX: CITY_ANCHORS.streetSpawn.x + SAFE_STREET_SPAWN_OFFSET_X,
  startY: CITY_ANCHORS.streetSpawn.y,
  startLayer: CITY_ANCHORS.streetSpawn.layer,
  baseSpeed: 112,
  sprintMultiplier: 1.55,
  radius: 6
});

export const CAMERA = Object.freeze({
  streetZoom: 1.35,
  roofLowZoom: 1.15,
  roofHighZoom: 0.82,
  sewerZoom: 1.35
});

export const HUNGER = Object.freeze({
  start: 48,
  passivePerSecond: 0.04,
  targetRelief: 60,
  civilianRelief: 40,
  ratRelief: 12,
  targetFeedSeconds: 2.4,
  civilianFeedSeconds: 2.2,
  ratFeedSeconds: 1.0,
  dashCost: 12,
  whisperCost: 16,
  senseCost: 1,
  dashCooldown: 3.0,
  whisperCooldown: 4.8,
  senseCooldown: 4.0,
  dashDistance: 76,
  whisperSeconds: 6.0,
  senseSeconds: 5.0
});

export const COLORS = Object.freeze({
  void: 0x05060b,
  streetBase: 0x1c1b1a,
  streetGrid: 0x34312c,
  streetGridMajor: 0x474039,
  road: 0x292827,
  roadTrim: 0x111111,
  roadEdge: 0x49443d,
  roadStripe: 0x847968,
  roadMajorStripe: 0x95805b,
  roadWear: 0x201f1d,
  roadPatch: 0x38342f,
  roadPatchSeam: 0x161513,
  roadCrack: 0x0e0d0c,
  roadGutter: 0x151412,
  roadGutterStain: 0x1c1c17,
  roadDrain: 0x10100f,
  roadDrainTrim: 0x655d50,
  sidewalk: 0x626660,
  sidewalkTrim: 0x776c59,
  sidewalkJoint: 0x332e28,
  sidewalkCurb: 0x92836b,
  crosswalk: 0xb6a68a,
  crosswalkShadow: 0x141311,
  tactilePaving: 0x877344,
  sewerBase: 0x06100d,
  sewerTunnel: 0x0b2a22,
  sewerTrim: 0x15483b,
  roofDim: 0x423b39,
  player: 0xe8d9e9,
  playerBody: 0x15121d,
  accent: 0x78c7a3,
  warning: 0xffb02e,
  danger: 0xff3b50,
  magic: 0xa75cff,
  text: 0xf1e6ff,
  muted: 0x9d93b8
});
