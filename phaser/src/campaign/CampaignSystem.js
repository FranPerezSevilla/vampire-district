import { CampaignEventBus } from "./CampaignEventBus.js";
import { CampaignStorage } from "./CampaignStorage.js";
import { cloneCampaignState, createCampaignState, sanitizeCampaignState } from "./CampaignState.js";
import { MissionRunner } from "./MissionRunner.js";
import { ReputationSystem } from "./ReputationSystem.js";
import { WalletSystem } from "./WalletSystem.js";
import { cleanTheSceneMission } from "./missions/cleanTheScene.js";
import { silenceTheJournalistMission } from "./missions/silenceTheJournalist.js";

const DEFAULT_DEFINITIONS = Object.freeze([
  silenceTheJournalistMission,
  cleanTheSceneMission
]);

export class CampaignSystem {
  constructor({
    storage = globalThis?.localStorage,
    storageKey,
    now = () => Date.now(),
    autoLoad = true,
    autoSave = true,
    definitions = DEFAULT_DEFINITIONS
  } = {}) {
    this.now = now;
    this.autoSave = Boolean(autoSave);
    this.storage = new CampaignStorage({ storage, key: storageKey, now });
    this.state = autoLoad
      ? this.storage.load({ fallbackToFresh: true })
      : createCampaignState({ now: now() });
    this.definitions = [...definitions];
    this.buildServices();
  }

  buildServices() {
    this.events?.clear?.();
    this.events = new CampaignEventBus(this.state, { now: this.now });
    this.wallet = new WalletSystem(this.state, { events: this.events, now: this.now });
    this.reputation = new ReputationSystem(this.state, { events: this.events });
    this.missions = new MissionRunner(this.state, {
      definitions: this.definitions,
      events: this.events,
      wallet: this.wallet,
      reputation: this.reputation,
      now: this.now,
      onDirty: () => this.touch()
    });
    this.disposeAutosave = this.events.on("*", event => {
      if (event.type === "campaign:saved" || event.type === "campaign:loaded") return;
      this.touch();
      if (this.autoSave) this.save();
    });
  }

  touch() {
    this.state.revision = Math.max(0, Number(this.state.revision) || 0) + 1;
    this.state.updatedAt = Math.max(0, Math.trunc(Number(this.now()) || 0));
  }

  save() {
    return this.storage.save(this.state);
  }

  reset({ persist = true } = {}) {
    this.disposeAutosave?.();
    this.state = createCampaignState({ now: this.now() });
    this.buildServices();
    if (persist) this.save();
    return this.snapshot();
  }

  export() {
    return this.storage.export(this.state);
  }

  import(serialized, { persist = true } = {}) {
    this.disposeAutosave?.();
    this.state = this.storage.import(serialized, { persist: false });
    this.buildServices();
    if (persist) this.save();
    this.events.emit("campaign:loaded", {
      version: this.state.version,
      revision: this.state.revision
    }, { record: false });
    return this.snapshot();
  }

  replaceState(candidate, { persist = false } = {}) {
    this.disposeAutosave?.();
    this.state = sanitizeCampaignState(candidate, { now: this.now() });
    this.buildServices();
    if (persist) this.save();
    return this.snapshot();
  }

  startMission(id, options = {}) {
    return this.missions.start(id, options);
  }

  handle(type, payload = {}) {
    return this.missions.handle(type, payload);
  }

  failActiveMission(reason, metadata = {}) {
    return this.missions.fail(reason, metadata);
  }

  snapshot() {
    return {
      state: cloneCampaignState(this.state),
      activeMission: this.missions.snapshot(),
      wallet: {
        balance: this.wallet.balance(),
        recent: this.wallet.recent(10)
      },
      reputation: {
        factions: this.reputation.factionSnapshot(),
        contacts: this.reputation.contactSnapshot()
      },
      definitions: this.definitions.map(definition => ({
        id: definition.id,
        title: definition.title,
        factionId: definition.factionId,
        objectiveCount: definition.objectives.length,
        replayable: definition.replayable
      }))
    };
  }

  summary() {
    const active = this.missions.snapshot();
    const mission = active
      ? `${active.title} · ${active.currentObjective?.label || active.status}`
      : "No active campaign mission";
    return `Cash $${this.wallet.balance().toFixed(0)} · ${mission}`;
  }

  destroy() {
    this.disposeAutosave?.();
    this.events?.clear?.();
  }
}

export { DEFAULT_DEFINITIONS };
