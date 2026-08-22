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
  passivePerSecond: 0.12,
  targetRelief: 60,
  civilianRelief: 40,
  ratRelief: 12,
  targetFeedSeconds: 2.4,
  civilianFeedSeconds: 2.2,
  ratFeedSeconds: 1.0,
  dashCost: 12,
  whisperCost: 16,
  senseCost: 3,
  dashCooldown: 3.0,
  whisperCooldown: 4.8,
  senseCooldown: 4.0,
  dashDistance: 76,
  whisperSeconds: 6.0,
  senseSeconds: 5.0
});

export const COLORS = Object.freeze({
  void: 0x030409,
  streetBase: 0x0d1018,
  streetGrid: 0x202638,
  streetGridMajor: 0x2a3142,
  road: 0x151a24,
  roadTrim: 0x0b0f17,
  roadEdge: 0x31384a,
  roadStripe: 0x525a6b,
  roadMajorStripe: 0x80683d,
  roadWear: 0x10141d,
  roadPatch: 0x232936,
  roadPatchSeam: 0x0b0f18,
  roadCrack: 0x070b12,
  roadGutter: 0x0a0f17,
  roadGutterStain: 0x061114,
  roadDrain: 0x080b10,
  roadDrainTrim: 0x454c5a,
  sidewalk: 0x292c37,
  sidewalkTrim: 0x555863,
  sidewalkJoint: 0x1e212a,
  sidewalkCurb: 0x676a75,
  crosswalk: 0xa8aab2,
  crosswalkShadow: 0x0b0f17,
  tactilePaving: 0x725d3e,
  sewerBase: 0x06100d,
  sewerTunnel: 0x0b2a22,
  sewerTrim: 0x15483b,
  roofDim: 0x303343,
  player: 0xe8d9e9,
  playerBody: 0x15121d,
  accent: 0x78c7a3,
  warning: 0xffb02e,
  danger: 0xff3b50,
  magic: 0xa75cff,
  text: 0xf1e6ff,
  muted: 0x9d93b8
});