import { CAMPAIGN_EVENT_TYPES } from "../campaign/constants.js";
import { districtZoneAt } from "../data/district.js";

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

export class TerritoryRuntimeSystem {
  constructor(scene) {
    this.scene = scene;
    this.territory = scene.campaignSystem?.territory || null;
    this.currentDistrictId = null;
    this.pendingAnnouncement = false;
    this.destroyed = false;
    this.installDiagnostics();
  }

  installDiagnostics() {
    this.api = Object.freeze({
      snapshot: () => this.snapshot(),
      current: () => this.current(),
      district: id => this.territory?.district?.(id) || null,
      districtAt: (x, y) => this.districtAt(x, y),
      relationship: id => this.territory?.relationship?.(id) || null,
      setInfluence: (districtId, factionId, value, metadata = {}) => this.territory?.setInfluence?.(districtId, factionId, value, metadata),
      modifyInfluence: (districtId, factionId, delta, metadata = {}) => this.territory?.modifyInfluence?.(districtId, factionId, delta, metadata),
      step: () => this.update(),
      announce: () => this.announceCurrent(true)
    });
    window.NBD_TERRITORY = this.api;
    window.NBD_TERRITORY_READY = true;
  }

  districtAt(x, y) {
    const zone = districtZoneAt(Number(x) || 0, Number(y) || 0);
    return this.territory?.district?.(zone?.id) || null;
  }

  current() {
    return this.currentDistrictId ? this.territory?.district?.(this.currentDistrictId) || null : null;
  }

  formatAnnouncement(district) {
    if (!district) return "";
    const pieces = [upper(district.name)];
    if (district.status === "controlled" && district.ownerLabel) {
      pieces.push(upper(district.ownerLabel), upper(district.relationship));
    } else {
      pieces.push(upper(district.status));
    }
    return pieces.join(" · ");
  }

  announceCurrent(force = false) {
    const district = this.current();
    if (!district) return false;
    if (!force && this.scene.registry?.get?.("uiPaused")) {
      this.pendingAnnouncement = true;
      return false;
    }
    const text = this.formatAnnouncement(district);
    this.scene.registry?.set?.("territoryDistrict", district);
    this.scene.registry?.set?.("territoryText", text);
    this.scene.registry?.set?.("lastActionText", text);
    this.pendingAnnouncement = false;
    return true;
  }

  enterDistrict(districtId) {
    const next = this.territory?.district?.(districtId);
    if (!next || next.id === this.currentDistrictId) return false;
    const previousId = this.currentDistrictId;
    this.currentDistrictId = next.id;
    this.pendingAnnouncement = true;
    this.scene.campaignSystem?.events?.emit?.(CAMPAIGN_EVENT_TYPES.TERRITORY_DISTRICT_ENTERED, {
      districtId: next.id,
      districtName: next.name,
      previousDistrictId: previousId,
      ownerId: next.ownerId,
      status: next.status,
      relationship: next.relationship
    }, { record: false });
    this.announceCurrent();
    return true;
  }

  update() {
    if (this.destroyed || !this.territory || !this.scene.player) return false;
    const zone = districtZoneAt(this.scene.player.x, this.scene.player.y);
    const changed = this.enterDistrict(zone?.id);
    if (!changed && this.pendingAnnouncement) this.announceCurrent();
    return changed;
  }

  snapshot() {
    return {
      currentDistrictId: this.currentDistrictId,
      current: this.current(),
      pendingAnnouncement: this.pendingAnnouncement,
      territory: this.territory?.snapshot?.() || null
    };
  }

  destroy() {
    this.destroyed = true;
    if (window.NBD_TERRITORY === this.api) delete window.NBD_TERRITORY;
    if (!window.NBD_TERRITORY) window.NBD_TERRITORY_READY = false;
    this.api = null;
  }
}
