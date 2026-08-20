function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finiteNumber(value, minimum)));
}

function normalizedBounds(bounds = {}) {
  return {
    x: finiteNumber(bounds.x),
    y: finiteNumber(bounds.y),
    w: Math.max(1, finiteNumber(bounds.w, 1)),
    h: Math.max(1, finiteNumber(bounds.h, 1))
  };
}

function requestedDepth(bounds, options = {}) {
  const shortSide = Math.min(bounds.w, bounds.h);
  const automatic = shortSide * finiteNumber(options.depthRatio, 0.14);
  const maximum = Math.max(1, Math.min(
    finiteNumber(options.maximumDepth, 4),
    shortSide / 3
  ));
  return clamp(options.depth ?? automatic, 1, maximum);
}

function styleColor(style, key, fallback = 0) {
  const value = Number(style?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function styleAlpha(style, key, fallback) {
  return clamp(style?.[key] ?? fallback, 0, 1);
}

/**
 * Computes a raised rectangular volume without mutating the authored module
 * bounds. The top, south face and east face remain inside the planned bounds;
 * only the renderer-only contact shadow may extend beyond them.
 */
export function createRaisedRectVolumeGeometry(bounds, options = {}) {
  const source = normalizedBounds(bounds);
  const depth = requestedDepth(source, options);
  const top = {
    x: source.x,
    y: source.y,
    w: Math.max(1, source.w - depth),
    h: Math.max(1, source.h - depth)
  };
  const south = {
    x: source.x,
    y: source.y + source.h - depth,
    w: Math.max(1, source.w - depth),
    h: depth
  };
  const east = {
    x: source.x + source.w - depth,
    y: source.y,
    w: depth,
    h: source.h
  };
  const shadow = {
    x: source.x + depth * 0.62,
    y: source.y + depth * 0.78,
    w: source.w,
    h: source.h
  };

  return { bounds: source, depth, top, south, east, shadow };
}

/**
 * Paints one shared top/south/east/contact grammar for small rectangular roof
 * volumes. The caller owns material colors; this helper owns only physical
 * separation and renderer-only depth.
 */
export function drawRaisedRectVolume(graphics, bounds, style = {}) {
  const geometry = createRaisedRectVolumeGeometry(bounds, style);
  const shadowColor = styleColor(style, "shadowColor", 0x000000);
  const topColor = styleColor(style, "topColor", 0x777777);
  const southColor = styleColor(style, "southColor", 0x444444);
  const eastColor = styleColor(style, "eastColor", 0x333333);
  const highlightColor = styleColor(style, "highlightColor", topColor);
  const seamColor = styleColor(style, "seamColor", southColor);

  graphics.fillStyle(shadowColor, styleAlpha(style, "shadowAlpha", 0.46));
  graphics.fillRect(
    geometry.shadow.x,
    geometry.shadow.y,
    geometry.shadow.w,
    geometry.shadow.h
  );

  graphics.fillStyle(southColor, styleAlpha(style, "southAlpha", 0.9));
  graphics.fillRect(
    geometry.south.x,
    geometry.south.y,
    geometry.south.w,
    geometry.south.h
  );

  graphics.fillStyle(eastColor, styleAlpha(style, "eastAlpha", 0.94));
  graphics.fillRect(
    geometry.east.x,
    geometry.east.y,
    geometry.east.w,
    geometry.east.h
  );

  graphics.fillStyle(topColor, styleAlpha(style, "topAlpha", 1));
  graphics.fillRect(
    geometry.top.x,
    geometry.top.y,
    geometry.top.w,
    geometry.top.h
  );

  graphics.lineStyle(
    Math.max(0.75, finiteNumber(style.highlightWidth, 1)),
    highlightColor,
    styleAlpha(style, "highlightAlpha", 0.32)
  );
  graphics.lineBetween(
    geometry.top.x,
    geometry.top.y,
    geometry.top.x + geometry.top.w,
    geometry.top.y
  );
  graphics.lineBetween(
    geometry.top.x,
    geometry.top.y,
    geometry.top.x,
    geometry.top.y + geometry.top.h
  );

  graphics.lineStyle(
    Math.max(0.75, finiteNumber(style.seamWidth, 1)),
    seamColor,
    styleAlpha(style, "seamAlpha", 0.3)
  );
  graphics.lineBetween(
    geometry.top.x,
    geometry.top.y + geometry.top.h,
    geometry.top.x + geometry.top.w,
    geometry.top.y + geometry.top.h
  );
  graphics.lineBetween(
    geometry.top.x + geometry.top.w,
    geometry.top.y,
    geometry.top.x + geometry.top.w,
    geometry.top.y + geometry.top.h
  );

  return geometry;
}

/**
 * Computes a small cylindrical volume. The planned bounds remain unchanged;
 * the visible side is a south-facing crescent created by offsetting the lower
 * body beneath the top circle.
 */
export function createCylindricalVolumeGeometry(bounds, options = {}) {
  const source = normalizedBounds(bounds);
  const depth = requestedDepth(source, {
    ...options,
    depthRatio: options.depthRatio ?? 0.12,
    maximumDepth: options.maximumDepth ?? 3
  });
  const radius = Math.max(1, Math.min(source.w, source.h) / 2 - depth * 0.08);
  const center = {
    x: source.x + source.w / 2,
    y: source.y + source.h / 2 - depth * 0.14
  };
  const sideCenter = {
    x: center.x,
    y: center.y + depth * 0.58
  };
  const shadowCenter = {
    x: center.x + depth * 0.58,
    y: center.y + depth * 0.76
  };

  return { bounds: source, depth, radius, center, sideCenter, shadowCenter };
}

/**
 * Paints one shared cylindrical top/side/contact grammar. It is intentionally
 * family-neutral; vents, antenna bases and future equipment provide their own
 * detail on top in later milestones.
 */
export function drawCylindricalVolume(graphics, bounds, style = {}) {
  const geometry = createCylindricalVolumeGeometry(bounds, style);
  const shadowColor = styleColor(style, "shadowColor", 0x000000);
  const topColor = styleColor(style, "topColor", 0x777777);
  const sideColor = styleColor(style, "sideColor", 0x3f3f3f);
  const highlightColor = styleColor(style, "highlightColor", topColor);
  const rimColor = styleColor(style, "rimColor", sideColor);

  graphics.fillStyle(shadowColor, styleAlpha(style, "shadowAlpha", 0.46));
  graphics.fillCircle(
    geometry.shadowCenter.x,
    geometry.shadowCenter.y,
    geometry.radius
  );

  graphics.fillStyle(sideColor, styleAlpha(style, "sideAlpha", 0.94));
  graphics.fillCircle(
    geometry.sideCenter.x,
    geometry.sideCenter.y,
    geometry.radius
  );

  graphics.fillStyle(topColor, styleAlpha(style, "topAlpha", 1));
  graphics.fillCircle(
    geometry.center.x,
    geometry.center.y,
    geometry.radius
  );

  graphics.fillStyle(highlightColor, styleAlpha(style, "highlightAlpha", 0.24));
  graphics.fillCircle(
    geometry.center.x - geometry.radius * 0.2,
    geometry.center.y - geometry.radius * 0.22,
    Math.max(1, geometry.radius * 0.48)
  );

  graphics.lineStyle(
    Math.max(0.75, finiteNumber(style.rimWidth, 1)),
    rimColor,
    styleAlpha(style, "rimAlpha", 0.42)
  );
  graphics.strokeCircle(
    geometry.center.x,
    geometry.center.y,
    geometry.radius
  );

  return geometry;
}
