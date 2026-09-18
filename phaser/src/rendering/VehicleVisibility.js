// Test the whole vehicle before Phaser walks its individual body, wheel and trim
// objects. Keep simulation visibility/active flags independent from the camera.
export function vehicleInsideCamera(vehicle, camera) {
  const view = camera?.worldView;
  // Unusual parent/camera transforms retain Phaser's original render path.
  if (!view || camera.rotation || vehicle.parentContainer
      || vehicle.scrollFactorX !== 1 || vehicle.scrollFactorY !== 1) return true;
  const radius = vehicle.vehicleCullRadius * Math.max(Math.abs(vehicle.scaleX), Math.abs(vehicle.scaleY)) + 4;
  if (!Number.isFinite(radius) || !Number.isFinite(view.width) || !Number.isFinite(view.height)) return true;
  return vehicle.x + radius >= view.x && vehicle.x - radius <= view.x + view.width
    && vehicle.y + radius >= view.y && vehicle.y - radius <= view.y + view.height;
}

export function installVehicleCulling(container) {
  // Repainting a pooled car can change its archetype. Measure its new parts once,
  // in local space, including nose, wheel overhang, text and rotated decorations.
  let radius = 0;
  for (const part of container.list || []) {
    const width = part.displayWidth, height = part.displayHeight;
    const dx = width * Math.max(part.originX, 1 - part.originX);
    const dy = height * Math.max(part.originY, 1 - part.originY);
    const extent = Math.hypot(part.x, part.y) + Math.hypot(dx, dy);
    if (!Number.isFinite(extent)) { radius = Infinity; break; }
    radius = Math.max(radius, extent + 2);
  }
  container.vehicleCullRadius = radius;
  if (typeof container.willRender !== 'function' || container.vehicleBaseWillRender) return;
  container.vehicleBaseWillRender = container.willRender;
  container.willRender = function (camera) {
    return this.vehicleBaseWillRender(camera) && vehicleInsideCamera(this, camera);
  };
}
