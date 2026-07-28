const sound = (id, category, trigger, options = {}) => Object.freeze({
  id,
  category,
  trigger,
  file: options.file || null,
  loop: Boolean(options.loop),
  volume: options.volume ?? 1,
  spatial: Boolean(options.spatial),
  priority: options.priority || "normal",
  fallback: options.fallback || null,
  notes: options.notes || ""
});

/**
 * Canonical Viceblood sound-event registry.
 *
 * `file: null` intentionally means that the event is wired and ready but still
 * needs a real audio asset. Add the final repository-relative file path when the
 * asset is selected. Existing procedural WebAudio sounds keep their current
 * RawAudio fallback name so the game remains audible while the catalogue is
 * being filled.
 */
export const SOUND_CATALOG = Object.freeze({
  // Player movement
  step: sound("step", "player", "Walking movement tick", { fallback: "step", spatial: true, notes: "Dry shoe on asphalt/concrete; several variants recommended." }),
  sprintStep: sound("sprintStep", "player", "Fast movement tick", { fallback: "sprintStep", spatial: true, notes: "Heavier and faster than step." }),
  playerLandSoft: sound("playerLandSoft", "player", "Short fall or rooftop landing", { spatial: true }),
  playerLandHard: sound("playerLandHard", "player", "Long fall impact", { spatial: true, priority: "high" }),
  playerClothesRustle: sound("playerClothesRustle", "player", "Sharp turn or movement start", { spatial: true, volume: 0.55 }),
  playerCollisionWall: sound("playerCollisionWall", "player", "Player hits a wall or obstacle", { spatial: true }),

  // Vampire powers
  dash: sound("dash", "powers", "Successful Shadow Dash", { fallback: "dash", spatial: true, priority: "high" }),
  dashFail: sound("dashFail", "powers", "Blocked or cooling-down Shadow Dash", { fallback: "dashFail" }),
  whisper: sound("whisper", "powers", "Successful Whisper", { fallback: "whisper", spatial: true }),
  whisperFail: sound("whisperFail", "powers", "Whisper has no valid target", { fallback: "whisperFail" }),
  sense: sound("sense", "powers", "Blood Sense activation", { fallback: "sense", priority: "high" }),
  senseEnd: sound("senseEnd", "powers", "Blood Sense expires"),
  hungerWarning: sound("hungerWarning", "powers", "Hunger crosses warning threshold", { priority: "high" }),
  hungerCritical: sound("hungerCritical", "powers", "Hunger crosses critical threshold", { priority: "critical" }),

  // Combat and feeding
  stun: sound("stun", "combat", "NPC is stunned", { fallback: "stun", spatial: true }),
  kill: sound("kill", "combat", "NPC is killed", { fallback: "kill", spatial: true, priority: "high" }),
  attackSwing: sound("attackSwing", "combat", "Player melee attack starts", { spatial: true }),
  attackHitBody: sound("attackHitBody", "combat", "Melee attack hits a body", { spatial: true }),
  attackHitMetal: sound("attackHitMetal", "combat", "Attack hits metal", { spatial: true }),
  attackMiss: sound("attackMiss", "combat", "Attack misses", { spatial: true }),
  drainStart: sound("drainStart", "feeding", "Drain action starts", { fallback: "drainStart", spatial: true, priority: "high" }),
  drainLoop: sound("drainLoop", "feeding", "Drain channel remains active", { loop: true, spatial: true }),
  drainComplete: sound("drainComplete", "feeding", "Drain completes", { fallback: "drainComplete", spatial: true, priority: "high" }),
  drainCancel: sound("drainCancel", "feeding", "Drain is interrupted", { fallback: "drainCancel" }),
  ratDrain: sound("ratDrain", "feeding", "Rat feeding completes", { spatial: true }),

  // Bodies and evidence
  bodyDrag: sound("bodyDrag", "evidence", "Body dragging movement tick", { fallback: "bodyDrag", spatial: true }),
  bodyDrop: sound("bodyDrop", "evidence", "Dragged body is released", { fallback: "bodyDrop", spatial: true }),
  bodyHide: sound("bodyHide", "evidence", "Body is hidden in a container", { fallback: "bodyHide", spatial: true }),
  containerOpen: sound("containerOpen", "evidence", "Body container opens", { spatial: true }),
  containerClose: sound("containerClose", "evidence", "Body container closes", { spatial: true }),
  evidenceDiscovered: sound("evidenceDiscovered", "evidence", "Police or witness finds evidence", { priority: "high" }),

  // Traversal and environment interactions
  breakLight: sound("breakLight", "world", "Street light is broken", { fallback: "breakLight", spatial: true, priority: "high" }),
  routeRoof: sound("routeRoof", "traversal", "Rooftop jump starts", { fallback: "routeRoof", spatial: true }),
  routeRoofLand: sound("routeRoofLand", "traversal", "Rooftop jump lands", { spatial: true }),
  routeClimb: sound("routeClimb", "traversal", "Fire escape climb starts", { fallback: "routeClimb", spatial: true }),
  routeClimbLoop: sound("routeClimbLoop", "traversal", "Fire escape climb movement", { loop: true, spatial: true }),
  routeSewer: sound("routeSewer", "traversal", "Sewer entrance or exit", { fallback: "routeSewer", spatial: true }),
  manholeOpen: sound("manholeOpen", "traversal", "Manhole cover opens", { spatial: true }),
  manholeClose: sound("manholeClose", "traversal", "Manhole cover closes", { spatial: true }),
  doorOpen: sound("doorOpen", "world", "Generic door opens", { spatial: true }),
  doorClose: sound("doorClose", "world", "Generic door closes", { spatial: true }),
  metalGate: sound("metalGate", "world", "Metal gate moves", { spatial: true }),

  // Witnesses and civilians
  witnessWtf: sound("witnessWtf", "npc", "Witness notices suspicious behaviour", { fallback: "witnessWtf", spatial: true }),
  witnessRun: sound("witnessRun", "npc", "Witness begins fleeing", { fallback: "witnessRun", spatial: true }),
  witnessReport: sound("witnessReport", "npc", "Witness successfully reports a crime", { fallback: "witnessReport", spatial: true, priority: "high" }),
  witnessBodyFound: sound("witnessBodyFound", "npc", "Civilian discovers a body", { spatial: true, priority: "high" }),
  civilianScream: sound("civilianScream", "npc", "Civilian screams", { spatial: true, priority: "high" }),
  civilianChatter: sound("civilianChatter", "npc", "Ambient civilian voice line", { spatial: true, volume: 0.45 }),
  civilianFootsteps: sound("civilianFootsteps", "npc", "Nearby civilian movement", { spatial: true, volume: 0.45 }),

  // Police, hunters and exposure
  police: sound("police", "police", "Police pressure increases or units engage", { fallback: "police", priority: "high" }),
  policeSirenLoop: sound("policeSirenLoop", "police", "Active police vehicle nearby", { loop: true, spatial: true, priority: "high" }),
  policeRadio: sound("policeRadio", "police", "Police radio chatter", { spatial: true }),
  policeSpotPlayer: sound("policeSpotPlayer", "police", "Officer identifies the player", { spatial: true, priority: "high" }),
  policeLosePlayer: sound("policeLosePlayer", "police", "Police loses visual contact"),
  policeBackup: sound("policeBackup", "police", "Police reinforcements are dispatched", { priority: "high" }),
  hunter: sound("hunter", "hunter", "Hunter pressure or arrival", { fallback: "hunter", priority: "critical" }),
  hunterSpotPlayer: sound("hunterSpotPlayer", "hunter", "Hunter acquires the player", { spatial: true, priority: "critical" }),
  hunterAttack: sound("hunterAttack", "hunter", "Hunter attacks", { spatial: true, priority: "high" }),
  exposureUp: sound("exposureUp", "system", "Exposure level increases", { priority: "high" }),
  exposureDown: sound("exposureDown", "system", "Exposure level decreases"),
  masqueradeFail: sound("masqueradeFail", "system", "Masquerade is broken", { fallback: "masqueradeFail", priority: "critical" }),

  // Vehicles
  vehicleEnter: sound("vehicleEnter", "vehicle", "Player enters a vehicle", { spatial: true }),
  vehicleExit: sound("vehicleExit", "vehicle", "Player exits a vehicle", { spatial: true }),
  vehicleDoorOpen: sound("vehicleDoorOpen", "vehicle", "Vehicle door opens", { spatial: true }),
  vehicleDoorClose: sound("vehicleDoorClose", "vehicle", "Vehicle door closes", { spatial: true }),
  vehicleEngineStart: sound("vehicleEngineStart", "vehicle", "Vehicle engine starts", { spatial: true }),
  vehicleEngineIdle: sound("vehicleEngineIdle", "vehicle", "Vehicle engine idles", { loop: true, spatial: true }),
  vehicleEngineDrive: sound("vehicleEngineDrive", "vehicle", "Vehicle accelerates or cruises", { loop: true, spatial: true }),
  vehicleEngineBrake: sound("vehicleEngineBrake", "vehicle", "Vehicle brakes", { spatial: true }),
  vehicleHandbrake: sound("vehicleHandbrake", "vehicle", "Handbrake engages", { spatial: true }),
  vehicleSkidLoop: sound("vehicleSkidLoop", "vehicle", "Tyres are skidding", { loop: true, spatial: true }),
  vehicleCollisionLight: sound("vehicleCollisionLight", "vehicle", "Low-speed collision", { spatial: true }),
  vehicleCollisionHeavy: sound("vehicleCollisionHeavy", "vehicle", "High-speed collision", { spatial: true, priority: "high" }),
  vehicleHitPedestrian: sound("vehicleHitPedestrian", "vehicle", "Vehicle hits an NPC", { spatial: true, priority: "high" }),
  vehicleHorn: sound("vehicleHorn", "vehicle", "Traffic horn", { spatial: true }),
  trafficAmbience: sound("trafficAmbience", "ambience", "Street traffic bed", { loop: true, volume: 0.45 }),

  // UI and missions
  missionComplete: sound("missionComplete", "mission", "Mission or major objective completes", { fallback: "missionComplete", priority: "high" }),
  missionAccepted: sound("missionAccepted", "mission", "Mission becomes active"),
  missionFailed: sound("missionFailed", "mission", "Mission fails", { priority: "critical" }),
  objectiveUpdated: sound("objectiveUpdated", "mission", "Mission checklist changes"),
  menu: sound("menu", "ui", "Menu or panel opens", { fallback: "menu" }),
  menuClose: sound("menuClose", "ui", "Menu or panel closes"),
  hover: sound("hover", "ui", "Pointer enters an actionable control", { volume: 0.45 }),
  confirm: sound("confirm", "ui", "UI action confirms", { fallback: "confirm" }),
  cancel: sound("cancel", "ui", "UI action cancels or is rejected", { fallback: "cancel" }),
  notification: sound("notification", "ui", "Generic HUD notification"),
  ledgerOpen: sound("ledgerOpen", "ui", "Night Ledger opens"),
  ledgerClose: sound("ledgerClose", "ui", "Night Ledger closes"),

  // Ambience
  ambienceStreetNight: sound("ambienceStreetNight", "ambience", "Street layer ambient bed", { loop: true, volume: 0.55 }),
  ambienceRooftopWind: sound("ambienceRooftopWind", "ambience", "Rooftop ambient bed", { loop: true, volume: 0.5 }),
  ambienceSewer: sound("ambienceSewer", "ambience", "Sewer ambient bed", { loop: true, volume: 0.55 }),
  ambienceClubExterior: sound("ambienceClubExterior", "ambience", "Club exterior music bleed", { loop: true, spatial: true, volume: 0.5 }),
  ambiencePoliceStation: sound("ambiencePoliceStation", "ambience", "Police-station exterior bed", { loop: true, spatial: true, volume: 0.4 }),
  ambienceChurch: sound("ambienceChurch", "ambience", "Church or hunter territory bed", { loop: true, spatial: true, volume: 0.4 }),
  rainLoop: sound("rainLoop", "ambience", "Rain weather bed", { loop: true, volume: 0.55 }),
  distantThunder: sound("distantThunder", "ambience", "Occasional distant thunder", { spatial: false }),
  cityStinger: sound("cityStinger", "ambience", "Rare city tension accent", { priority: "high" })
});

export const SOUND_IDS = Object.freeze(Object.keys(SOUND_CATALOG));

export function soundDefinition(id) {
  return SOUND_CATALOG[id] || null;
}

export function unresolvedSounds() {
  return SOUND_IDS.map(id => SOUND_CATALOG[id]).filter(entry => !entry.file);
}

export function resolvedSounds() {
  return SOUND_IDS.map(id => SOUND_CATALOG[id]).filter(entry => Boolean(entry.file));
}
