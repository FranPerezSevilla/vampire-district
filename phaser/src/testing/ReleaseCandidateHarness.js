import { LAYERS } from "../data/district.js";
import { ReleaseCandidateHarness as ReleaseCandidateHarnessCore } from "./ReleaseCandidateHarnessCore.js";

export class ReleaseCandidateHarness extends ReleaseCandidateHarnessCore {
  async startPoliceStress() {
    this.unlockPostTutorialWorld();

    const police = this.scene.policeSystem;
    if (!this.originalTriggerArrest) {
      this.originalTriggerArrest = police.triggerArrest.bind(police);
      police.triggerArrest = reason => {
        this.events.push({ type: "stress-arrest-would-trigger", payload: { reason }, at: performance.now() });
      };
    }

    this.scene.switchLayer(
      LAYERS.STREET,
      { x: 488, y: 326 },
      "RC stress: central crossroad."
    );
    this.scene.exposureSystem.forceLevel(3, "RC stress scenario: maximum police response.");
    const desired = police.desiredCount?.(3) || 7;
    police.spawnForExposure(3);
    // Stress setup is deterministic: activate the same real helicopter system
    // immediately instead of waiting for a slow software-WebGL frame to own it.
    police.updateHelicopter?.(0.016, 3);

    await this.waitFor(
      () => this.scene.exposureSystem.level() >= 3
        && police.police().length >= desired
        && police.helicopter.active,
      { timeoutMs: 3_000, label: "level-three police response" }
    );
    return {
      ...this.stressSnapshot(),
      desiredPolice: desired
    };
  }
}
