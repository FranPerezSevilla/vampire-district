import { PedestrianSystem } from "../systems/PedestrianSystem.js";
import { StreetFurnitureSystem } from "../systems/StreetFurnitureSystem.js";
import { VehicleSystem } from "../vehicles/VehicleSystem.js";
import { GameplayRuntime as GameplayRuntimeCore } from "./GameplayRuntimeCore.js";

export class GameplayRuntime extends GameplayRuntimeCore {
  installDiagnostics() {
    super.installDiagnostics();
    this.diagnostics.claim("VehicleSystem.updateDriving", "VehicleSystem");
    this.diagnostics.claim("VehicleSystem.enterVehicle", "VehicleSystem");
    this.diagnostics.claim("PedestrianSystem.update", "PedestrianSystem");
    this.diagnostics.claim("StreetFurnitureSystem.resolveVehicleMove", "StreetFurnitureSystem");
    this.diagnostics.registerSystem("VehicleSystem");
    this.diagnostics.registerSystem("PedestrianSystem");
    this.diagnostics.registerSystem("StreetFurnitureSystem");
  }

  constructor(scene) {
    super(scene);
    scene.pedestrianSystem = new PedestrianSystem(scene);
    scene.streetFurnitureSystem = new StreetFurnitureSystem(scene, scene.campaignSystem);
    scene.vehicleSystem = new VehicleSystem(scene, scene.campaignSystem);
  }

  update(time, deltaMs) {
    const scene = this.scene;
    const input = scene.inputSystem;
    const vehicle = scene.vehicleSystem;
    const drivingAtFrameStart = Boolean(vehicle?.isDriving?.());
    const originalBeginFrame = input?.beginFrame;
    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);
    scene.pedestrianSystem?.update?.(dt);
    if (drivingAtFrameStart && input && originalBeginFrame) {
      input.beginFrame = function vehicleInputFrame() { return vehicle.filterInputFrame(originalBeginFrame.call(input)); };
    }
    try { super.update(time, deltaMs); }
    finally { if (input && originalBeginFrame) input.beginFrame = originalBeginFrame; }
  }

  destroy() {
    this.scene.vehicleSystem?.destroy?.();
    this.scene.vehicleSystem = null;
    this.scene.streetFurnitureSystem?.destroy?.();
    this.scene.streetFurnitureSystem = null;
    this.scene.pedestrianSystem?.destroy?.();
    this.scene.pedestrianSystem = null;
    super.destroy();
  }
}