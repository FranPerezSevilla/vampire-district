import { installMotorizedPoliceAggressionPolicy } from "../police/MotorizedPoliceAggressionPolicy.js";
import { installMotorizedPoliceContainmentPolicy } from "../police/MotorizedPoliceContainmentPolicy.js";
import { installMotorizedPoliceLocalPolicy } from "../police/MotorizedPoliceLocalPolicy.js";
import { MotorizedPoliceSystem } from "../police/MotorizedPoliceSystem.js";
import { PedestrianSystem } from "../systems/PedestrianSystem.js";
import { StreetFurnitureSystem } from "../systems/StreetFurnitureSystem.js";
import { TrafficOccupantWitnessSystem } from "../systems/TrafficOccupantWitnessSystem.js";
import { WitnessMarkerPolicy } from "../systems/WitnessMarkerPolicy.js";
import { WitnessPerceptionPolicy } from "../systems/WitnessPerceptionPolicy.js";
import { WitnessReactionPolicy } from "../systems/WitnessReactionPolicy.js";
import { TerritoryRuntimeSystem } from "../factions/TerritoryRuntimeSystem.js";
import { HuntingLawRuntimeSystem } from "../factions/HuntingLawRuntimeSystem.js";
import { installBuildingSidewalkClearancePolicy } from "../streaming/BuildingSidewalkClearancePolicy.js";
import { ChunkStreamSystem } from "../streaming/ChunkStreamSystem.js";
import { DistrictPackSystem } from "../streaming/DistrictPackSystem.js";
import { DistantSimulationSystem } from "../streaming/DistantSimulationSystem.js";
import { EntityStreamSystem } from "../streaming/EntityStreamSystem.js";
import { MacroTrafficPoliceSystem } from "../streaming/MacroTrafficPoliceSystem.js";
import { installTrafficIntentDrivingPolicy } from "../streaming/TrafficIntentDrivingPolicy.js";
import { installTrafficLocalAssignmentPolicy } from "../streaming/TrafficLocalAssignmentPolicy.js";
import { TrafficImpactConsequencesSystem } from "../streaming/TrafficImpactConsequencesSystem.js";
import { TrafficLocalBehaviorSystem } from "../streaming/TrafficLocalBehaviorSystem.js";
import { installTrafficMassCollisionPolicy } from "../streaming/TrafficMassCollisionPolicy.js";
import { TrafficMaterializationSystem } from "../streaming/TrafficMaterializationSystem.js";
import { TrafficPhysicalConsequencesSystem } from "../streaming/TrafficPhysicalConsequencesSystem.js";
import { TrafficSteeringPresentationSystem } from "../streaming/TrafficSteeringPresentationSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { installVehicleCollisionSofteningPolicy } from "../vehicles/VehicleCollisionSofteningPolicy.js";
import { VehicleSystem } from "../vehicles/VehicleSystem.js";
import { GameplayRuntime as GameplayRuntimeCore } from "./GameplayRuntimeCore.js";
import { installPublishStateInstrumentation } from "./PublishStateInstrumentation.js";
import { enrichVehicleInputFrame, filterVehicleAwareInteractions } from "./VehicleRuntimeAdapter.js";

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
    this.diagnostics.claim("TrafficOccupantWitnessSystem.update", "TrafficOccupantWitnessSystem");
    this.diagnostics.claim("WitnessReactionPolicy.update", "WitnessReactionPolicy");
    this.diagnostics.claim("TrafficLocalBehaviorSystem.update", "TrafficLocalBehaviorSystem");
    this.diagnostics.claim("TrafficSteeringPresentationSystem.update", "TrafficSteeringPresentationSystem");
    this.diagnostics.claim("TrafficPhysicalConsequencesSystem.update", "TrafficPhysicalConsequencesSystem");
    this.diagnostics.claim("TrafficImpactConsequencesSystem.update", "TrafficImpactConsequencesSystem");
    this.diagnostics.claim("VehicleCollisionSofteningPolicy.updateDriving", "VehicleCollisionSofteningPolicy");
    this.diagnostics.claim("MotorizedPoliceSystem.update", "MotorizedPoliceSystem");
    this.diagnostics.claim("VehicleSystem.updateDriving", "VehicleSystem");
    this.diagnostics.claim("VehicleSystem.enterVehicle", "VehicleSystem");
    this.diagnostics.claim("PedestrianSystem.update", "PedestrianSystem");
    this.diagnostics.claim("StreetFurnitureSystem.resolveVehicleMove", "StreetFurnitureSystem");
    this.diagnostics.claim("TerritoryRuntimeSystem.update", "TerritoryRuntimeSystem");
    this.diagnostics.registerSystem("ChunkStreamSystem");
    this.diagnostics.registerSystem("DistrictPackSystem");
    this.diagnostics.registerSystem("EntityStreamSystem");
    this.diagnostics.registerSystem("DistantSimulationSystem");
    this.diagnostics.registerSystem("MacroTrafficPoliceSystem");
    this.diagnostics.registerSystem("TrafficMaterializationSystem");
    this.diagnostics.registerSystem("TrafficOccupantWitnessSystem");
    this.diagnostics.registerSystem("WitnessPerceptionPolicy");
    this.diagnostics.registerSystem("WitnessReactionPolicy");
    this.diagnostics.registerSystem("WitnessMarkerPolicy");
    this.diagnostics.registerSystem("TrafficLocalBehaviorSystem");
    this.diagnostics.registerSystem("TrafficSteeringPresentationSystem");
    this.diagnostics.registerSystem("TrafficPhysicalConsequencesSystem");
    this.diagnostics.registerSystem("TrafficImpactConsequencesSystem");
    this.diagnostics.registerSystem("VehicleCollisionSofteningPolicy");
    this.diagnostics.registerSystem("MotorizedPoliceSystem");
    this.diagnostics.registerSystem("VehicleSystem");
    this.diagnostics.registerSystem("PedestrianSystem");
    this.diagnostics.registerSystem("StreetFurnitureSystem");
    this.diagnostics.registerSystem("TerritoryRuntimeSystem");
    this.diagnostics.registerSystem("HuntingLawRuntimeSystem");
  }

  constructor(scene) {
    super(scene);
    this.removePublishStateInstrumentation = installPublishStateInstrumentation(scene, this.diagnostics);
    this.baseInputBeginFrame = null;
    this.baseCollectInteractions = null;
    this.vehicleAwareInputFrame = this.vehicleAwareInputFrame.bind(this);
    this.vehicleAwareInteractions = this.vehicleAwareInteractions.bind(this);
    scene.cityStreamSystem = new ChunkStreamSystem(scene);
    scene.buildingSidewalkClearancePolicy = installBuildingSidewalkClearancePolicy(scene);
    scene.pedestrianSystem = new PedestrianSystem(scene);
    scene.streetFurnitureSystem = new StreetFurnitureSystem(scene, scene.campaignSystem);
    scene.vehicleSystem = new VehicleSystem(scene, scene.campaignSystem);
    scene.entityStreamSystem = new EntityStreamSystem(scene);
    scene.districtPackSystem = new DistrictPackSystem(scene);
    scene.distantSimulationSystem = new DistantSimulationSystem(scene);
    scene.macroTrafficPoliceSystem = new MacroTrafficPoliceSystem(scene);
    scene.trafficMaterializationSystem = new TrafficMaterializationSystem(scene);
    scene.trafficOccupantWitnessSystem = new TrafficOccupantWitnessSystem(scene);
    scene.witnessPerceptionPolicy = new WitnessPerceptionPolicy(scene);
    scene.witnessReactionPolicy = new WitnessReactionPolicy(scene);
    scene.witnessMarkerPolicy = new WitnessMarkerPolicy(scene);
    scene.trafficLocalAssignmentPolicy = installTrafficLocalAssignmentPolicy(scene);
    scene.trafficLocalBehaviorSystem = new TrafficLocalBehaviorSystem(scene);
    scene.trafficSteeringPresentationSystem = new TrafficSteeringPresentationSystem(scene);
    scene.trafficIntentDrivingPolicy = installTrafficIntentDrivingPolicy(scene.trafficSteeringPresentationSystem);
    scene.trafficPhysicalConsequencesSystem = new TrafficPhysicalConsequencesSystem(scene);
    scene.trafficMassCollisionPolicy = installTrafficMassCollisionPolicy(scene.trafficPhysicalConsequencesSystem);
    scene.trafficImpactConsequencesSystem = new TrafficImpactConsequencesSystem(scene);
    scene.vehicleCollisionSofteningPolicy = installVehicleCollisionSofteningPolicy(scene);
    scene.motorizedPoliceSystem = new MotorizedPoliceSystem(scene, { maxUnits: 3 });
    scene.motorizedPoliceLocalPolicy = installMotorizedPoliceLocalPolicy(scene.motorizedPoliceSystem);
    scene.motorizedPoliceAggressionPolicy = installMotorizedPoliceAggressionPolicy(scene.motorizedPoliceSystem);
    scene.motorizedPoliceContainmentPolicy = installMotorizedPoliceContainmentPolicy(scene.motorizedPoliceSystem);
    scene.territoryRuntimeSystem = new TerritoryRuntimeSystem(scene);
    scene.huntingLawRuntimeSystem = new HuntingLawRuntimeSystem(scene);
    scene.npcSystem?.refreshVisibility?.();
    scene.vehicleSystem?.refreshVisibility?.();
  }

  vehicleAwareInputFrame() {
    const input = this.scene.inputSystem;
    const beginFrame = this.baseInputBeginFrame;
    const frame = typeof beginFrame === "function" ? beginFrame.call(input) : null;
    if (!frame) return frame;
    enrichVehicleInputFrame(frame, input?.keys?.space?.isDown);
    const vehicle = this.scene.vehicleSystem;
    return vehicle?.isDriving?.() ? vehicle.filterInputFrame(frame) : frame;
  }

  vehicleAwareInteractions() {
    const scene = this.scene;
    const collectInteractions = this.baseCollectInteractions;
    const options = typeof collectInteractions === "function"
      ? collectInteractions.call(scene) || []
      : [];
    return filterVehicleAwareInteractions(options, scene.currentInputFrame, isVehicleAction);
  }

  update(time, deltaMs) {
    const scene = this.scene;
    const input = scene.inputSystem;
    const diagnostics = this.diagnostics;
    const originalBeginFrame = input?.beginFrame;
    const originalCollectInteractions = scene.collectInteractions;
    this.baseInputBeginFrame = typeof originalBeginFrame === "function" ? originalBeginFrame : null;
    this.baseCollectInteractions = typeof originalCollectInteractions === "function" ? originalCollectInteractions : null;
    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);
    RawAudio.beginVehicleEngineFrame({ paused: Boolean(scene.registry?.get?.("uiPaused")) });

    let profileMark = diagnostics.beginSystem("StreamingPipeline");
    scene.cityStreamSystem?.update?.();
    scene.districtPackSystem?.update?.();
    scene.entityStreamSystem?.update?.(dt);
    scene.distantSimulationSystem?.update?.(dt);
    diagnostics.endSystem("StreamingPipeline", profileMark);

    profileMark = diagnostics.beginSystem("TrafficPipeline");
    scene.macroTrafficPoliceSystem?.update?.(dt);
    scene.trafficMaterializationSystem?.update?.(dt);
    scene.trafficOccupantWitnessSystem?.update?.(dt);
    scene.trafficLocalBehaviorSystem?.update?.(dt);
    scene.trafficSteeringPresentationSystem?.update?.(dt);
    scene.trafficPhysicalConsequencesSystem?.update?.(dt);
    scene.trafficImpactConsequencesSystem?.update?.(dt);
    diagnostics.endSystem("TrafficPipeline", profileMark);

    profileMark = diagnostics.beginSystem("MotorizedPoliceSystem");
    scene.motorizedPoliceSystem?.update?.(dt);
    diagnostics.endSystem("MotorizedPoliceSystem", profileMark);

    profileMark = diagnostics.beginSystem("PedestrianSystem");
    scene.pedestrianSystem?.update?.(dt);
    diagnostics.endSystem("PedestrianSystem", profileMark);

    if (input && this.baseInputBeginFrame) input.beginFrame = this.vehicleAwareInputFrame;
    if (this.baseCollectInteractions) scene.collectInteractions = this.vehicleAwareInteractions;

    profileMark = diagnostics.beginSystem("GameplayRuntimeCore");
    try {
      super.update(time, deltaMs);
    } finally {
      diagnostics.endSystem("GameplayRuntimeCore", profileMark);
      if (input && originalBeginFrame) input.beginFrame = originalBeginFrame;
      if (originalCollectInteractions) scene.collectInteractions = originalCollectInteractions;
      this.baseInputBeginFrame = null;
      this.baseCollectInteractions = null;
      RawAudio.endVehicleEngineFrame();
    }

    profileMark = diagnostics.beginSystem("TerritoryRuntimeSystem");
    scene.territoryRuntimeSystem?.update?.();
    diagnostics.endSystem("TerritoryRuntimeSystem", profileMark);
  }

  finishFrame() {
    super.finishFrame();
    if (isVehicleAction(this.scene.nearestMovement)) {
      this.scene.traversalPromptLabel?.setText?.("ENTER");
    }
  }

  destroy() {
    this.removePublishStateInstrumentation?.();
    this.removePublishStateInstrumentation = null;
    RawAudio.stopAllVehicleEngines();
    this.scene.huntingLawRuntimeSystem?.destroy?.();
    this.scene.huntingLawRuntimeSystem = null;
    this.scene.territoryRuntimeSystem?.destroy?.();
    this.scene.territoryRuntimeSystem = null;
    this.scene.motorizedPoliceContainmentPolicy?.destroy?.();
    this.scene.motorizedPoliceContainmentPolicy = null;
    this.scene.motorizedPoliceAggressionPolicy?.destroy?.();
    this.scene.motorizedPoliceAggressionPolicy = null;
    this.scene.motorizedPoliceLocalPolicy?.destroy?.();
    this.scene.motorizedPoliceLocalPolicy = null;
    this.scene.motorizedPoliceSystem?.destroy?.();
    this.scene.motorizedPoliceSystem = null;
    this.scene.vehicleCollisionSofteningPolicy?.destroy?.();
    this.scene.vehicleCollisionSofteningPolicy = null;
    this.scene.trafficImpactConsequencesSystem?.destroy?.();
    this.scene.trafficImpactConsequencesSystem = null;
    this.scene.trafficMassCollisionPolicy?.destroy?.();
    this.scene.trafficMassCollisionPolicy = null;
    this.scene.trafficPhysicalConsequencesSystem?.destroy?.();
    this.scene.trafficPhysicalConsequencesSystem = null;
    this.scene.trafficIntentDrivingPolicy?.destroy?.();
    this.scene.trafficIntentDrivingPolicy = null;
    this.scene.trafficSteeringPresentationSystem?.destroy?.();
    this.scene.trafficSteeringPresentationSystem = null;
    this.scene.trafficLocalBehaviorSystem?.destroy?.();
    this.scene.trafficLocalBehaviorSystem = null;
    this.scene.trafficLocalAssignmentPolicy?.destroy?.();
    this.scene.trafficLocalAssignmentPolicy = null;
    this.scene.witnessMarkerPolicy?.destroy?.();
    this.scene.witnessMarkerPolicy = null;
    this.scene.witnessReactionPolicy?.destroy?.();
    this.scene.witnessReactionPolicy = null;
    this.scene.witnessPerceptionPolicy?.destroy?.();
    this.scene.witnessPerceptionPolicy = null;
    this.scene.trafficOccupantWitnessSystem?.destroy?.();
    this.scene.trafficOccupantWitnessSystem = null;
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
    this.scene.buildingSidewalkClearancePolicy?.destroy?.();
    this.scene.buildingSidewalkClearancePolicy = null;
    this.scene.cityStreamSystem?.destroy?.();
    this.scene.cityStreamSystem = null;
    super.destroy();
  }
}
