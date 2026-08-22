export const VEHICLE_CONTACT_SHADOW_PRESENTATION = Object.freeze({
  family: "vehicle-contact-shadow",
  color: 0x000000,
  alpha: 0.17,
  widthScale: 0.92,
  heightScale: 0.70,
  offsetX: 0.7,
  offsetY: 1.3,
  minimumWidth: 8,
  minimumHeight: 4
});

function finiteDimension(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function vehicleContactShadowSpec(archetype = {}) {
  const width = finiteDimension(archetype.width);
  const height = finiteDimension(archetype.height);
  const policy = VEHICLE_CONTACT_SHADOW_PRESENTATION;
  return Object.freeze({
    family: policy.family,
    color: policy.color,
    alpha: policy.alpha,
    x: policy.offsetX,
    y: policy.offsetY,
    width: Math.max(policy.minimumWidth, width * policy.widthScale),
    height: Math.max(policy.minimumHeight, height * policy.heightScale)
  });
}

export function createVehicleContactShadow(scene, archetype = {}) {
  if (!scene?.add?.ellipse) throw new TypeError("Vehicle contact shadow requires a Phaser scene ellipse factory.");
  const spec = vehicleContactShadowSpec(archetype);

  // Phaser Shape keeps fill alpha and object alpha as separate values. Use object alpha for this
  // presentation primitive so runtime/browser evidence observes the same restrained 0.17 opacity
  // that was already rendered through fill alpha, without changing the effective visual result.
  const shadow = scene.add.ellipse(spec.x, spec.y, spec.width, spec.height, spec.color, 1);
  if (typeof shadow.setAlpha === "function") shadow.setAlpha(spec.alpha);
  else shadow.alpha = spec.alpha;
  shadow.setName?.(spec.family);
  return shadow;
}
