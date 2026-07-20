import { defineMission } from "../MissionDefinition.js";
import { CAMPAIGN_FACTIONS, CAMPAIGN_REFUGES, OBJECTIVE_TYPES } from "../constants.js";

export const CLEAN_THE_SCENE_ID = "clean_the_scene";

const REFUGE = Object.freeze({ x: 150, y: 146, layer: 2 });
const SERVICE_ALLEY = Object.freeze({ x: 650, y: 510, layer: 0, radius: 86, label: "SCENE" });
const CAMERA_ROLL = Object.freeze({ x: 622, y: 505, layer: 0, radius: 26, label: "ROLL" });
const EXPOSED_BODY = Object.freeze({ x: 704, y: 506, layer: 0, radius: 30, label: "BODY" });

export const cleanTheSceneMission = defineMission({
  id: CLEAN_THE_SCENE_ID,
  version: 2,
  title: "Clean the Scene",
  factionId: CAMPAIGN_FACTIONS.BLACKGLASS_DIRECTORATE,
  contactId: "directorate_cleaner",
  description: "Recover compromised evidence, remove an exposed body, lose the police search and report back to the refuge.",
  replayable: true,
  objectives: [
    {
      id: "reach_service_alley",
      type: OBJECTIVE_TYPES.REACH,
      targetId: "club_service_alley",
      label: "Reach the club service alley",
      description: "Travel from the rooftop refuge to the compromised scene behind the nightclub.",
      metadata: {
        marker: SERVICE_ALLEY,
        checkpoint: {
          id: "clean_scene_start",
          spawn: REFUGE,
          tutorialState: "complete",
          actorPreset: "clean_scene_ready"
        }
      }
    },
    {
      id: "collect_compromised_evidence",
      type: OBJECTIVE_TYPES.COLLECT,
      targetId: "compromised_camera_roll",
      label: "Recover the camera roll",
      description: "Take the camera roll before a police patrol reaches the alley.",
      metadata: {
        marker: CAMERA_ROLL,
        checkpoint: {
          id: "clean_scene_alley_reached",
          spawn: { x: 650, y: 510, layer: 0 },
          tutorialState: "complete",
          actorPreset: "clean_scene_ready"
        }
      }
    },
    {
      id: "remove_exposed_body",
      type: OBJECTIVE_TYPES.DESTROY,
      targetId: "exposed_body",
      label: "Remove the exposed body",
      description: "Drag the corpse into a dumpster, sewer route or another valid hiding place.",
      metadata: {
        marker: EXPOSED_BODY,
        checkpoint: {
          id: "clean_scene_evidence_recovered",
          spawn: { x: 622, y: 505, layer: 0 },
          tutorialState: "complete",
          actorPreset: "clean_scene_evidence_recovered"
        }
      }
    },
    {
      id: "lose_police_attention",
      type: OBJECTIVE_TYPES.LOSE_WANTED_LEVEL,
      label: "Lose police attention",
      description: "Break line of sight and wait until Exposure returns to level zero.",
      maxWantedLevel: 0,
      metadata: {
        checkpoint: {
          id: "clean_scene_body_removed",
          spawn: { x: 676, y: 502, layer: 0 },
          tutorialState: "complete",
          actorPreset: "clean_scene_body_removed"
        }
      }
    },
    {
      id: "return_to_refuge",
      type: OBJECTIVE_TYPES.RETURN,
      targetId: CAMPAIGN_REFUGES.ROOFTOP_REFUGE,
      label: "Return to the rooftop refuge",
      description: "Return to the contract board and collect payment.",
      metadata: {
        marker: { ...REFUGE, radius: 58, label: "REPORT" },
        checkpoint: {
          id: "clean_scene_search_lost",
          spawn: { x: 676, y: 502, layer: 0 },
          tutorialState: "complete",
          actorPreset: "clean_scene_body_removed"
        }
      }
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
  },
  metadata: {
    worldAdapter: CLEAN_THE_SCENE_ID,
    missionBoard: {
      order: 10,
      contactLabel: "Directorate cleaner"
    },
    placements: {
      serviceAlley: SERVICE_ALLEY,
      cameraRoll: CAMERA_ROLL,
      exposedBody: EXPOSED_BODY,
      refuge: { ...REFUGE, radius: 58, label: "REPORT" }
    },
    completionCheckpoint: {
      id: "clean_scene_complete",
      spawn: REFUGE,
      tutorialState: "complete",
      actorPreset: "clean_scene_complete"
    }
  }
});
