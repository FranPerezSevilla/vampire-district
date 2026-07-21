export const BOOT_PROFILE_VERSION = 1;

export const BOOT_MODES = Object.freeze({
  NORMAL: "normal",
  EXPLORE: "explore",
  SCENARIO: "scenario"
});

const DEFAULT_EXPLORE_SPAWN = Object.freeze({ x: 438, y: 326, layer: 0 });

function normalizedScenarioId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function freezeProfile(profile) {
  return Object.freeze({
    ...profile,
    spawn: Object.freeze({ ...(profile.spawn || DEFAULT_EXPLORE_SPAWN) })
  });
}

export function createBootProfile(search = globalThis?.location?.search || "") {
  const params = new URLSearchParams(String(search || ""));
  const scenarioId = normalizedScenarioId(params.get("testScenario"));
  const requestedMode = String(params.get("mode") || "").toLowerCase();
  const mode = scenarioId
    ? BOOT_MODES.SCENARIO
    : requestedMode === BOOT_MODES.EXPLORE
      ? BOOT_MODES.EXPLORE
      : BOOT_MODES.NORMAL;
  const isolated = mode !== BOOT_MODES.NORMAL;
  const rcTest = params.has("rcTest") || mode === BOOT_MODES.SCENARIO;

  return freezeProfile({
    version: BOOT_PROFILE_VERSION,
    mode,
    scenarioId: scenarioId || null,
    rcTest,
    enableHarness: rcTest,
    persistentCampaign: !isolated,
    autoLoadCampaign: !isolated,
    autoSaveCampaign: !isolated,
    showCampaignEntry: mode === BOOT_MODES.NORMAL,
    autoStartOpeningMission: mode === BOOT_MODES.NORMAL,
    skipTutorial: isolated,
    startOnStreet: mode === BOOT_MODES.EXPLORE,
    spawn: DEFAULT_EXPLORE_SPAWN
  });
}

export const bootProfile = createBootProfile();

globalThis.NBD_BOOT_PROFILE = bootProfile;
