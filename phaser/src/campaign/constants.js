export const CAMPAIGN_SCHEMA_VERSION = 2;
// Keep the original storage key so version-one campaign saves migrate in place.
export const CAMPAIGN_STORAGE_KEY = "vampire-district-campaign-v1";

export const CAMPAIGN_FACTIONS = Object.freeze({
  BLACKGLASS_DIRECTORATE: "blackglass_directorate",
  RED_ASSEMBLY: "red_assembly"
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
