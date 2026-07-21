import { MISSION_STATUS, OBJECTIVE_STATUS } from "./constants.js";
import { CleanTheSceneSystem as CleanTheSceneSystemCore } from "./CleanTheSceneSystemCore.js";

// World items are reconstructed from mission state by the core. The facade adds
// layer visibility and preserves a corpse that was systemically re-exposed by a
// vehicle impact after the linear cleanup objective had already completed.
export class CleanTheSceneSystem extends CleanTheSceneSystemCore {
  syncWorld() {
    const synced = super.syncWorld();
    this.scene.streetFurnitureSystem?.restoreReleasedBodies?.();

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