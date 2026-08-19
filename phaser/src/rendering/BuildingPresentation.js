const DEFAULT_BUILDING_COLOR = 0x2b2c35;
const DEFAULT_TRIM_COLOR = 0x5e6170;

export const BUILDING_PRESENTATION_KINDS = Object.freeze({
  GENERIC: "generic",
  POLICE: "police",
  CLUB: "club",
  CHURCH: "church"
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value || "building")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function colorChannels(color) {
  const value = Number.isFinite(Number(color)) ? Number(color) : DEFAULT_BUILDING_COLOR;
  return {
    r: (value >>> 16) & 0xff,
    g: (value >>> 8) & 0xff,
    b: value & 0xff
  };
}

function rgb(r, g, b) {
  return (clamp(Math.round(r), 0, 255) << 16)
    | (clamp(Math.round(g), 0, 255) << 8)
    | clamp(Math.round(b), 0, 255);
}

export function buildingPresentationMixColor(first, second, amount = 0.5) {
  const a = colorChannels(first);
  const b = colorChannels(second);
  const t = clamp(amount, 0, 1);
  return rgb(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function lighten(color, amount) {
  return buildingPresentationMixColor(color, 0xffffff, amount);
}

function darken(color, amount) {
  return buildingPresentationMixColor(color, 0x05060a, amount);
}

export function buildingPresentationKey(building = {}) {
  return [
    building.id,
    building.landmarkId,
    building.sign,
    building.name,
    building.label,
    building.districtId
  ].filter(Boolean).join(" ").toLowerCase();
}

export function classifyBuildingPresentation(building = {}) {
  const key = buildingPresentationKey(building);
  if (/\b(police|precinct|constabulary)\b/.test(key)) return BUILDING_PRESENTATION_KINDS.POLICE;
  if (/\b(club|nightclub|nightlife)\b/.test(key)) return BUILDING_PRESENTATION_KINDS.CLUB;
  if (/\b(church|cathedral|chapel|parish)\b/.test(key)) return BUILDING_PRESENTATION_KINDS.CHURCH;
  return BUILDING_PRESENTATION_KINDS.GENERIC;
}

export function buildingPresentationSeed(building = {}) {
  const identity = building.id
    || building.landmarkId
    || building.sign
    || `${building.x || 0}:${building.y || 0}:${building.w || 0}:${building.h || 0}`;
  return hashText(identity);
}

function insetRect(rect, amount) {
  const inset = Math.max(0, Math.min(amount, rect.w * 0.22, rect.h * 0.22));
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    w: Math.max(1, rect.w - inset * 2),
    h: Math.max(1, rect.h - inset * 2)
  };
}

function propInsideRoof(roof, prop) {
  return prop.x >= roof.x
    && prop.y >= roof.y
    && prop.x + prop.w <= roof.x + roof.w
    && prop.y + prop.h <= roof.y + roof.h;
}

function makeProp(roof, random, kind, index, { width = 13, height = 9, margin = 7 } = {}) {
  const w = Math.max(4, Math.min(width, Math.max(4, roof.w - margin * 2)));
  const h = Math.max(4, Math.min(height, Math.max(4, roof.h - margin * 2)));
  const usableW = Math.max(0, roof.w - w - margin * 2);
  const usableH = Math.max(0, roof.h - h - margin * 2);
  return {
    id: `${kind}-${index}`,
    kind,
    x: roof.x + margin + random() * usableW,
    y: roof.y + margin + random() * usableH,
    w,
    h
  };
}

function genericProps(roof, random) {
  const area = roof.w * roof.h;
  const count = clamp(Math.floor(area / 12000) + 1, 1, 4);
  const props = [];
  for (let index = 0; index < count; index++) {
    const roll = random();
    const kind = roll < 0.52 ? "hvac" : roll < 0.82 ? "vent" : "skylight";
    const dimensions = kind === "hvac"
      ? { width: 16 + random() * 8, height: 10 + random() * 6 }
      : kind === "skylight"
        ? { width: 19 + random() * 12, height: 7 + random() * 5 }
        : { width: 7, height: 7 };
    const candidate = makeProp(roof, random, kind, index, dimensions);
    if (propInsideRoof(roof, candidate)) props.push(candidate);
  }
  return props;
}

function policeProps(roof, random) {
  const props = [];
  props.push(makeProp(roof, random, "service", 0, {
    width: Math.min(34, roof.w * 0.22),
    height: Math.min(16, roof.h * 0.18),
    margin: 10
  }));
  props.push(makeProp(roof, random, "hvac", 1, { width: 19, height: 12, margin: 11 }));
  if (roof.w > 70 && roof.h > 55) {
    props.push({
      id: "antenna-0",
      kind: "antenna",
      x: roof.x + roof.w * 0.5 - 4,
      y: roof.y + roof.h * 0.36 - 4,
      w: 8,
      h: 8
    });
  }
  return props.filter(prop => propInsideRoof(roof, prop));
}

function clubProps(roof, random) {
  const props = [];
  if (roof.w > 54 && roof.h > 36) {
    props.push({
      id: "skylight-0",
      kind: "club-skylight",
      x: roof.x + roof.w * 0.18,
      y: roof.y + roof.h * 0.28,
      w: roof.w * 0.46,
      h: Math.max(7, roof.h * 0.16)
    });
  }
  props.push(makeProp(roof, random, "vent", 1, { width: 8, height: 8, margin: 9 }));
  return props.filter(prop => propInsideRoof(roof, prop));
}

function colorsFor(building, kind, seed) {
  const base = Number.isFinite(Number(building.color)) ? Number(building.color) : DEFAULT_BUILDING_COLOR;
  const trim = Number.isFinite(Number(building.trim)) ? Number(building.trim) : DEFAULT_TRIM_COLOR;
  const variation = ((seed % 17) - 8) / 250;
  const varied = variation >= 0 ? lighten(base, variation) : darken(base, -variation);

  if (kind === BUILDING_PRESENTATION_KINDS.POLICE) {
    return {
      base: buildingPresentationMixColor(varied, 0x25364b, 0.48),
      roof: buildingPresentationMixColor(varied, 0x42566d, 0.34),
      roofLight: 0x8fa8c1,
      side: 0x121b27,
      trim: buildingPresentationMixColor(trim, 0xb7c8d8, 0.42),
      accent: 0x8fb3d6
    };
  }
  if (kind === BUILDING_PRESENTATION_KINDS.CLUB) {
    return {
      base: buildingPresentationMixColor(varied, 0x201725, 0.5),
      roof: buildingPresentationMixColor(varied, 0x34233c, 0.38),
      roofLight: 0x76607f,
      side: 0x100c14,
      trim: buildingPresentationMixColor(trim, 0x6d4a78, 0.5),
      accent: 0xd650c8
    };
  }
  if (kind === BUILDING_PRESENTATION_KINDS.CHURCH) {
    return {
      base: buildingPresentationMixColor(varied, 0x3b373b, 0.42),
      roof: buildingPresentationMixColor(varied, 0x514b50, 0.32),
      roofLight: 0x8c8288,
      side: 0x1a171b,
      trim: buildingPresentationMixColor(trim, 0x9d9196, 0.44),
      accent: 0xb5a98f
    };
  }
  return {
    base: varied,
    roof: lighten(varied, 0.07),
    roofLight: lighten(varied, 0.28),
    side: darken(varied, 0.42),
    trim: buildingPresentationMixColor(trim, varied, 0.22),
    accent: lighten(trim, 0.2)
  };
}

export function buildingPresentationPlan(building = {}) {
  const footprint = {
    x: Number(building.x) || 0,
    y: Number(building.y) || 0,
    w: Math.max(1, Number(building.w) || 1),
    h: Math.max(1, Number(building.h) || 1)
  };
  const kind = classifyBuildingPresentation(building);
  const seed = buildingPresentationSeed(building);
  const random = seededRandom(seed);
  const inset = clamp(Math.round(Math.min(footprint.w, footprint.h) * 0.035), 3, 6);
  const roof = insetRect(footprint, inset);
  const drop = clamp(Math.round(Math.min(footprint.w, footprint.h) * 0.045), 3, 7);
  const colors = colorsFor(building, kind, seed);

  let props = [];
  if (kind === BUILDING_PRESENTATION_KINDS.POLICE) props = policeProps(roof, random);
  else if (kind === BUILDING_PRESENTATION_KINDS.CLUB) props = clubProps(roof, random);
  else if (kind === BUILDING_PRESENTATION_KINDS.GENERIC) props = genericProps(roof, random);

  return Object.freeze({
    kind,
    seed,
    footprint: Object.freeze(footprint),
    roof: Object.freeze(roof),
    drop,
    colors: Object.freeze(colors),
    props: Object.freeze(props.map(prop => Object.freeze(prop))),
    ridgeOrientation: roof.w >= roof.h ? "horizontal" : "vertical",
    labelColor: kind === BUILDING_PRESENTATION_KINDS.CLUB
      ? 0xf29be8
      : kind === BUILDING_PRESENTATION_KINDS.POLICE
        ? 0xcce6ff
        : kind === BUILDING_PRESENTATION_KINDS.CHURCH
          ? 0xe6dcc7
          : 0xefe6ff
  });
}

function drawRoofProp(graphics, plan, prop) {
  const { colors } = plan;
  if (prop.kind === "vent") {
    graphics.fillStyle(darken(colors.roof, 0.32), 1).fillCircle(prop.x + prop.w / 2, prop.y + prop.h / 2, prop.w / 2);
    graphics.lineStyle(1, colors.roofLight, 0.55).strokeCircle(prop.x + prop.w / 2, prop.y + prop.h / 2, Math.max(2, prop.w / 2 - 1));
    return;
  }
  if (prop.kind === "antenna") {
    const cx = prop.x + prop.w / 2;
    const cy = prop.y + prop.h / 2;
    graphics.fillStyle(colors.side, 1).fillCircle(cx, cy, 3.5);
    graphics.lineStyle(1, colors.accent, 0.92)
      .lineBetween(cx - 7, cy, cx + 7, cy)
      .lineBetween(cx, cy - 7, cx, cy + 7);
    return;
  }
  if (prop.kind === "club-skylight") {
    graphics.fillStyle(0x1a101d, 1).fillRect(prop.x, prop.y, prop.w, prop.h);
    graphics.lineStyle(2, colors.accent, 0.82).strokeRect(prop.x, prop.y, prop.w, prop.h);
    graphics.fillStyle(colors.accent, 0.12).fillRect(prop.x + 3, prop.y + 2, Math.max(1, prop.w - 6), Math.max(1, prop.h - 4));
    return;
  }

  const fill = prop.kind === "skylight"
    ? buildingPresentationMixColor(colors.roof, 0x9bb5c1, 0.28)
    : prop.kind === "service"
      ? darken(colors.roof, 0.2)
      : darken(colors.roof, 0.12);
  graphics.fillStyle(colors.side, 0.48).fillRect(prop.x + 2, prop.y + 2, prop.w, prop.h);
  graphics.fillStyle(fill, 1).fillRect(prop.x, prop.y, prop.w, prop.h);
  graphics.lineStyle(1, colors.roofLight, 0.48).strokeRect(prop.x, prop.y, prop.w, prop.h);
  if (prop.kind === "hvac" || prop.kind === "service") {
    const vents = Math.max(1, Math.floor(prop.w / 7));
    graphics.lineStyle(1, colors.side, 0.55);
    for (let index = 1; index <= vents; index++) {
      const x = prop.x + prop.w * index / (vents + 1);
      graphics.lineBetween(x, prop.y + 2, x, prop.y + prop.h - 2);
    }
  }
}

function drawPoliceIdentity(graphics, plan) {
  const { roof, colors } = plan;
  const barWidth = Math.min(48, roof.w * 0.24);
  const y = roof.y + Math.max(7, roof.h * 0.12);
  const x = roof.x + roof.w - barWidth - 9;
  graphics.fillStyle(colors.side, 0.62).fillRect(x, y, barWidth, 5);
  graphics.fillStyle(colors.accent, 0.82).fillRect(x + 2, y + 1, barWidth * 0.45, 3);
  graphics.fillStyle(0xd7e4ee, 0.78).fillRect(x + 2 + barWidth * 0.45, y + 1, barWidth * 0.45, 3);
}

function drawClubIdentity(graphics, plan) {
  const { roof, colors } = plan;
  const inset = Math.max(8, Math.min(18, roof.w * 0.08));
  const y = roof.y + roof.h - 10;
  graphics.lineStyle(2, colors.accent, 0.86)
    .lineBetween(roof.x + inset, y, roof.x + roof.w - inset, y);
  graphics.lineStyle(4, colors.accent, 0.09)
    .lineBetween(roof.x + inset, y, roof.x + roof.w - inset, y);
}

function drawChurchIdentity(graphics, plan) {
  const { roof, colors, ridgeOrientation } = plan;
  const cx = roof.x + roof.w / 2;
  const cy = roof.y + roof.h / 2;
  graphics.lineStyle(2, colors.roofLight, 0.68);
  if (ridgeOrientation === "horizontal") {
    graphics.lineBetween(roof.x + 8, cy, roof.x + roof.w - 8, cy);
    graphics.lineStyle(1, colors.side, 0.48)
      .lineBetween(roof.x + 8, roof.y + 7, cx, cy)
      .lineBetween(roof.x + 8, roof.y + roof.h - 7, cx, cy)
      .lineBetween(roof.x + roof.w - 8, roof.y + 7, cx, cy)
      .lineBetween(roof.x + roof.w - 8, roof.y + roof.h - 7, cx, cy);
  } else {
    graphics.lineBetween(cx, roof.y + 8, cx, roof.y + roof.h - 8);
    graphics.lineStyle(1, colors.side, 0.48)
      .lineBetween(roof.x + 7, roof.y + 8, cx, cy)
      .lineBetween(roof.x + roof.w - 7, roof.y + 8, cx, cy)
      .lineBetween(roof.x + 7, roof.y + roof.h - 8, cx, cy)
      .lineBetween(roof.x + roof.w - 7, roof.y + roof.h - 8, cx, cy);
  }

  const steepleSize = clamp(Math.min(roof.w, roof.h) * 0.12, 9, 18);
  graphics.fillStyle(darken(colors.roof, 0.12), 1)
    .fillRect(cx - steepleSize / 2, cy - steepleSize / 2, steepleSize, steepleSize);
  graphics.lineStyle(1, colors.accent, 0.82)
    .strokeRect(cx - steepleSize / 2, cy - steepleSize / 2, steepleSize, steepleSize)
    .lineBetween(cx - steepleSize * 0.34, cy, cx + steepleSize * 0.34, cy)
    .lineBetween(cx, cy - steepleSize * 0.45, cx, cy + steepleSize * 0.45);
}

export function drawBuildingPresentation(graphics, building = {}) {
  if (!graphics) return null;
  const plan = buildingPresentationPlan(building);
  const { footprint, roof, colors, drop } = plan;

  // All visual volume remains inside the authored footprint. Collision and
  // navigation still use the exact original rectangle.
  graphics.fillStyle(colors.base, 1).fillRect(footprint.x, footprint.y, footprint.w, footprint.h);
  graphics.fillStyle(colors.side, 0.82)
    .fillRect(footprint.x, footprint.y + footprint.h - drop, footprint.w, drop)
    .fillRect(footprint.x + footprint.w - drop, footprint.y, drop, footprint.h);

  graphics.fillStyle(colors.roof, 1).fillRect(roof.x, roof.y, roof.w, roof.h);
  graphics.lineStyle(2, colors.trim, 0.92).strokeRect(footprint.x, footprint.y, footprint.w, footprint.h);
  graphics.lineStyle(1, colors.roofLight, 0.46)
    .lineBetween(roof.x, roof.y, roof.x + roof.w, roof.y)
    .lineBetween(roof.x, roof.y, roof.x, roof.y + roof.h);
  graphics.lineStyle(1, colors.side, 0.72)
    .lineBetween(roof.x, roof.y + roof.h, roof.x + roof.w, roof.y + roof.h)
    .lineBetween(roof.x + roof.w, roof.y, roof.x + roof.w, roof.y + roof.h);

  for (const prop of plan.props) drawRoofProp(graphics, plan, prop);

  if (plan.kind === BUILDING_PRESENTATION_KINDS.POLICE) drawPoliceIdentity(graphics, plan);
  else if (plan.kind === BUILDING_PRESENTATION_KINDS.CLUB) drawClubIdentity(graphics, plan);
  else if (plan.kind === BUILDING_PRESENTATION_KINDS.CHURCH) drawChurchIdentity(graphics, plan);
  else {
    const seamCount = clamp(Math.floor(Math.max(roof.w, roof.h) / 85), 1, 4);
    graphics.lineStyle(1, colors.side, 0.16);
    if (roof.w >= roof.h) {
      for (let index = 1; index <= seamCount; index++) {
        const x = roof.x + roof.w * index / (seamCount + 1);
        graphics.lineBetween(x, roof.y + 4, x, roof.y + roof.h - 4);
      }
    } else {
      for (let index = 1; index <= seamCount; index++) {
        const y = roof.y + roof.h * index / (seamCount + 1);
        graphics.lineBetween(roof.x + 4, y, roof.x + roof.w - 4, y);
      }
    }
  }

  return plan;
}
