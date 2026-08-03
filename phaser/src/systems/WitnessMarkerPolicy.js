const TRANSIENT_WITNESS_LABELS = new Set([
  "WTF",
  "! SHOCKED",
  "! VEIL",
  "! WITNESS",
  "RUN → REPORT",
  "! CAR WITNESSES",
  "! DRIVER"
]);

export function reportLabelForWitness(witness) {
  if (!witness || witness.dead || witness.inactive || witness.intercepted || witness.hasReported) {
    return null;
  }
  if (!witness.alarmed) return null;
  if ((Number(witness.reactionTimer) || 0) > 0) return "!";
  if (witness.reportNavigation?.phase === "flee") return "REPORT";
  return "!";
}

export class WitnessMarkerPolicy {
  constructor(scene) {
    if (!scene?.witnessSystem) {
      throw new TypeError("WitnessMarkerPolicy requires a scene with WitnessSystem.");
    }
    this.scene = scene;
    this.witnessSystem = scene.witnessSystem;
    this.originalDrawMarkers = this.witnessSystem.drawMarkers;
    this.wrappedDrawMarkers = null;
    this.destroyed = false;
    this.install();
  }

  install() {
    const policy = this;
    this.wrappedDrawMarkers = function stableWitnessMarkerDraw(graphics) {
      return policy.drawMarkers(this, graphics);
    };
    this.witnessSystem.drawMarkers = this.wrappedDrawMarkers;
  }

  drawMarkers(context, graphics) {
    const originalAddMapLabel = this.scene.addMapLabel;
    if (typeof originalAddMapLabel === "function") {
      this.scene.addMapLabel = function suppressTransientWitnessLabel(label, ...args) {
        if (TRANSIENT_WITNESS_LABELS.has(label)) return null;
        return originalAddMapLabel.call(this, label, ...args);
      };
    }

    try {
      this.originalDrawMarkers.call(context, graphics);
    } finally {
      if (originalAddMapLabel) this.scene.addMapLabel = originalAddMapLabel;
    }

    this.syncPersistentLabels();
  }

  syncPersistentLabels() {
    const active = new Set(this.witnessSystem.alarmedWitnesses?.() || []);
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!active.has(npc)) npc.__nbdReportLabel?.setVisible?.(false);
    }

    for (const witness of active) {
      if (witness.trafficWitness) continue;
      const text = reportLabelForWitness(witness);
      const visible = Boolean(text && witness.layer === this.scene.currentLayer);
      if (!visible) {
        witness.__nbdReportLabel?.setVisible?.(false);
        continue;
      }

      const label = this.ensureLabel(witness);
      label
        .setText?.(text)
        .setPosition?.(witness.x, witness.y - 22)
        .setVisible?.(true);
      label.setColor?.(witness.masqueradeRisk ? "#ff3b50" : "#ffb02e");
    }
  }

  ensureLabel(witness) {
    if (witness.__nbdReportLabel) return witness.__nbdReportLabel;
    witness.__nbdReportLabel = this.scene.add.text(witness.x, witness.y - 22, "!", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffb02e",
      backgroundColor: "rgba(5, 6, 11, .82)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(74).setVisible(false);
    witness.__nbdReportLabel.setResolution?.(3);
    witness.__nbdReportLabel.setStroke?.("#05060b", 2);
    return witness.__nbdReportLabel;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.witnessSystem.drawMarkers === this.wrappedDrawMarkers) {
      this.witnessSystem.drawMarkers = this.originalDrawMarkers;
    }
    for (const npc of this.scene.npcSystem?.npcs || []) {
      npc.__nbdReportLabel?.destroy?.();
      delete npc.__nbdReportLabel;
    }
  }
}
