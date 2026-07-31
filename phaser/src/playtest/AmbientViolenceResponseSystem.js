import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const INCIDENT_WINDOW_MS = 6500;
const HEAT_BY_DEATH_IN_BURST = Object.freeze([6, 7, 8, 6]);
const ELIGIBLE_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.POLICE,
  NPC_TYPES.TARGET
]);

function isEligibleDeath(npc) {
  return Boolean(
    npc
    && npc.id
    && ELIGIBLE_TYPES.has(npc.type)
    && npc.layer === LAYERS.STREET
    && npc.dead
    && !npc.inactive
    && !npc.hiddenBody
  );
}

/**
 * Adds local Heat for violence that is too loud or extensive to remain invisible,
 * even when every direct witness has been killed. It deliberately does not add
 * supernatural Exposure or reveal the player's live position.
 */
export class AmbientViolenceResponseSystem {
  constructor(scene) {
    this.scene = scene;
    this.knownDead = new Set(
      (scene.npcSystem?.npcs || []).filter(npc => npc?.dead).map(npc => npc.id)
    );
    this.burst = [];
    this.postUpdateEvent = Phaser.Scenes.Events.POST_UPDATE || "postupdate";
    this.updateHandler = () => this.update();
    scene.events?.on?.(this.postUpdateEvent, this.updateHandler);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    const now = Number(this.scene.time?.now) || performance.now();
    this.burst = this.burst.filter(entry => now - entry.time <= INCIDENT_WINDOW_MS);

    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!isEligibleDeath(npc) || this.knownDead.has(npc.id)) continue;
      this.knownDead.add(npc.id);
      this.registerDeath(npc, now);
    }
  }

  registerDeath(npc, now) {
    this.burst.push({ id: npc.id, time: now, x: npc.x, y: npc.y });
    const burstIndex = Math.min(this.burst.length - 1, HEAT_BY_DEATH_IN_BURST.length - 1);
    const amount = HEAT_BY_DEATH_IN_BURST[burstIndex];
    const reason = this.burst.length >= 3
      ? "multiple gunshots and bodies reported"
      : "violent disturbance reported nearby";

    if (this.scene.policeSystem?.addHeat) {
      this.scene.policeSystem.addHeat(npc.x, npc.y, amount, reason, {
        source: "ambient-violence",
        witnessed: false,
        supernatural: false
      });
    } else {
      this.scene.heatSystem?.add?.(npc.x, npc.y, amount, reason, {
        source: "ambient-violence",
        witnessed: false,
        supernatural: false
      });
    }

    if (this.burst.length === 1) {
      this.scene.lastActionText = "Gunfire carries across the district. Someone is calling it in.";
    } else if (this.burst.length >= 3) {
      this.scene.lastActionText = "Sustained violence draws an unavoidable police response.";
    }

    this.scene.events?.emit?.("playtest:ambient-violence-reported", {
      x: npc.x,
      y: npc.y,
      amount,
      burstDeaths: this.burst.length,
      reason
    });
  }

  snapshot() {
    return {
      knownDead: this.knownDead.size,
      burstDeaths: this.burst.length
    };
  }

  destroy() {
    this.scene.events?.off?.(this.postUpdateEvent, this.updateHandler);
  }
}
