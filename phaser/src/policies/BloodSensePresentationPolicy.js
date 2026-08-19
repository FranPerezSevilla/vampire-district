import { MovementNoiseSystem } from "../systems/MovementNoiseSystem.js";
import { WitnessSystem } from "../systems/WitnessSystem.js";

export function bloodSensePresentationActive(scene) {
  return (Number(scene?.powersSystem?.senseTimer) || 0) > 0;
}

export function installBloodSensePresentationPolicy() {
  if (WitnessSystem.prototype.__viceBloodSensePresentationPolicy) return;
  WitnessSystem.prototype.__viceBloodSensePresentationPolicy = true;

  const originalVision = WitnessSystem.prototype.drawVisionCones;
  const originalHearing = WitnessSystem.prototype.drawHearingCones;
  const originalMovementNoiseDraw = MovementNoiseSystem.prototype.draw;

  WitnessSystem.prototype.drawVisionCones = function viceBloodDrawVisionCones(...args) {
    if (!bloodSensePresentationActive(this.scene)) return undefined;
    return originalVision.apply(this, args);
  };

  WitnessSystem.prototype.drawHearingCones = function viceBloodDrawHearingCones(...args) {
    if (!bloodSensePresentationActive(this.scene)) return undefined;
    return originalHearing.apply(this, args);
  };

  MovementNoiseSystem.prototype.draw = function viceBloodDrawMovementNoise(frame) {
    if (!bloodSensePresentationActive(this.scene)) {
      this.graphics?.clear?.();
      return undefined;
    }
    return originalMovementNoiseDraw.call(this, frame);
  };
}
