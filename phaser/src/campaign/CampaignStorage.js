import {
  cloneCampaignState,
  createCampaignState,
  deserializeCampaignState,
  serializeCampaignState
} from "./CampaignState.js";
import { CAMPAIGN_STORAGE_KEY, LEGACY_CAMPAIGN_STORAGE_KEYS } from "./constants.js";

function uniqueKeys(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || "").trim())
    .filter(Boolean))];
}

export class CampaignStorage {
  constructor({
    storage = globalThis?.localStorage,
    key = CAMPAIGN_STORAGE_KEY,
    legacyKeys = null,
    now = () => Date.now()
  } = {}) {
    this.storage = storage;
    this.key = String(key || CAMPAIGN_STORAGE_KEY);
    this.legacyKeys = uniqueKeys(legacyKeys ?? (
      this.key === CAMPAIGN_STORAGE_KEY ? LEGACY_CAMPAIGN_STORAGE_KEYS : []
    )).filter(candidate => candidate !== this.key);
    this.now = now;
  }

  available() {
    return Boolean(this.storage?.getItem && this.storage?.setItem && this.storage?.removeItem);
  }

  readStoredValue() {
    const current = this.storage.getItem(this.key);
    if (current) return { raw: current, sourceKey: this.key };
    for (const legacyKey of this.legacyKeys) {
      const raw = this.storage.getItem(legacyKey);
      if (raw) return { raw, sourceKey: legacyKey };
    }
    return { raw: null, sourceKey: null };
  }

  migrateStorageKey(state, sourceKey) {
    if (!sourceKey || sourceKey === this.key || !this.available()) return false;
    const serialized = serializeCampaignState(state);
    this.storage.setItem(this.key, serialized);
    this.storage.removeItem(sourceKey);
    return true;
  }

  load({ fallbackToFresh = true } = {}) {
    if (!this.available()) return fallbackToFresh ? createCampaignState({ now: this.now() }) : null;
    let stored;
    try {
      stored = this.readStoredValue();
    } catch (error) {
      if (!fallbackToFresh) throw new Error(`Campaign storage read failed: ${error.message}`);
      return createCampaignState({ now: this.now() });
    }
    if (!stored.raw) return fallbackToFresh ? createCampaignState({ now: this.now() }) : null;
    let state;
    try {
      state = deserializeCampaignState(stored.raw, { now: this.now() });
    } catch (error) {
      if (!fallbackToFresh) throw error;
      return createCampaignState({ now: this.now() });
    }

    try {
      this.migrateStorageKey(state, stored.sourceKey);
    } catch {
      // A valid historical save remains playable even when the browser refuses
      // the one-time key rewrite. A later successful save will retry cleanup.
    }
    return state;
  }

  save(state) {
    const savedAt = Math.max(0, Math.trunc(Number(this.now()) || 0));
    state.updatedAt = savedAt;
    state.sequences.save = Math.max(0, Number(state.sequences.save) || 0) + 1;
    const serialized = serializeCampaignState(state);
    if (this.available()) {
      try {
        this.storage.setItem(this.key, serialized);
        for (const legacyKey of this.legacyKeys) this.storage.removeItem(legacyKey);
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
      for (const legacyKey of this.legacyKeys) this.storage.removeItem(legacyKey);
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
