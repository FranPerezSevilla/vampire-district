import { AI_STATES } from "../data/ai.js";
import { LAYERS, streetNavigationPoints } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { NpcSystem as NpcSystemCore } from "./NpcSystemCore.js";

export class NpcSystem extends NpcSystemCore {
  createNpc(definition) {
    const npc = super.createNpc(definition);
    this.scene.entityStreamSystem?.applyNpcState?.(npc, 0);
    return npc;
  }

  updateNpc(npc, dt) {
    const panickingFromDriving = Boolean(
      npc
      && [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)
      && npc.ai?.state === AI_STATES.FLEEING
      && (npc.panicTimer || 0) > 0
      && !npc.alarmed
      && !npc.dead
      && !npc.inactive
      && !npc.intercepted
      && !npc.drainVictim
    );

    if (panickingFromDriving) {
      npc.panicTimer = Math.max(0, npc.panicTimer - dt);
      const sourceX = Number.isFinite(npc.panicSourceX) ? npc.panicSourceX : npc.x - (npc.dirX || 1) * 24;
      const sourceY = Number.isFinite(npc.panicSourceY) ? npc.panicSourceY : npc.y - (npc.dirY || 0) * 24;
      let dx = npc.x - sourceX;
      let dy = npc.y - sourceY;
      let length = Math.hypot(dx, dy);
      if (length < 0.001) {
        dx = -(npc.dirX || 1);
        dy = -(npc.dirY || 0);
        length = Math.hypot(dx, dy) || 1;
      }
      const escapeDistance = 110;
      const targetX = npc.x + (dx / length) * escapeDistance;
      const targetY = npc.y + (dy / length) * escapeDistance;
      const speed = Math.max(34, (npc.speed || 12) * 2.7);
      npc.soundReactionTimer = 0;
      npc.__nbdWtfLabel?.setVisible?.(false);
      if (npc.ai) {
        npc.ai.role = "none";
        npc.ai.intent = "panic-flee";
      }
      this.moveTowardAtSpeed(npc, targetX, targetY, dt, speed);
      if (npc.panicTimer <= 0) {
        npc.panicSourceX = null;
        npc.panicSourceY = null;
      }
      return;
    }

    const obeyingComeHere = Boolean(
      npc
      && !npc.dead
      && !npc.inactive
      && !npc.intercepted
      && !npc.alarmed
      && npc.whisperCommand === "come_here"
      && npc.whisperCommandTimer > 0
      && npc.luredTimer > 0
    );

    // Whisper obedience must take priority over patrol/guard/passive AI states.
    // Otherwise pedestrians and guards can keep following their normal route
    // even after a successful COME HERE command.
    if (obeyingComeHere) {
      npc.luredTimer = Math.max(0, npc.luredTimer - dt);
      this.followPlayerUnderWhisper(npc, dt);
      return;
    }

    super.updateNpc(npc, dt);
  }

  update(dt) {
    const stream = this.scene.entityStreamSystem;
    if (!stream) {
      super.update(dt);
      return;
    }

    for (const npc of this.npcs) {
      if (stream.shouldSimulateNpc(npc)) {
        if (npc.lureFlash > 0) npc.lureFlash = Math.max(0, npc.lureFlash - dt);
        if (npc.stunnedTimer > 0 && Number.isFinite(npc.stunnedTimer)) {
          npc.stunnedTimer = Math.max(0, npc.stunnedTimer - dt);
        }
        this.updateNpc(npc, dt);
        npc.container?.setPosition?.(npc.x, npc.y);
      }
      npc.container?.setVisible?.(this.isRenderable(npc));
    }
    this.rebuildSpatialIndex();
  }

  rebuildSpatialIndex() {
    const stream = this.scene.entityStreamSystem;
    if (!stream) {
      this.spatial.rebuild(this.npcs);
      return;
    }
    const indexed = [];
    for (const npc of this.npcs) {
      stream.applyNpcState(npc, 0);
      if (stream.shouldIndexNpc(npc)) indexed.push(npc);
    }
    this.spatial.rebuild(indexed);
  }

  isRenderable(npc) {
    if (this.scene.entityStreamSystem && !this.scene.entityStreamSystem.shouldRenderNpc(npc)) return false;
    return super.isRenderable(npc);
  }

  refreshVisibility() {
    this.rebuildSpatialIndex();
    for (const npc of this.npcs) npc.container?.setVisible?.(this.isRenderable(npc));
  }

  bestVisibleNavNode(npc, targetX, targetY) {
    if (npc?.layer !== LAYERS.STREET) return super.bestVisibleNavNode(npc, targetX, targetY);

    let best = null;
    let bestScore = Infinity;
    const localNodes = this.scene.cityStreamSystem?.index?.queryPoint?.(
      "navigationPoints",
      npc.x,
      npc.y,
      760
    ) || streetNavigationPoints;

    for (const node of localNodes) {
      if (!this.canNpcStandAt(npc, node.x, node.y)) continue;
      if (!this.lineClear(npc, npc.x, npc.y, node.x, node.y)) continue;
      const nodeSeesTarget = this.lineClear(npc, node.x, node.y, targetX, targetY);
      const score = Phaser.Math.Distance.Between(npc.x, npc.y, node.x, node.y)
        + Phaser.Math.Distance.Between(node.x, node.y, targetX, targetY)
        + (nodeSeesTarget ? 0 : 180);
      if (score < bestScore) {
        best = node;
        bestScore = score;
      }
    }
    return best || super.bestVisibleNavNode(npc, targetX, targetY);
  }
}
