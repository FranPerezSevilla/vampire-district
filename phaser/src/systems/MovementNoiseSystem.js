import { MovementNoiseSystem as MovementNoiseSystemCore } from "./MovementNoiseSystemCore.js";

export class MovementNoiseSystem extends MovementNoiseSystemCore {
  update(frame) {
    if (this.scene.vehicleSystem?.isDriving?.()) {
      return super.update({
        ...frame,
        hasMovementIntent: false,
        quietHeld: false
      });
    }
    return super.update(frame);
  }
}
