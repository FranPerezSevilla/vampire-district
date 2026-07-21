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
    const spot = super.currentHideSpot();
    if (!spot) return null;
    const propId = spot.streetPropId || spot.id;
    const dumpster = this.scene.streetFurnitureSystem?.dumpster?.(propId);
    if (!dumpster?.broken) return spot;

    const shadow = this.shadowAt(
      this.scene.player.x,
      this.scene.player.y,
      this.scene.currentLayer
    );
    return shadow
      ? { id: shadow.id || "shadow", name: shadow.name, cleanRadius: 70 }
      : null;
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