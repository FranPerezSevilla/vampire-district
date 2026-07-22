import { LAYERS, streetNavigationPoints } from "../data/district.js";
import { NpcSystem as NpcSystemCore } from "./NpcSystemCore.js";

export class NpcSystem extends NpcSystemCore {
  createNpc(definition) {
    const npc = super.createNpc(definition);
    this.scene.entityStreamSystem?.applyNpcState?.(npc, 0);
    return npc;
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