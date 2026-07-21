import { MISSION_STATUS, OBJECTIVE_STATUS } from "./constants.js";
import { CleanTheSceneSystem as CleanTheSceneSystemCore } from "./CleanTheSceneSystemCore.js";

// World items are reconstructed from mission state by the core. The facade adds
// layer visibility and preserves a corpse that was systemically re-exposed by a
// vehicle impact after the linear cleanup objective had already completed.
export class CleanTheSceneSystem extends CleanTheSceneSystemCore {
  syncWorld() {
    const body = this.scene.npcSystem?.npcs?.find?.(npc => npc.id === "exposed_body");
    const wasDragging = Boolean(body && this.scene.evidenceSystem?.draggingBody === body);
    const draggedState = wasDragging
      ? { x: body.x, y: body.y, layer: body.layer }
      : null;
    const released = body
      ? this.scene.streetFurnitureSystem?.releasedBodyState?.(body.id)
      : null;

    const synced = super.syncWorld();
    this.scene.streetFurnitureSystem?.restoreReleasedBodies?.();

    if (body && released && draggedState) {
      body.inactive = false;
      body.hiddenBody = false;
      body.dragged = true;
      body.exposedAfterContainment = true;
      body.exposedByStreetPropId = released.streetPropId;
      body.x = draggedState.x;
      body.y = draggedState.y;
      body.layer = draggedState.layer;
      body.container?.setPosition?.(body.x, body.y).setVisible?.(
        body.layer === this.scene.currentLayer
      );
    }

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