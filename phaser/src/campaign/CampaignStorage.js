import {
  cloneCampaignState,
  createCampaignState,
  deserializeCampaignState,
  serializeCampaignState
} from "./CampaignState.js";
import { CAMPAIGN_STORAGE_KEY } from "./constants.js";

export class CampaignStorage {
  constructor({ storage = globalThis?.localStorage, key = CAMPAIGN_STORAGE_KEY, now = () => Date.now() } = {}) {
    this.storage = storage;
    this.key = String(key || CAMPAIGN_STORAGE_KEY);
    this.now = now;
  }

  available() {
    return Boolean(this.storage?.getItem && this.storage?.setItem && this.storage?.removeItem);
  }

  load({ fallbackToFresh = true } = {}) {
    if (!this.available()) return fallbackToFresh ? createCampaignState({ now: this.now() }) : null;
    let raw;
    try {
      raw = this.storage.getItem(this.key);
    } catch (error) {
      if (!fallbackToFresh) throw new Error(`Campaign storage read failed: ${error.message}`);
      return createCampaignState({ now: this.now() });
    }
    if (!raw) return fallbackToFresh ? createCampaignState({ now: this.now() }) : null;
    try {
      return deserializeCampaignState(raw, { now: this.now() });
    } catch (error) {
      if (!fallbackToFresh) throw error;
      return createCampaignState({ now: this.now() });
    }
  }

  save(state) {
    const savedAt = Math.max(0, Math.trunc(Number(this.now()) || 0));
    state.updatedAt = savedAt;
    state.sequences.save = Math.max(0, Number(state.sequences.save) || 0) + 1;
    const serialized = serializeCampaignState(state);
    if (this.available()) {
      try {
        this.storage.setItem(this.key, serialized);
      } catch (error) {
        throw new Error(`Campaign storage write failed: ${error.message}`);
      }
    }
    return {
      state: cloneCampaignState(state),
      serialized,
      savedAt,
      saveSequence: state.sequences.save
    };
  }

  remove() {
    if (!this.available()) return false;
    try {
      this.storage.removeItem(this.key);
      return true;
    } catch (error) {
      throw new Error(`Campaign storage reset failed: ${error.message}`);
    }
  }

  export(state) {
    return serializeCampaignState(state);
  }

  import(serialized, { persist = true } = {}) {
    const state = deserializeCampaignState(serialized, { now: this.now() });
    if (persist) this.save(state);
    return state;
  }
}
