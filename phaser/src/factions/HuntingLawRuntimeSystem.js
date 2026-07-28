export class HuntingLawRuntimeSystem {
  constructor(scene) {
    this.scene = scene;
    this.huntingLaw = scene.campaignSystem?.huntingLaw || null;
    this.installDiagnostics();
  }

  installDiagnostics() {
    this.api = Object.freeze({
      snapshot: () => this.huntingLaw?.snapshot?.() || null,
      lastAssessment: () => this.huntingLaw?.lastAssessment?.() || null,
      assessment: id => this.huntingLaw?.assessment?.(id) || null,
      grantRight: candidate => this.huntingLaw?.grantRight?.(candidate) || null,
      revokeRight: (id, metadata = {}) => this.huntingLaw?.revokeRight?.(id, metadata) || false,
      protectVictim: candidate => this.huntingLaw?.protectVictim?.(candidate) || null,
      unprotectVictim: id => this.huntingLaw?.unprotectVictim?.(id) || false,
      assessFeed: facts => this.huntingLaw?.assessFeed?.(facts) || null,
      discover: (assessmentId, metadata = {}) => this.huntingLaw?.discover?.(assessmentId, metadata) || null
    });
    window.NBD_HUNTING_LAW = this.api;
    window.NBD_HUNTING_LAW_READY = true;
  }

  destroy() {
    if (window.NBD_HUNTING_LAW === this.api) delete window.NBD_HUNTING_LAW;
    if (!window.NBD_HUNTING_LAW) window.NBD_HUNTING_LAW_READY = false;
    this.api = null;
    this.huntingLaw = null;
  }
}
