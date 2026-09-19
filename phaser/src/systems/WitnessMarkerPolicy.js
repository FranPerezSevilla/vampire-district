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
    // World annotations are disabled; simulation remains active.
    return null;
  }

  syncPersistentLabels() {
    return null;
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
