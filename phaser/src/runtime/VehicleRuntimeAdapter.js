export function enrichVehicleInputFrame(frame, handbrakeHeld = false) {
  if (!frame || typeof frame !== "object") return frame;
  const vehicleActionPressed = Boolean(frame.menuConfirmPressed && !frame.interactPressed);
  frame.vehicleActionPressed = vehicleActionPressed;
  frame.handbrakeHeld = Boolean(handbrakeHeld);
  // Reuse the existing wheel authority. On foot, weaponStep remains unchanged;
  // the vehicle filter clears weaponStep while this parallel edge becomes radio input.
  frame.radioStep = Math.sign(Number(frame.weaponStep) || 0);
  if (vehicleActionPressed) frame.traversePressed = true;
  return frame;
}

export function filterVehicleAwareInteractions(options = [], frame = {}, isVehicleAction = null) {
  const list = Array.isArray(options) ? options : [];
  if (typeof isVehicleAction !== "function") return list;
  const vehicleOnly = Boolean(frame?.vehicleActionPressed);
  const movementOnly = !vehicleOnly && Boolean(frame?.traversePressed);
  if (!vehicleOnly && !movementOnly) return list;

  const filtered = [];
  for (const option of list) {
    const vehicleAction = Boolean(isVehicleAction(option));
    if ((vehicleOnly && vehicleAction) || (movementOnly && !vehicleAction)) filtered.push(option);
  }
  return filtered;
}
