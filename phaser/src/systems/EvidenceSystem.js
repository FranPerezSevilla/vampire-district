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