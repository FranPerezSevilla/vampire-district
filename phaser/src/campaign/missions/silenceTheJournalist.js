import { defineMission } from "../MissionDefinition.js";
import { CAMPAIGN_FACTIONS, CAMPAIGN_REFUGES, OBJECTIVE_TYPES } from "../constants.js";

export const SILENCE_THE_JOURNALIST_ID = "silence_the_journalist";

export const silenceTheJournalistMission = defineMission({
  id: SILENCE_THE_JOURNALIST_ID,
  version: 1,
  title: "Silence the Journalist",
  factionId: CAMPAIGN_FACTIONS.BLACKGLASS_DIRECTORATE,
  contactId: "your_sire",
  description: "Reach the compromised police informant, locate the journalist, silence him and report at the rooftop refuge.",
  replayable: false,
  objectives: [
    {
      id: "reach_police_roof",
      type: OBJECTIVE_TYPES.REACH,
      targetId: "police_roof",
      label: "Reach the police roof",
      description: "Cross the rooftop route and clear the blocker.",
      metadata: {
        tutorial: true,
        minimumRooftopJumps: 3,
        blockerTargetId: "rooftop_thug"
      }
    },
    {
      id: "speak_to_informant",
      type: OBJECTIVE_TYPES.TALK,
      targetId: "police_roof_informant",
      label: "Speak to the police informant",
      description: "Collect the journalist's location and description."
    },
    {
      id: "reach_nightclub",
      type: OBJECTIVE_TYPES.REACH,
      targetId: "nightclub_district",
      label: "Reach the nightclub district"
    },
    {
      id: "neutralize_journalist",
      type: OBJECTIVE_TYPES.NEUTRALIZE,
      targetId: "journalist",
      label: "Silence the journalist",
      acceptedOutcomes: ["killed", "drained"]
    },
    {
      id: "return_to_refuge",
      type: OBJECTIVE_TYPES.RETURN,
      targetId: CAMPAIGN_REFUGES.ROOFTOP_REFUGE,
      label: "Return to the rooftop refuge",
      description: "Report to your sire after the journalist has been handled."
    }
  ],
  rewards: {
    cash: 500,
    reputation: {
      [CAMPAIGN_FACTIONS.BLACKGLASS_DIRECTORATE]: 5
    },
    contacts: {
      your_sire: 1
    },
    flags: {
      journalist_silenced: true
    }
  },
  failureRules: {
    failOnVeilBreak: true,
    failOnArrest: true,
    failOnFrenzy: true
  },
  metadata: {
    openingMission: true,
    legacyMissionSteps: 4
  }
});
