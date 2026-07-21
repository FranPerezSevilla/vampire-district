import { CampaignCheckpointSystem as CampaignCheckpointSystemCore } from "./CampaignCheckpointSystemCore.js";

export class CampaignCheckpointSystem extends CampaignCheckpointSystemCore {
  safetySnapshot() {
    const snapshot = super.safetySnapshot();
    if (!this.scene.vehicleSystem?.isDriving?.()) return snapshot;
    return {
      ...snapshot,
      // Vehicle occupancy remains an unsafe transition until the checkpoint
      // payload owns an atomic occupied-vehicle snapshot.
      transitionActive: true
    };
  }

  captureNpcState(npc) {
    return {
      ...super.captureNpcState(npc),
      hiddenSpotId: npc?.hiddenSpotId || null,
      hiddenSpotName: npc?.hiddenSpotName || null
    };
  }

  applyPendingNpcState(npc) {
    const state = this.pendingNpcStates.get(npc?.id);
    const applied = super.applyPendingNpcState(npc);
    if (applied && state) {
      npc.hiddenSpotId = state.hiddenSpotId || null;
      npc.hiddenSpotName = state.hiddenSpotName || null;
    }
    return applied;
  }
}