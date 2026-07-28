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
''')

# Campaign-state migration for the retired faction/contact/vehicle identifiers.
path = root / 'phaser/src/campaign/CampaignState.js'
text = path.read_text(encoding='utf-8')
text = text.replace('  CAMPAIGN_SCHEMA_VERSION,\n  MISSION_STATUS', '  CAMPAIGN_SCHEMA_VERSION,\n  LEGACY_CAMPAIGN_CONTACT_IDS,\n  LEGACY_CAMPAIGN_FACTION_IDS,\n  LEGACY_CAMPAIGN_VEHICLE_IDS,\n  MISSION_STATUS')
needle = '''function numericRecord(value) {
  const result = {};
  for (const [key, item] of Object.entries(plainRecord(value))) {
    if (!key) continue;
    result[key] = finiteNumber(item, 0);
  }
  return result;
}
'''
helpers = '''
function remapRecordKeys(value, aliases = {}) {
  const result = { ...value };
  for (const [legacyId, canonicalId] of Object.entries(aliases)) {
    if (!(canonicalId in result) && legacyId in result) result[canonicalId] = result[legacyId];
    delete result[legacyId];
  }
  return result;
}

function remapString(value, aliases = {}) {
  const id = String(value || "").trim();
  return aliases[id] || id;
}

function remapVehicleFlagKeys(value) {
  const result = {};
  for (const [key, item] of Object.entries(stringRecord(value))) {
    let target = key;
    for (const [legacyId, canonicalId] of Object.entries(LEGACY_CAMPAIGN_VEHICLE_IDS)) {
      target = target.replace(`vehicle.${legacyId}.`, `vehicle.${canonicalId}.`);
    }
    result[target] = item;
  }
  return result;
}
'''
if 'function remapRecordKeys' not in text:
    text = text.replace(needle, needle + helpers)
text = text.replace('''      factions: {
        ...defaults.reputation.factions,
        ...numericRecord(plainRecord(source.reputation).factions)
      },
      contacts: numericRecord(plainRecord(source.reputation).contacts)''', '''      factions: {
        ...defaults.reputation.factions,
        ...remapRecordKeys(
          numericRecord(plainRecord(source.reputation).factions),
          LEGACY_CAMPAIGN_FACTION_IDS
        )
      },
      contacts: remapRecordKeys(
        numericRecord(plainRecord(source.reputation).contacts),
        LEGACY_CAMPAIGN_CONTACT_IDS
      )''')
text = text.replace('''      ownedVehicles: uniqueStrings(plainRecord(source.world).ownedVehicles),
      unlockedRefuges: uniqueStrings(plainRecord(source.world).unlockedRefuges),
      flags: stringRecord(plainRecord(source.world).flags)''', '''      ownedVehicles: uniqueStrings(
        uniqueStrings(plainRecord(source.world).ownedVehicles)
          .map(id => remapString(id, LEGACY_CAMPAIGN_VEHICLE_IDS))
      ),
      unlockedRefuges: uniqueStrings(plainRecord(source.world).unlockedRefuges),
      flags: remapVehicleFlagKeys(plainRecord(source.world).flags)''')
path.write_text(text, encoding='utf-8')

# Session-only entry key can be renamed directly.
replace('phaser/src/campaign/CampaignEntry.js', 'vampire-district-campaign-entry-once-v1', 'viceblood-campaign-entry-once-v1')

# UIScene no longer maps former product names at runtime.
path = root / 'phaser/src/scenes/UIScene.js'
text = path.read_text(encoding='utf-8')
text = text.replace('const visibleTitle = title === "Night Blood District" ? "Vampire District" : title;', 'const visibleTitle = title || "Viceblood";')
text = text.replace('const visibleTitle = title === "Viceblood" ? "Viceblood" : title;', 'const visibleTitle = title || "Viceblood";')
path.write_text(text, encoding='utf-8')

# Test corrections for retired lights and raw-generator reproducibility.
path = root / 'tests/district-runtime-source.test.js'
text = path.read_text(encoding='utf-8')
text = text.replace('assert.equal(scene.includes("LIGHT_GLOW_LIMIT"), true);', 'assert.equal(scene.includes("LIGHT_GLOW_LIMIT"), false);\n  assert.equal(scene.includes("drawLights"), false);')
path.write_text(text, encoding='utf-8')

path = root / 'tests/road-graph.test.js'
text = path.read_text(encoding='utf-8')
if 'buildings as generatedBuildings' not in text:
    text = text.replace('import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";', 'import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";\nimport { buildings as generatedBuildings } from "../phaser/src/data/generated/city-topology-v2.js";')
text = text.replace('''  const compiled = compileAxisAlignedRoadGraph(cityRoadGraph, {
    world: CITY_WORLD,
    buildings,''', '''  const compiled = compileAxisAlignedRoadGraph(cityRoadGraph, {
    world: CITY_WORLD,
    buildings: generatedBuildings,''')
text = text.replace('compiled.roadEdgeBands.every(band => buildings.every(building => surfaceOverlapArea(band, building) <= 0.01))', 'compiled.roadEdgeBands.every(band => generatedBuildings.every(building => surfaceOverlapArea(band, building) <= 0.01))')
path.write_text(text, encoding='utf-8')

# Runtime title regression.
replace('tests/browser/runtime-smoke.spec.js', 'toHaveText("Vampire District")', 'toHaveText("Viceblood")')

# Add migration coverage without depending on retired IDs in production code.
path = root / 'tests/campaign-system.test.js'
text = path.read_text(encoding='utf-8')
if 'from "../phaser/src/campaign/CampaignState.js"' not in text:
    text = text.replace('import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";', 'import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";\nimport { createCampaignState } from "../phaser/src/campaign/CampaignState.js";')
text = text.replace('''  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_STORAGE_KEY,
  MISSION_STATUS''', '''  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_STORAGE_KEY,
  LEGACY_CAMPAIGN_STORAGE_KEYS,
  MISSION_STATUS''')
text = text.replace('import { CAMPAIGN_EVENT_TYPES, CAMPAIGN_STORAGE_KEY, MISSION_STATUS } from "../phaser/src/campaign/constants.js";', 'import { CAMPAIGN_EVENT_TYPES, CAMPAIGN_STORAGE_KEY, LEGACY_CAMPAIGN_STORAGE_KEYS, MISSION_STATUS } from "../phaser/src/campaign/constants.js";')
if 'campaign storage migrates the historical product and faction identifiers once' not in text:
    insertion = '''

test("campaign storage migrates the historical product and faction identifiers once", () => {
  const storage = memoryStorage();
  const legacyKey = LEGACY_CAMPAIGN_STORAGE_KEYS[0];
  const state = createCampaignState({ now: 10 });
  state.player.cash = 77;
  state.reputation.factions = {
    blackglass_directorate: 12,
    red_assembly: -4
  };
  state.reputation.contacts = { directorate_cleaner: 6 };
  state.world.ownedVehicles = ["directorate_van"];
  state.world.flags = {
    "vehicle.directorate_van.status": "owned"
  };
  storage.setItem(legacyKey, JSON.stringify(state));

  const system = new CampaignSystem({
    storage,
    now: () => 20,
    autoLoad: true,
    autoSave: false
  });

  assert.equal(system.state.player.cash, 77);
  assert.equal(system.state.reputation.factions.first_estate, 12);
  assert.equal(system.state.reputation.factions.gutter_crown, -4);
  assert.equal(system.state.reputation.contacts.estate_cleaner, 6);
  assert.ok(system.state.world.ownedVehicles.includes("estate_van"));
  assert.equal(system.state.world.ownedVehicles.includes("directorate_van"), false);
  assert.equal(system.state.world.flags["vehicle.estate_van.status"], "owned");
  assert.equal(system.state.reputation.factions.blackglass_directorate, undefined);
  assert.equal(system.state.reputation.factions.red_assembly, undefined);
  assert.equal(storage.getItem(legacyKey), null);
  assert.ok(storage.getItem(CAMPAIGN_STORAGE_KEY));
});
'''
    marker = '\ntest("campaign export/import preserves money, reputation and explicit mission progress",'
    text = text.replace(marker, insertion + marker)
path.write_text(text, encoding='utf-8')

# Browser free-roam coverage loads an old key and proves one-time migration.
path = root / 'tests/browser/free-roam-baseline.spec.js'
text = path.read_text(encoding='utf-8')
if 'const LEGACY_STORAGE_KEY' not in text:
    text = text.replace('const STORAGE_KEY = "viceblood-campaign-v1";', 'const STORAGE_KEY = "viceblood-campaign-v1";\nconst LEGACY_STORAGE_KEY = "vampire-district-campaign-v1";')
text = text.replace('''  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: legacyMissionState() });''', '''  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: LEGACY_STORAGE_KEY, state: legacyMissionState() });''')
