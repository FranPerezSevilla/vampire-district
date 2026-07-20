import { MISSION_STATUS, OBJECTIVE_STATUS } from "./constants.js";
import { CleanTheSceneSystem as CleanTheSceneSystemCore } from "./CleanTheSceneSystemCore.js";

// World items are reconstructed from mission state by the core. Apply the
// scene-layer visibility rule here so street evidence never renders through
// rooftop or sewer presentation while retaining the same authoritative state.
export class CleanTheSceneSystem extends CleanTheSceneSystemCore {
  syncWorld() {
    const synced = super.syncWorld();
    const record = this.record();
    const point = this.placements().cameraRoll;
    const collected = record?.objectives?.collect_compromised_evidence?.status === OBJECTIVE_STATUS.COMPLETED;
    this.cameraRoll?.setVisible?.(Boolean(
      record?.status === MISSION_STATUS.ACTIVE
      && !collected
      && this.scene.currentLayer === point.layer
    ));
    return synced;
  }
}
