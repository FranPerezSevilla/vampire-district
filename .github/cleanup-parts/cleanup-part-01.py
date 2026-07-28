        run: |
          set -euo pipefail

          mkdir -p itch-build/phaser itch-build/node_modules/phaser/dist
          cp index.html itch-build/index.html
          cp node_modules/phaser/dist/phaser.min.js itch-build/node_modules/phaser/dist/phaser.min.js
          rsync -av phaser/ itch-build/phaser/

          if [[ ! -f itch-build/index.html ]]; then
            echo 'Error: index.html was not found at the root of the packaged build.'
            exit 1
          fi
          if [[ ! -f itch-build/node_modules/phaser/dist/phaser.min.js ]]; then
            echo 'Error: the pinned local Phaser runtime was not packaged.'
            exit 1
          fi

      # GitHub downloads every artifact as a ZIP. Uploading the prepared
      # directory directly makes that downloaded artifact the final itch.io ZIP,
      # instead of creating a ZIP inside another ZIP.
      - name: Upload final itch.io ZIP
        uses: actions/upload-artifact@v4
        with:
          name: ${{ inputs.zip_name }}
          path: itch-build/
          if-no-files-found: error
          include-hidden-files: true
          compression-level: 9
          retention-days: 14
''')

path = root / 'docs/ITCH_IO_BUILD.md'
text = path.read_text(encoding='utf-8')
text = text.replace('`vampire-district`', '`viceblood`').replace('vampire-district.zip', 'viceblood.zip')
# Normalize the package-contract block regardless of its previous wording.
text = re.sub(r'''```text
viceblood\.zip
.*?```''', '''```text
viceblood.zip
├── index.html
├── node_modules/
│   └── phaser/dist/phaser.min.js
└── phaser/
    ├── assets/
    ├── src/
    ├── styles.css
    └── release-candidate.css
```''', text, count=1, flags=re.S)
text = text.replace('The ZIP contains the repository browser application without GitHub-only files.', 'The downloaded ZIP contains only the playable browser application and the pinned Phaser runtime.')
path.write_text(text, encoding='utf-8')

# Correct the streamed-building facade export regression from PR #39.
replace('phaser/src/data/district.js', '  propExclusionZones,\n  buildings,\n  roofAreas,', '  propExclusionZones,\n  roofAreas,')

# Stable campaign IDs plus explicit compatibility aliases.
write('phaser/src/campaign/constants.js', '''export const CAMPAIGN_SCHEMA_VERSION = 2;
export const CAMPAIGN_STORAGE_KEY = "viceblood-campaign-v1";
export const LEGACY_CAMPAIGN_STORAGE_KEYS = Object.freeze([
  "vampire-district-campaign-v1"
]);

export const CAMPAIGN_FACTIONS = Object.freeze({
  FIRST_ESTATE: "first_estate",
  GUTTER_CROWN: "gutter_crown"
});

export const LEGACY_CAMPAIGN_FACTION_IDS = Object.freeze({
  blackglass_directorate: CAMPAIGN_FACTIONS.FIRST_ESTATE,
  red_assembly: CAMPAIGN_FACTIONS.GUTTER_CROWN
});

export const LEGACY_CAMPAIGN_CONTACT_IDS = Object.freeze({
  directorate_cleaner: "estate_cleaner"
});

export const LEGACY_CAMPAIGN_VEHICLE_IDS = Object.freeze({
  directorate_van: "estate_van"
});

export const CAMPAIGN_REFUGES = Object.freeze({
  ROOFTOP_REFUGE: "rooftop_refuge"
});

export const MISSION_STATUS = Object.freeze({
  INACTIVE: "inactive",
  ACTIVE: "active",
  COMPLETED: "completed",
  FAILED: "failed"
});

export const OBJECTIVE_STATUS = Object.freeze({
  LOCKED: "locked",
  ACTIVE: "active",
  COMPLETED: "completed",
  FAILED: "failed"
});

export const OBJECTIVE_TYPES = Object.freeze({
  REACH: "reach",
  TALK: "talk",
  COLLECT: "collect",
  NEUTRALIZE: "neutralize",
  DESTROY: "destroy",
  ESCAPE: "escape",
  RETURN: "return",
  STEAL_VEHICLE: "stealVehicle",
  DELIVER_VEHICLE: "deliverVehicle",
  LOSE_WANTED_LEVEL: "loseWantedLevel"
});

export const CAMPAIGN_EVENT_TYPES = Object.freeze({
  REACHED: "world:reached",
  TALKED: "conversation:completed",
  COLLECTED: "item:collected",
  NEUTRALIZED: "entity:neutralized",
  DESTROYED: "entity:destroyed",
  ESCAPED: "pursuit:escaped",
  RETURNED: "refuge:returned",
  VEHICLE_STOLEN: "vehicle:stolen",
  VEHICLE_DELIVERED: "vehicle:delivered",
  WANTED_CHANGED: "wanted:changed"
});

export const OBJECTIVE_EVENT_BY_TYPE = Object.freeze({
  [OBJECTIVE_TYPES.REACH]: CAMPAIGN_EVENT_TYPES.REACHED,
  [OBJECTIVE_TYPES.TALK]: CAMPAIGN_EVENT_TYPES.TALKED,
  [OBJECTIVE_TYPES.COLLECT]: CAMPAIGN_EVENT_TYPES.COLLECTED,
  [OBJECTIVE_TYPES.NEUTRALIZE]: CAMPAIGN_EVENT_TYPES.NEUTRALIZED,
  [OBJECTIVE_TYPES.DESTROY]: CAMPAIGN_EVENT_TYPES.DESTROYED,
  [OBJECTIVE_TYPES.ESCAPE]: CAMPAIGN_EVENT_TYPES.ESCAPED,
  [OBJECTIVE_TYPES.RETURN]: CAMPAIGN_EVENT_TYPES.RETURNED,
  [OBJECTIVE_TYPES.STEAL_VEHICLE]: CAMPAIGN_EVENT_TYPES.VEHICLE_STOLEN,
  [OBJECTIVE_TYPES.DELIVER_VEHICLE]: CAMPAIGN_EVENT_TYPES.VEHICLE_DELIVERED,
  [OBJECTIVE_TYPES.LOSE_WANTED_LEVEL]: CAMPAIGN_EVENT_TYPES.WANTED_CHANGED
});

export const CHECKPOINT_KINDS = Object.freeze({
  OBJECTIVE: "objective",
  MISSION_COMPLETE: "mission-complete",
  SYNTHESIZED: "synthesized"
});

export const REPUTATION_LIMITS = Object.freeze({ min: -100, max: 100 });

export const REPUTATION_TIERS = Object.freeze([
  Object.freeze({ id: "hostile", min: -100, max: -61, label: "Hostile" }),
  Object.freeze({ id: "watched", min: -60, max: -31, label: "Watched" }),
  Object.freeze({ id: "distrusted", min: -30, max: -11, label: "Distrusted" }),
  Object.freeze({ id: "neutral", min: -10, max: 10, label: "Neutral" }),
  Object.freeze({ id: "useful", min: 11, max: 35, label: "Useful" }),
  Object.freeze({ id: "favoured", min: 36, max: 65, label: "Favoured" }),
  Object.freeze({ id: "trusted", min: 66, max: 100, label: "Trusted" })
]);
''')

write('phaser/src/campaign/CampaignStorage.js', '''import {
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
