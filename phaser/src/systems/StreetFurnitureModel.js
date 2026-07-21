export const STREET_PROP_TYPES = Object.freeze({
  STREETLIGHT: "streetlight",
  DUMPSTER: "dumpster"
});

export const STREET_PROP_IMPACT = Object.freeze({
  streetlightBreakSpeed: 20,
  dumpsterBreakSpeed: 34,
  lowSpeedBlockDamage: 0,
  streetlightVehicleDamage: 2,
  dumpsterVehicleDamage: 5
});

export function impactBreaksStreetlight(speed) {
  return Math.abs(Number(speed) || 0) >= STREET_PROP_IMPACT.streetlightBreakSpeed;
}

export function impactBreaksDumpster(speed) {
  return Math.abs(Number(speed) || 0) >= STREET_PROP_IMPACT.dumpsterBreakSpeed;
}

export function pointHitsVehicleFootprint(point, footprint, radius = 0) {
  const maximum = Math.max(0, Number(radius) || 0);
  return (Array.isArray(footprint) ? footprint : []).some(candidate => (
    Math.hypot(
      (Number(candidate?.x) || 0) - (Number(point?.x) || 0),
      (Number(candidate?.y) || 0) - (Number(point?.y) || 0)
    ) <= maximum
  ));
}

export function vehiclePropImpactResult(type, speed) {
  const impact = Math.abs(Number(speed) || 0);
  if (type === STREET_PROP_TYPES.STREETLIGHT) {
    const breaks = impactBreaksStreetlight(impact);
    return Object.freeze({
      breaks,
      blocks: !breaks,
      vehicleDamage: breaks ? STREET_PROP_IMPACT.streetlightVehicleDamage : 0
    });
  }
  if (type === STREET_PROP_TYPES.DUMPSTER) {
    const breaks = impactBreaksDumpster(impact);
    return Object.freeze({
      breaks,
      blocks: !breaks,
      vehicleDamage: breaks ? STREET_PROP_IMPACT.dumpsterVehicleDamage : 0
    });
  }
  return Object.freeze({ breaks: false, blocks: false, vehicleDamage: 0 });
}
