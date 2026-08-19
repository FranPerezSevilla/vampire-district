import { LAYERS, streetNavigationPoints } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { ModularCharacterView } from "../rendering/ModularCharacterView.js";
import { NpcSystem as NpcSystemCore } from "./NpcSystemCore.js";

export class NpcSystem extends NpcSystemCore {
  paintLivingNpc(container, type, palette) {
    if (![NPC_TYPES.CIVILIAN, NPC_TYPES.POLICE].includes(type)) {
      super.paintLivingNpc(container, type, palette);
      return;
    }

    const styleName = type === NPC_TYPES.POLICE ? "police" : "civilian";
    container.__modularCharacterView = new ModularCharacterView(this.scene, container, styleName, {
      phaseKey: `${type}:${container.x}:${container.y}`
    });
  }

  createNpc(definition) {
    const npc = super.createNpc(definition);
    npc.characterView = npc.container?.__modularCharacterView || null;
    this.scene.entityStreamSystem?.applyNpcState?.(npc, 0);
    return npc;
  }

  updateCharacterPresentation(timeMs = 0) {
    for (const npc of this.npcs) {
      const view = npc.characterView || npc.container?.__modularCharacterView;
      if (!view || npc.dead) continue;

      const vx = Number(npc.vx) || 0;
      const vy = Number(npc.vy) || 0;
      const moving = Math.hypot(vx, vy) > 1.25;
      const facingDirection = { x: Number(npc.dirX) || 0, y: Number(npc.dirY) || 0 };
      const movementDirection = moving ? { x: vx, y: vy } : facingDirection;
      const aiming = npc.type === NPC_TYPES.POLICE && Boolean(npc.chasingPlayer || npc.enemyAttack);
      const player = this.scene.player;
      const aimDirection = aiming && player
        ? { x: player.x - npc.x, y: player.y - npc.y }
        : facingDirection;

      view.update({
        timeMs,
        movementDirection,
        aimDirection,
        moving,
        aiming
      });
    }
  }

  updateNpc(npc, dt) {
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
