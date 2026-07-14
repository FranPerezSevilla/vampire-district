import { bodyHideSpots, LAYERS, shadowZones } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

export class EvidenceSystem {
  constructor(scene) {
    this.scene = scene;
    this.draggingBody = null;
    this.bloodStains = [];
    this.nextBloodId = 1;
    this.discoveryTimer = 0;
    this.stats = {
      bodiesHidden: 0,
      bodiesDiscovered: 0,
      bloodStains: 0
    };
  }

  collectInteractions() {
    if (this.draggingBody) {
      const spot = this.currentHideSpot();
      const actions = [];
      if (spot) {
        actions.push({
          id: "hide_dragged_body",
          type: "evidence",
          label: `Hide body in ${spot.name}`,
          detail: "evidence cleanup",
          priority: 118,
          distance: 0,
          x: this.scene.player.x,
          y: this.scene.player.y,
          run: () => this.hideDraggedBody(spot)
        });
      }
      actions.push({
        id: "drop_dragged_body",
        type: "evidence",
        label: "Drop body",
        detail: "leave evidence visible",
        priority: 70,
        distance: 0,
        x: this.scene.player.x,
        y: this.scene.player.y,
        run: () => this.dropBody()
      });
      return actions;
    }

    const body = this.nearestVisibleBody(25);
    if (!body) return [];
    return [{
      id: `drag_${body.id}`,
      type: "evidence",
      label: body.type === NPC_TYPES.TARGET ? "Drag journalist body" : "Drag body",
      detail: "slow cleanup route",
      priority: 110,
      distance: Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, body.x, body.y),
      x: body.x,
      y: body.y,
      run: () => this.grabBody(body)
    }];
  }

  update(dt) {
    if (this.draggingBody) this.updateDraggedBody();
    this.updateBlood(dt);
    this.discoveryTimer -= dt;
    if (this.discoveryTimer <= 0) {
      this.discoveryTimer = 0.6;
      this.updateCorpseDiscovery();
    }
  }

  onFeedCompleted(npc) {
    if (!npc || npc.type === NPC_TYPES.RAT) return;
    const count = npc.type === NPC_TYPES.TARGET ? 4 : 3;
    for (let i = 0; i < count; i++) {
      this.createBloodStain(npc.x, npc.y, npc.layer, npc.type === NPC_TYPES.TARGET ? "target-feed" : "feed");
    }
  }

  createBloodStain(x, y, layer, kind = "blood") {
    const stain = {
      id: this.nextBloodId++,
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 18,
      layer,
      kind,
      age: 0,
      life: layer === LAYERS.SEWER ? 12 : 80,
      discovered: false
    };
    this.bloodStains.push(stain);
    this.stats.bloodStains++;
    if (this.bloodStains.length > 48) this.bloodStains.shift();
    return stain;
  }

  updateBlood(dt) {
    for (const stain of this.bloodStains) {
      stain.age += dt;
      stain.life -= stain.layer === LAYERS.SEWER ? dt * 2.5 : dt * 0.12;
    }
    this.bloodStains = this.bloodStains.filter(stain => stain.life > 0);
  }

  nearestVisibleBody(radius = 25) {
    let best = null;
    let bestD = Infinity;
    for (const body of this.scene.npcSystem.visibleBodies(this.scene.currentLayer)) {
      if (body.hiddenBody || body.dragged) continue;
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, body.x, body.y);
      if (d <= radius && d < bestD) {
        best = body;
        bestD = d;
      }
    }
    return best;
  }

  grabBody(body) {
    if (!body || body.hiddenBody) return;
    this.draggingBody = body;
    body.dragged = true;
    body.vx = 0;
    body.vy = 0;
    this.scene.lastActionText = "You grab the body. Move it to a dumpster, sewer, rooftop, refuge, or deep shadow.";
  }

  updateDraggedBody() {
    const body = this.draggingBody;
    if (!body) return;
    body.layer = this.scene.currentLayer;
    body.x = this.scene.player.x - 10;
    body.y = this.scene.player.y + 10;
    body.container.setPosition(body.x, body.y);
    body.container.setVisible(true);
  }

  dropBody() {
    if (!this.draggingBody) return;
    this.draggingBody.dragged = false;
    this.draggingBody = null;
    this.scene.lastActionText = "Body dropped. If it remains visible, someone can discover it.";
  }

  hideDraggedBody(spot) {
    const body = this.draggingBody;
    if (!body || !spot) return;
    body.dragged = false;
    body.hiddenBody = true;
    body.container.setVisible(false);
    this.draggingBody = null;
    this.stats.bodiesHidden++;
    this.cleanBloodAround(body.x, body.y, body.layer, spot.cleanRadius || 78);
    this.scene.lastActionText = `Body hidden in ${spot.name}. Evidence pressure drops.`;
    if (body.type === NPC_TYPES.TARGET) this.scene.missionSystem.markEvidenceContained?.();
  }

  currentHideSpot() {
    if (this.scene.currentLayer === LAYERS.SEWER) return { name: "sewers", cleanRadius: 120 };
    if (this.scene.currentLayer === LAYERS.ROOF_HIGH) return { name: "rooftop refuge", cleanRadius: 110 };
    if (this.scene.currentLayer === LAYERS.ROOF_LOW) return { name: "rooftop shadow", cleanRadius: 86 };

    for (const spot of bodyHideSpots) {
      if (spot.layer !== this.scene.currentLayer) continue;
      if (Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, spot.x, spot.y) <= spot.radius) {
        return { ...spot, cleanRadius: 90 };
      }
    }

    const shadow = this.shadowAt(this.scene.player.x, this.scene.player.y, this.scene.currentLayer);
    if (shadow) return { name: shadow.name, cleanRadius: 70 };
    return null;
  }

  shadowAt(x, y, layer) {
    if (layer !== LAYERS.STREET) return null;
    const broken = this.scene.brokenLights && [...this.scene.brokenLights].length
      ? this.scene.currentShadowAt?.(x, y, layer)
      : null;
    if (broken) return broken;
    return shadowZones.find(zone => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) || null;
  }

  cleanBloodAround(x, y, layer, radius) {
    const before = this.bloodStains.length;
    this.bloodStains = this.bloodStains.filter(stain => {
      if (stain.layer !== layer) return true;
      return Phaser.Math.Distance.Between(x, y, stain.x, stain.y) > radius;
    });
    return before - this.bloodStains.length;
  }

  updateCorpseDiscovery() {
    for (const body of this.scene.npcSystem.visibleBodies(LAYERS.STREET)) {
      if (body.hiddenBody || body.dragged || body.corpseDiscovered) continue;
      const hidden = this.shadowAt(body.x, body.y, body.layer);
      const range = hidden ? 58 : 120;
      const watcher = this.scene.npcSystem.npcs.find(npc => {
        if (npc.dead || npc.inactive || npc.intercepted || npc.layer !== body.layer) return false;
        if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
        return Phaser.Math.Distance.Between(npc.x, npc.y, body.x, body.y) <= range;
      });
      if (watcher) {
        body.corpseDiscovered = true;
        this.stats.bodiesDiscovered++;
        this.scene.witnessSystem.alarmWitness(watcher, "an abandoned body", 20);
        this.scene.exposureSystem.add(5, "A civilian discovers a body and runs to report it.");
      }
    }
  }

  drawMarkers(graphics) {
    if (this.scene.currentLayer === LAYERS.STREET) {
      const hasBody = Boolean(this.draggingBody) || this.scene.npcSystem.visibleBodies(this.scene.currentLayer).some(body => !body.hiddenBody);
      if (hasBody) {
        for (const spot of bodyHideSpots) {
          graphics.lineStyle(1, 0x78c7a3, 0.60).strokeCircle(spot.x, spot.y, spot.radius);
          graphics.fillStyle(0x78c7a3, 0.10).fillCircle(spot.x, spot.y, spot.radius);
          this.scene.addMapLabel("HIDE", spot.x + 10, spot.y - 8, 0x78c7a3);
        }
      }
    }

    for (const stain of this.bloodStains) {
      if (stain.layer !== this.scene.currentLayer) continue;
      graphics.fillStyle(stain.kind === "target-feed" ? 0xff2f62 : 0xb31934, 0.65);
      graphics.fillRect(stain.x - 2, stain.y - 1, 4, 2);
      graphics.fillRect(stain.x - 1, stain.y - 2, 2, 4);
    }

    if (this.draggingBody) {
      graphics.lineStyle(1, 0xd7c8ff, 0.48);
      graphics.beginPath();
      graphics.moveTo(this.scene.player.x, this.scene.player.y);
      graphics.lineTo(this.draggingBody.x, this.draggingBody.y);
      graphics.strokePath();
    }
  }

  summary() {
    return `Bodies hidden ${this.stats.bodiesHidden} · discovered ${this.stats.bodiesDiscovered} · blood ${this.bloodStains.length}`;
  }
}
