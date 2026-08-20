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

/**
 * Creates two joined orthogonal marker segments without assigning any family
 * semantics to them. Callers decide material, identity accent and proportions;
 * this helper owns only deterministic geometry inside the authored marker
 * bounds. A church can bias the junction upward while a later institutional
 * family can use the centered default without duplicating geometry code.
 */
export function createOrthogonalMarkerGeometry(bounds, options = {}) {
  if (!bounds) return null;
  const source = normalizedBounds(bounds);
  const shortSide = Math.min(source.w, source.h);
  if (shortSide < 6) return null;

  const marginRatio = clamp(options.marginRatio ?? 0.08, 0.04, 0.2);
  const maximumMargin = Math.max(0.75, finiteNumber(options.maximumMargin, 1.5));
  const margin = Math.max(0.75, Math.min(maximumMargin, shortSide * marginRatio));
  const innerWidth = Math.max(1, source.w - margin * 2);
  const innerHeight = Math.max(1, source.h - margin * 2);

  const stemWidthRatio = clamp(options.stemWidthRatio ?? 0.28, 0.12, 0.5);
  const armHeightRatio = clamp(options.armHeightRatio ?? 0.24, 0.12, 0.5);
  const armSpanRatio = clamp(options.armSpanRatio ?? 0.76, 0.35, 1);
  const junctionRatio = clamp(options.junctionRatio ?? 0.5, 0.25, 0.75);

  const maximumStemWidth = Math.max(2, finiteNumber(options.maximumStemWidth, 4.5));
  const maximumArmHeight = Math.max(2, finiteNumber(options.maximumArmHeight, 4));
  const maximumArmSpan = Math.max(2, finiteNumber(options.maximumArmSpan, 11));

  const stemWidth = Math.max(2, Math.min(innerWidth, innerWidth * stemWidthRatio, maximumStemWidth));
  const armHeight = Math.max(2, Math.min(innerHeight, innerHeight * armHeightRatio, maximumArmHeight));
  const armWidth = Math.max(
    stemWidth,
    Math.min(innerWidth, innerWidth * armSpanRatio, maximumArmSpan)
  );
  const centerX = source.x + source.w / 2;
  const armCenterY = source.y + margin + innerHeight * junctionRatio;

  return {
    bounds: source,
    stem: {
      x: centerX - stemWidth / 2,
      y: source.y + margin,
      w: stemWidth,
      h: innerHeight
    },
    arm: {
      x: centerX - armWidth / 2,
      y: armCenterY - armHeight / 2,
      w: armWidth,
      h: armHeight
    },
    junction: {
      x: centerX,
      y: armCenterY
    }
  };
}
