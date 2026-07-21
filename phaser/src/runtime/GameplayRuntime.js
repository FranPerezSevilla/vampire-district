import { PedestrianSystem } from "../systems/PedestrianSystem.js";
import { StreetFurnitureSystem } from "../systems/StreetFurnitureSystem.js";
import { VehicleSystem } from "../vehicles/VehicleSystem.js";
import { GameplayRuntime as GameplayRuntimeCore } from "./GameplayRuntimeCore.js";

const VEHICLE_ACTION_TYPES = new Set(["vehicleEnter", "vehicleExit"]);

function isVehicleAction(option) {
  return VEHICLE_ACTION_TYPES.has(option?.type);
}

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
    const originalBeginFrame = input?.beginFrame;
    const originalCollectInteractions = scene.collectInteractions;
    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);

    scene.pedestrianSystem?.update?.(dt);

    if (input && originalBeginFrame) {
      input.beginFrame = function vehicleAwareInputFrame() {
        const frame = originalBeginFrame.call(input);
        const vehicleActionPressed = Boolean(frame.menuConfirmPressed && !frame.interactPressed);
        const enriched = {
          ...frame,
          vehicleActionPressed,
          handbrakeHeld: Boolean(input.keys?.space?.isDown)
        };
        if (vehicle?.isDriving?.()) return vehicle.filterInputFrame(enriched);
        return vehicleActionPressed
          ? { ...enriched, traversePressed: true }
          : enriched;
      };
    }

    if (typeof originalCollectInteractions === "function") {
      scene.collectInteractions = function vehicleAwareInteractions() {
        const options = originalCollectInteractions.call(scene) || [];
        const frame = scene.currentInputFrame;
        if (frame?.vehicleActionPressed) return options.filter(isVehicleAction);
        if (frame?.traversePressed) return options.filter(option => !isVehicleAction(option));
        return options;
      };
    }

    try {
      super.update(time, deltaMs);
    } finally {
      if (input && originalBeginFrame) input.beginFrame = originalBeginFrame;
      if (originalCollectInteractions) scene.collectInteractions = originalCollectInteractions;
    }
  }

  finishFrame() {
    super.finishFrame();
    if (isVehicleAction(this.scene.nearestMovement)) {
      this.scene.traversalPromptLabel?.setText?.("ENTER");
    }
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
