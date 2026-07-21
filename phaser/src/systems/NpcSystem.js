import { LAYERS, streetNavigationPoints } from "../data/district.js";
import { NpcSystem as NpcSystemCore } from "./NpcSystemCore.js";

export class NpcSystem extends NpcSystemCore {
  bestVisibleNavNode(npc, targetX, targetY) {
    if (npc?.layer !== LAYERS.STREET) return super.bestVisibleNavNode(npc, targetX, targetY);

    let best = null;
    let bestScore = Infinity;
    for (const node of streetNavigationPoints) {
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