import test from "node:test";
import assert from "node:assert/strict";

import {
  cloneCampaignCheckpoint,
  sanitizeCampaignCheckpoint
} from "../phaser/src/campaign/CampaignCheckpoint.js";

test("checkpoint sanitization preserves the dumpster that contains a hidden corpse", () => {
  const checkpoint = sanitizeCampaignCheckpoint({
    id: "cp-hidden-body",
    missionId: "clean_the_scene",
    objectiveId: "remove_exposed_body",
    kind: "objective",
    mission: {
      id: "clean_the_scene",
      definitionVersion: 1,
      status: "active",
      objectiveIndex: 2,
      objectives: {
        remove_exposed_body: {
          id: "remove_exposed_body",
          status: "active",
          progress: 0,
          required: 1
        }
      }
    },
    player: { x: 676, y: 502, layer: 0, hunger: 40 },
    loadout: { selectedWeaponId: "unarmed", inventory: ["unarmed"], ammo: {} },
    world: {
      exposure: 0,
      brokenLights: [],
      npcs: {
        exposed_body: {
          id: "exposed_body",
          type: "civilian",
          x: 676,
          y: 502,
          layer: 0,
          dead: true,
          deathKind: "killed",
          hiddenBody: true,
          hiddenSpotId: "dumpsterClubRear",
          hiddenSpotName: "club rear dumpster",
          combat: { state: "dead", resilience: 0, maxResilience: 1 }
        }
      },
      bloodStains: []
    },
    tutorial: { completed: true, state: "complete", informantGone: true }
  });

  assert.equal(checkpoint.world.npcs.exposed_body.hiddenSpotId, "dumpsterClubRear");
  assert.equal(checkpoint.world.npcs.exposed_body.hiddenSpotName, "club rear dumpster");
  assert.deepEqual(cloneCampaignCheckpoint(checkpoint), checkpoint);
});
