import { VehicleSystem } from "../vehicles/VehicleSystem.js";
import { GameplayRuntime as GameplayRuntimeCore } from "./GameplayRuntimeCore.js";

export class GameplayRuntime extends GameplayRuntimeCore {
  installDiagnostics() {
    super.installDiagnostics();
    this.diagnostics.claim("VehicleSystem.updateDriving", "VehicleSystem");
    this.diagnostics.claim("VehicleSystem.enterVehicle", "VehicleSystem");
    this.diagnostics.registerSystem("VehicleSystem");
  }

  constructor(scene) {
    super(scene);
    scene.vehicleSystem = new VehicleSystem(scene, scene.campaignSystem);
  }

  update(time, deltaMs) {
    const scene = this.scene;
    const input = scene.inputSystem;
    const noise = scene.movementNoiseSystem;
    const vehicle = scene.vehicleSystem;
    const drivingAtFrameStart = Boolean(vehicle?.isDriving?.());
    const originalBeginFrame = input?.beginFrame;
    const originalNoiseUpdate = noise?.update;

    if (drivingAtFrameStart && input && originalBeginFrame) {
      input.beginFrame = function vehicleInputFrame() {
        return vehicle.filterInputFrame(originalBeginFrame.call(input));
      };
    }
    if (drivingAtFrameStart && noise && originalNoiseUpdate) {
      noise.update = function suppressVehicleFootsteps(frame) {
        return originalNoiseUpdate.call(noise, {
          ...frame,
          hasMovementIntent: false,
          quietHeld: false
        });
      };
    }

    try {
      super.update(time, deltaMs);
    } finally {
      if (input && originalBeginFrame) input.beginFrame = originalBeginFrame;
      if (noise && originalNoiseUpdate) noise.update = originalNoiseUpdate;
    }
  }

  destroy() {
    this.scene.vehicleSystem?.destroy?.();
    this.scene.vehicleSystem = null;
    super.destroy();
  }
}
