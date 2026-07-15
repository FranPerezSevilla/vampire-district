export const WORLD = Object.freeze({
  width: 960,
  height: 640,
  tile: 16,
  renderScale: 1.35
});

export const PLAYER = Object.freeze({
  startX: 150,
  startY: 146,
  startLayer: 2,
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
  streetBase: 0x1a1d2b,
  road: 0x25293b,
  roadTrim: 0x171924,
  roadStripe: 0x34384d,
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