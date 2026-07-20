import { CampaignCheckpointSystem as CampaignCheckpointSystemCore } from "./CampaignCheckpointSystemCore.js";

export class CampaignCheckpointSystem extends CampaignCheckpointSystemCore {
  safetySnapshot() {
    const snapshot = super.safetySnapshot();
    if (!this.scene.vehicleSystem?.isDriving?.()) return snapshot;
    return {
      ...snapshot,
      // Milestone 12.1 restores authored on-foot checkpoints only. Treat active
      // vehicle occupancy like a world transition until vehicle snapshots are
      // added to the checkpoint schema in the next vehicle slice.
      transitionActive: true
    };
  }
}
