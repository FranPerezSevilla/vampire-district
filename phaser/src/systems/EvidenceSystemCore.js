import { bodyHideSpots, LAYERS, shadowZones } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { FEEDING_DEPTHS } from "../data/feeding.js";
import { resolveAction } from "./ActionSystem.js";
import { RawAudio } from "./RawAudioSystem.js";

export class EvidenceSystem {
  constructor(scene) {
    this.scene = scene;
    this.draggingBody = null;
    this.dragNoiseTimer = 0;
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
          label: `Hide ${this.subjectNoun(this.draggingBody)} in ${spot.name}`,
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
        label: `Drop ${this.subjectNoun(this.draggingBody)}`,
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
      label: body.type === NPC_TYPES.TARGET
        ? `Drag journalist ${body.dead ? "body" : "victim"}`
        : `Drag ${this.subjectNoun(body)}`,
      detail: "slow and noisy cleanup route",
      priority: 110,
      distance: Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, body.x, body.y),
      x: body.x,
      y: body.y,
      run: () => this.grabBody(body)
    }];
  }

  update(dt) {
    if (this.draggingBody) this.updateDraggedBody(dt);
    this.updateBlood(dt);
    this.discoveryTimer -= dt;
    if (this.discoveryTimer <= 0) {
      this.discoveryTimer = 0.6;
      this.updateCorpseDiscovery();
      this.updateFeedingVictimDiscovery();
    }
  }

  onFeedingResolved(npc, result = {}) {
    if (!npc || npc.type === NPC_TYPES.RAT) return;
    const depth = result.feedingDepth || FEEDING_DEPTHS.DRAIN;
    const baseCount = Math.max(0, Math.trunc(Number(result.bloodStains) || 0));
    const count = depth === FEEDING_DEPTHS.DRAIN && npc.type === NPC_TYPES.TARGET
      ? Math.max(4, baseCount)
      : depth === FEEDING_DEPTHS.DRAIN && [NPC_TYPES.POLICE, NPC_TYPES.HUNTER].includes(npc.type)
        ? Math.max(4, baseCount)
        : baseCount;
    const kind = depth === FEEDING_DEPTHS.QUICK_BITE
      ? "quick-bite"
      : depth === FEEDING_DEPTHS.FULL_FEED
        ? "full-feed"
        : npc.type === NPC_TYPES.TARGET
          ? "target-drain"
          : "drain";
    for (let i = 0; i < count; i++) this.createBloodStain(npc.x, npc.y, npc.layer, kind);
    npc.feedingEvidenceDiscovered = false;
  }

  onFeedCompleted(npc) {
    this.onFeedingResolved(npc, {
      feedingDepth: FEEDING_DEPTHS.DRAIN,
      bloodStains: npc?.type === NPC_TYPES.TARGET ? 4 : 3
    });
  }

  onKillCompleted(npc) {
    if (!npc || npc.type === NPC_TYPES.RAT) return;
    const count = npc.type === NPC_TYPES.POLICE || npc.type === NPC_TYPES.HUNTER ? 2 : 1;
    for (let i = 0; i < count; i++) this.createBloodStain(npc.x, npc.y, npc.layer, "kill");
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

  evidenceSubjects(layer = this.scene.currentLayer) {
    const bodies = this.scene.npcSystem?.visibleBodies?.(layer) || [];
    const unconscious = (this.scene.npcSystem?.npcs || []).filter(npc => Boolean(
      npc.feedingUnconscious
      && !npc.dead
      && !npc.inactive
      && !npc.intercepted
      && npc.layer === layer
    ));
    return [...new Set([...bodies, ...unconscious])];
  }

  subjectNoun(subject) {
    return subject?.dead ? "body" : "unconscious victim";
  }

  nearestVisibleBody(radius = 25) {
    let best = null;
    let bestD = Infinity;
    for (const body of this.evidenceSubjects(this.scene.currentLayer)) {
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
    RawAudio.play("bodyDrag");
    resolveAction(this.scene, "bodyDrag", {
      target: body,
      x: body.x,
      y: body.y,
      layer: body.layer
    });
    this.draggingBody = body;
    this.dragNoiseTimer = 0.35;
    body.dragged = true;
    body.vx = 0;
    body.vy = 0;
    const noun = this.subjectNoun(body);
    this.scene.lastActionText = `You grab the ${noun}. Carrying ${noun === "body" ? "a body" : "an unconscious victim"} is a felony if police see it; civilians may report it.`;
  }

  updateDraggedBody(dt) {
    const body = this.draggingBody;
    if (!body) return;
    body.layer = this.scene.currentLayer;
    body.x = this.scene.player.x - 10;
    body.y = this.scene.player.y + 10;
    body.container.setPosition(body.x, body.y);
    body.container.setVisible(true);

    this.dragNoiseTimer -= dt;
    if (this.dragNoiseTimer <= 0) {
      this.dragNoiseTimer = this.scene.currentLayer === LAYERS.STREET ? 0.85 : 1.25;
      RawAudio.play("bodyDrag", { cooldown: 0.45 });
      if (this.scene.currentLayer === LAYERS.STREET) {
        resolveAction(this.scene, "bodyCarry", {
          target: body,
          x: body.x,
          y: body.y,
          layer: body.layer,
          cooldownKey: `bodyCarry:${body.id}`,
          cooldown: 2.0
        });
        this.scene.policeSystem?.addHeat(body.x, body.y, body.type === NPC_TYPES.POLICE || body.type === NPC_TYPES.HUNTER ? 5 : 3, "body carrying noise");
      }
    }
  }

  dropBody() {
    if (!this.draggingBody) return;
    RawAudio.play("bodyDrop");
    resolveAction(this.scene, "bodyDrop", {
      target: this.draggingBody,
      x: this.draggingBody.x,
      y: this.draggingBody.y,
      layer: this.draggingBody.layer
    });
    const noun = this.subjectNoun(this.draggingBody);
    this.draggingBody.dragged = false;
    this.draggingBody = null;
    this.dragNoiseTimer = 0;
    this.scene.lastActionText = `${noun === "body" ? "Body" : "Unconscious victim"} dropped. If left visible, someone can discover the evidence.`;
  }

  hideDraggedBody(spot) {
    const body = this.draggingBody;
    if (!body || !spot) return;
    RawAudio.play("bodyHide");
    resolveAction(this.scene, "bodyHide", {
      target: body,
      x: body.x,
      y: body.y,
      layer: body.layer
    });
    body.dragged = false;
    body.hiddenBody = true;
    body.container.setVisible(false);
    this.draggingBody = null;
    this.dragNoiseTimer = 0;
    this.stats.bodiesHidden++;
    this.cleanBloodAround(body.x, body.y, body.layer, spot.cleanRadius || 78);
    const noun = this.subjectNoun(body);
    this.scene.lastActionText = `${noun === "body" ? "Body" : "Unconscious victim"} hidden in ${spot.name}. Evidence pressure drops.`;
    this.scene.events?.emit?.("evidence:body-hidden", {
      targetId: body.id,
      method: "hidden",
      spotId: spot.id || null,
      spotName: spot.name,
      layer: body.layer
    });
    if (body.type === NPC_TYPES.TARGET) this.scene.missionSystem.markEvidenceContained?.();
  }

  currentHideSpot() {
    if (this.scene.currentLayer === LAYERS.SEWER) return { id: "sewers", name: "sewers", cleanRadius: 120 };
    if (this.scene.currentLayer === LAYERS.ROOF_HIGH) return { id: "rooftop_refuge", name: "rooftop refuge", cleanRadius: 110 };
    if (this.scene.currentLayer === LAYERS.ROOF_LOW) return { id: "rooftop_shadow", name: "rooftop shadow", cleanRadius: 86 };

    for (const spot of bodyHideSpots) {
      if (spot.layer !== this.scene.currentLayer) continue;
      if (Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, spot.x, spot.y) <= spot.radius) {
        return { ...spot, cleanRadius: 90 };
      }
    }

    const shadow = this.shadowAt(this.scene.player.x, this.scene.player.y, this.scene.currentLayer);
    if (shadow) return { id: shadow.id || "shadow", name: shadow.name, cleanRadius: 70 };
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
        if (npc.dead || npc.inactive || npc.intercepted || npc.stunnedTimer > 0 || npc.layer !== body.layer) return false;
        if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
        return Phaser.Math.Distance.Between(npc.x, npc.y, body.x, body.y) <= range;
      });
      if (watcher) {
        body.corpseDiscovered = true;
        this.stats.bodiesDiscovered++;
        this.discoverFeedingAssessments(body, {
          source: "recovered_body",
          witnessId: watcher.id,
          referenceId: body.id
        });
        this.scene.witnessSystem.alarmWitness(watcher, "an abandoned body", 16, { reactionSeconds: 1.2 });
        this.scene.exposureSystem.add(5, "A civilian discovers a body and runs to report it.");
      }
    }
  }


  updateFeedingVictimDiscovery() {
    if (this.scene.currentLayer !== LAYERS.STREET) return;
    for (const victim of this.scene.npcSystem?.npcs || []) {
      if (!victim?.feedingUnconscious || victim.dead || victim.inactive || victim.intercepted) continue;
      if (victim.hiddenBody || victim.dragged || victim.feedingEvidenceDiscovered || victim.layer !== LAYERS.STREET) continue;
      const hidden = this.shadowAt(victim.x, victim.y, victim.layer);
      const range = hidden ? 52 : 96;
      const watcher = (this.scene.npcSystem?.npcs || []).find(npc => {
        if (npc === victim || npc.dead || npc.inactive || npc.intercepted || npc.stunnedTimer > 0) return false;
        if (npc.layer !== victim.layer || ![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
        return Phaser.Math.Distance.Between(npc.x, npc.y, victim.x, victim.y) <= range;
      });
      if (!watcher) continue;

      victim.feedingEvidenceDiscovered = true;
      this.discoverFeedingAssessments(victim, {
        source: "recovered_victim",
        witnessId: watcher.id,
        referenceId: victim.id
      });
      this.scene.witnessSystem?.alarmWitness?.(watcher, "an unconscious victim with strange bite marks", 14, {
        masqueradeRisk: true,
        reactionSeconds: 1.0,
        source: victim
      });
      this.scene.exposureSystem?.add?.(3, "A civilian finds an unconscious feeding victim with abnormal bite marks.");
    }
  }

  discoverFeedingAssessments(subject, metadata = {}) {
    const ids = [...new Set([
      ...(Array.isArray(subject?.huntingAssessmentIds) ? subject.huntingAssessmentIds : []),
      subject?.huntingAssessmentId
    ].map(value => String(value || "").trim()).filter(Boolean))];
    for (const id of ids) this.scene.campaignSystem?.huntingLaw?.discover?.(id, metadata);
    return ids.length;
  }

  drawMarkers(graphics) {
    if (this.scene.currentLayer === LAYERS.STREET) {
      const hasBody = Boolean(this.draggingBody) || this.evidenceSubjects(this.scene.currentLayer).some(body => !body.hiddenBody);
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
      const drain = stain.kind === "target-drain" || stain.kind === "drain";
      graphics.fillStyle(stain.kind === "target-drain" ? 0xff2f62 : drain ? 0xb31934 : 0x8a2f3c, drain ? 0.65 : 0.45);
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
