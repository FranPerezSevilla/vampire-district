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
  void: 0x05060b,
  streetBase: 0x171b28,
  streetGrid: 0x2a3041,
  streetGridMajor: 0x363d50,
  road: 0x202536,
  roadTrim: 0x111722,
  roadEdge: 0x3b4357,
  roadStripe: 0x626a7e,
  roadMajorStripe: 0x9a7a3f,
  roadWear: 0x171c2a,
  sidewalk: 0x373a47,
  sidewalkTrim: 0x6b6d79,
  sidewalkJoint: 0x292c37,
  sidewalkCurb: 0x7a7b86,
  crosswalk: 0xc8cad3,
  crosswalkShadow: 0x121724,
  tactilePaving: 0x9b7744,
  sewerBase: 0x06100d,
  sewerTunnel: 0x0b2a22,
  sewerTrim: 0x15483b,
  roofDim: 0x464860,
  player: 0xe8d9e9,
  playerBody: 0x15121d,
  accent: 0x78c7a3,
  warning: 0xffb02e,
  danger: 0xff3b50,
  magic: 0xa75cff,
  text: 0xf1e6ff,
  muted: 0x9d93b8
});