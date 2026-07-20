import {
  InteractionSystem as InteractionSystemCore,
  isTraversalAction as coreTraversalAction
} from "./InteractionSystemCore.js";

const VEHICLE_TRAVERSAL_TYPES = new Set(["vehicleEnter", "vehicleExit"]);

export function isTraversalAction(option) {
  return Boolean(
    option
    && (VEHICLE_TRAVERSAL_TYPES.has(option.type) || coreTraversalAction(option))
  );
}

export class InteractionSystem extends InteractionSystemCore {
  soundForOption(option) {
    if (["vehicleEnter", "vehicleExit"].includes(option?.type)) return "confirm";
    return super.soundForOption(option);
  }
}
