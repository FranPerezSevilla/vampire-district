import { LAYERS } from "./district.js";
import { pointInsideCone } from "../utils/geometry.js";

export const PROP_TYPES = Object.freeze({
  STREETLIGHT: "streetlight"
});

export const PROP_DURABILITY = Object.freeze({
  [PROP_TYPES.STREETLIGHT]: 1
});

export function createDamageableProp(definition, overrides = {}) {
  const type = overrides.type || definition?.type || PROP_TYPES.STREETLIGHT;
  const maxDurability = Math.max(1, Number(overrides.maxDurability ?? PROP_DURABILITY[type] ?? 1));
  return {
    id: definition?.id || overrides.id || "prop",
    type,
    name: definition?.name || overrides.name || "world prop",
    x: Number(definition?.x ?? overrides.x) || 0,
    y: Number(definition?.y ?? overrides.y) || 0,
    layer: overrides.layer ?? definition?.layer ?? LAYERS.STREET,
    hitRadius: Math.max(0, Number(overrides.hitRadius ?? definition?.hitRadius ?? 7)),
    maxDurability,
    durability: maxDurability,
    broken: false,
    definition
  };
}

export function propInsideMeleeArc(origin, direction, prop, attack) {
  if (!origin || !direction || !prop || !attack || prop.broken) return false;
  const dx = prop.x - origin.x;
  const dy = prop.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const radius = Math.max(0, Number(prop.hitRadius) || 0);
  const expandedRange = Math.max(0, Number(attack.range) || 0) + radius;
  if (distance > expandedRange) return false;

  // The prop radius provides a small angular allowance near the edge of the
  // attack cone while preserving the same directional attack contract.
  const angularAllowance = distance > 0.001 ? Math.asin(Math.min(1, radius / distance)) : Math.PI;
  return pointInsideCone(
    origin,
    direction,
    prop,
    expandedRange,
    Math.max(0, Number(attack.halfAngle) || 0) + angularAllowance
  );
}

export function applyPropDamage(prop, amount = 1) {
  if (!prop || prop.broken || !Number.isFinite(amount) || amount <= 0) return {
    applied: false,
    broken: Boolean(prop?.broken),
    durability: Number(prop?.durability) || 0
  };

  prop.durability = Math.max(0, (Number(prop.durability) || 0) - amount);
  prop.broken = prop.durability <= 0;
  return {
    applied: true,
    broken: prop.broken,
    durability: prop.durability,
    maxDurability: prop.maxDurability
  };
}
