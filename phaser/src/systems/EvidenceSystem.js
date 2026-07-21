import { LAYERS } from "../data/district.js";
import { EvidenceSystem as EvidenceSystemCore } from "./EvidenceSystemCore.js";

export class EvidenceSystem extends EvidenceSystemCore {
  grabBody(body) {
    if (body) {
      body.hiddenSpotId = null;
      body.hiddenSpotName = null;
    }
    return super.grabBody(body);
  }

  dropBody() {
    const body = this.draggingBody;
    const result = super.dropBody();
    if (body) {
      body.hiddenSpotId = null;
      body.hiddenSpotName = null;
    }
    return result;
  }

  currentHideSpot() {
    if (this.scene.currentLayer === LAYERS.STREET) {
      const dumpster = this.scene.streetFurnitureSystem?.dumpsters?.find?.(candidate => (
        !candidate.broken
        && Phaser.Math.Distance.Between(
          this.scene.player.x,
          this.scene.player.y,
          candidate.x,
          candidate.y
        ) <= candidate.radius
      ));
      if (dumpster) {
        return {
          ...dumpster,
          streetPropId: dumpster.id,
          cleanRadius: dumpster.cleanRadius || 90
        };
      }

      const shadow = this.shadowAt(
        this.scene.player.x,
        this.scene.player.y,
        this.scene.currentLayer
      );
      return shadow
        ? { id: shadow.id || "shadow", name: shadow.name, cleanRadius: 70 }
        : null;
    }
    return super.currentHideSpot();
  }

  hideDraggedBody(spot) {
    const body = this.draggingBody;
    const result = super.hideDraggedBody(spot);
    if (body?.hiddenBody) {
      body.hiddenSpotId = String(spot?.streetPropId || spot?.id || "");
      body.hiddenSpotName = String(spot?.name || "");
    }
    return result;
  }
}