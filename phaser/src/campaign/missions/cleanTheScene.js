import { defineMission } from "../MissionDefinition.js";
import { CAMPAIGN_FACTIONS, CAMPAIGN_REFUGES, OBJECTIVE_TYPES } from "../constants.js";

export const CLEAN_THE_SCENE_ID = "clean_the_scene";

export const cleanTheSceneMission = defineMission({
  id: CLEAN_THE_SCENE_ID,
  version: 1,
  title: "Clean the Scene",
  factionId: CAMPAIGN_FACTIONS.BLACKGLASS_DIRECTORATE,
  contactId: "directorate_cleaner",
  description: "Recover compromised evidence, remove the body and return after police attention has cooled.",
  replayable: true,
  objectives: [
    {
      id: "reach_service_alley",
      type: OBJECTIVE_TYPES.REACH,
      targetId: "club_service_alley",
      label: "Reach the service alley"
    },
    {
      id: "collect_compromised_evidence",
      type: OBJECTIVE_TYPES.COLLECT,
      targetId: "compromised_camera_roll",
      label: "Recover the camera roll"
    },
    {
      id: "remove_exposed_body",
      type: OBJECTIVE_TYPES.DESTROY,
      targetId: "exposed_body",
      label: "Remove the exposed body",
      metadata: {
        acceptedMethods: "hidden,cleaned,transported"
      }
    },
    {
      id: "lose_police_attention",
      type: OBJECTIVE_TYPES.LOSE_WANTED_LEVEL,
      targetId: null,
      label: "Lose police attention",
      maxWantedLevel: 0
    },
    {
      id: "return_to_refuge",
      type: OBJECTIVE_TYPES.RETURN,
      targetId: CAMPAIGN_REFUGES.ROOFTOP_REFUGE,
      label: "Return to the refuge"
    }
  ],
  rewards: {
    cash: 275,
    reputation: {
      [CAMPAIGN_FACTIONS.BLACKGLASS_DIRECTORATE]: 2
    },
    contacts: {
      directorate_cleaner: 3
    },
    flags: {
      cleaner_contact_unlocked: true
    }
  }
});
