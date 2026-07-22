import { PedestrianSystem } from "../systems/PedestrianSystem.js";
import { StreetFurnitureSystem } from "../systems/StreetFurnitureSystem.js";
import { ChunkStreamSystem } from "../streaming/ChunkStreamSystem.js";
import { DistrictPackSystem } from "../streaming/DistrictPackSystem.js";
import { DistantSimulationSystem } from "../streaming/DistantSimulationSystem.js";
import { EntityStreamSystem } from "../streaming/EntityStreamSystem.js";
import { MacroTrafficPoliceSystem } from "../streaming/MacroTrafficPoliceSystem.js";
import { installTrafficLocalAssignmentPolicy } from "../streaming/TrafficLocalAssignmentPolicy.js";
import { TrafficLocalBehaviorSystem } from "../streaming/TrafficLocalBehaviorSystem.js";
import { TrafficMaterializationSystem } from "../streaming/TrafficMaterializationSystem.js";
import { VehicleSystem } from "../vehicles/VehicleSystem.js";
import { GameplayRuntime as GameplayRuntimeCore } from "./GameplayRuntimeCore.js";

const VEHICLE_ACTION_TYPES = new Set(["vehicleEnter", "vehicleExit"]);

function isVehicleAction(option) {
  return VEHICLE_ACTION_TYPES.has(option?.type);
}

export class GameplayRuntime extends GameplayRuntimeCore {
  installDiagnostics() {
    super.installDiagnostics();
    this.diagnostics.claim("ChunkStreamSystem.update", "ChunkStreamSystem");
    this.diagnostics.claim("DistrictPackSystem.update", "DistrictPackSystem");
    this.diagnostics.claim("EntityStreamSystem.update", "EntityStreamSystem");
    this.diagnostics.claim("DistantSimulationSystem.update", "DistantSimulationSystem");
    this.diagnostics.claim("MacroTrafficPoliceSystem.update", "MacroTrafficPoliceSystem");
    this.diagnostics.claim("TrafficMaterializationSystem.update", "TrafficMaterializationSystem");
    this.diagnostics.claim("TrafficLocalBehaviorSystem.update", "TrafficLocalBehaviorSystem");
    this.diagnostics.claim("VehicleSystem.updateDriving", "VehicleSystem");
    this.diagnostics.claim("VehicleSystem.enterVehicle", "VehicleSystem");
    this.diagnostics.claim("PedestrianSystem.update", "PedestrianSystem");
    this.diagnostics.claim("StreetFurnitureSystem.resolveVehicleMove", "StreetFurnitureSystem");
    this.diagnostics.registerSystem("ChunkStreamSystem");
    this.diagnostics.registerSystem("DistrictPackSystem");
    this.diagnostics.registerSystem("EntityStreamSystem");
    this.diagnostics.registerSystem("DistantSimulationSystem");
    this.diagnostics.registerSystem("MacroTrafficPoliceSystem");
    this.diagnostics.registerSystem("TrafficMaterializationSystem");
    this.diagnostics.registerSystem("TrafficLocalBehaviorSystem");
    this.diagnostics.registerSystem("VehicleSystem");
    this.diagnostics.registerSystem("PedestrianSystem");
    this.diagnostics.registerSystem("StreetFurnitureSystem");
  }

  constructor(scene) {
    super(scene);
    scene.cityStreamSystem = new ChunkStreamSystem(scene);
    scene.pedestrianSystem = new PedestrianSystem(scene);
    scene.streetFurnitureSystem = new StreetFurnitureSystem(scene, scene.campaignSystem);
    scene.vehicleSystem = new VehicleSystem(scene, scene.campaignSystem);
    scene.entityStreamSystem = new EntityStreamSystem(scene);
    scene.districtPackSystem = new DistrictPackSystem(scene);
    scene.distantSimulationSystem = new DistantSimulationSystem(scene);
    scene.macroTrafficPoliceSystem = new MacroTrafficPoliceSystem(scene);
    scene.trafficMaterializationSystem = new TrafficMaterializationSystem(scene);
    scene.trafficLocalAssignmentPolicy = installTrafficLocalAssignmentPolicy(scene);
    scene.trafficLocalBehaviorSystem = new TrafficLocalBehaviorSystem(scene);
    scene.npcSystem?.refreshVisibility?.();
    scene.vehicleSystem?.refreshVisibility?.();
  }

  update(time, deltaMs) {
    const scene = this.scene;
    const input = scene.inputSystem;
    const vehicle = scene.vehicleSystem;
    const originalBeginFrame = input?.beginFrame;
    const originalCollectInteractions = scene.collectInteractions;
    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);

    scene.cityStreamSystem?.update?.();
    scene.districtPackSystem?.update?.();
    scene.entityStreamSystem?.update?.(dt);
    scene.distantSimulationSystem?.update?.(dt);
    scene.macroTrafficPoliceSystem?.update?.(dt);
    scene.trafficMaterializationSystem?.update?.(dt);
    scene.trafficLocalBehaviorSystem?.update?.(dt);
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
    this.scene.trafficLocalBehaviorSystem?.destroy?.();
    this.scene.trafficLocalBehaviorSystem = null;
    this.scene.trafficLocalAssignmentPolicy?.destroy?.();
    this.scene.trafficLocalAssignmentPolicy = null;
    this.scene.trafficMaterializationSystem?.destroy?.();
    this.scene.trafficMaterializationSystem = null;
    this.scene.macroTrafficPoliceSystem?.destroy?.();
    this.scene.macroTrafficPoliceSystem = null;
    this.scene.distantSimulationSystem?.destroy?.();
    this.scene.distantSimulationSystem = null;
    this.scene.districtPackSystem?.destroy?.();
    this.scene.districtPackSystem = null;
    this.scene.entityStreamSystem?.destroy?.();
    this.scene.entityStreamSystem = null;
    this.scene.vehicleSystem?.destroy?.();
    this.scene.vehicleSystem = null;
    this.scene.streetFurnitureSystem?.destroy?.();
    this.scene.streetFurnitureSystem = null;
    this.scene.pedestrianSystem?.destroy?.();
    this.scene.pedestrianSystem = null;
    this.scene.cityStreamSystem?.destroy?.();
    this.scene.cityStreamSystem = null;
    super.destroy();
  }
}
