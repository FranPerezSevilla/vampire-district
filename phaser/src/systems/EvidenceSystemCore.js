import { bodyHideSpots, LAYERS, shadowZones } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { FEEDING_DEPTHS } from "../data/feeding.js";
import { EVIDENCE_KINDS, KNOWLEDGE_STATES } from "../data/attention.js";
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
    if (!npc || npc.type === NPC_TYPES.RAT) return [];
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
    const exposure = this.scene.exposureSystem;
    const evidenceIds = [];
    const addRecord = input => {
      const record = exposure?.registerEvidence?.({
        x: npc.x,
        y: npc.y,
        layer: npc.layer,
        subjectId: npc.id,
        knowledgeState: KNOWLEDGE_STATES.LATENT,
        ...input
      });
      if (record?.id) evidenceIds.push(record.id);
      return record;
    };

    if (result.biteEvidence) {
      addRecord({
        kind: EVIDENCE_KINDS.BITE_MARKS,
        sourceEvent: `feeding:${depth}`,
        exposureWeight: depth === FEEDING_DEPTHS.QUICK_BITE ? 5 : depth === FEEDING_DEPTHS.FULL_FEED ? 8 : 10,
        reason: `${result.feedingDepthLabel || depth} leaves abnormal bite marks.`,
        dedupeKey: `feeding:${npc.id}:bite_marks`
      });
    }
    if (depth === FEEDING_DEPTHS.FULL_FEED || result.victimOutcome === "unconscious") {
      addRecord({
        kind: EVIDENCE_KINDS.UNCONSCIOUS_FEEDING_VICTIM,
        sourceEvent: "feeding:full_feed",
        exposureWeight: 14,
        reason: "An unconscious feeding victim remains in the world.",
        dedupeKey: `feeding:${npc.id}:unconscious_victim`
      });
    }
    if (depth === FEEDING_DEPTHS.DRAIN || result.bodyEvidence) {
      addRecord({
        kind: EVIDENCE_KINDS.DRAINED_BODY,
        sourceEvent: "feeding:drain",
        exposureWeight: npc.type === NPC_TYPES.POLICE || npc.type === NPC_TYPES.HUNTER ? 28 : 24,
        reason: "A drained body remains as concrete supernatural evidence.",
        dedupeKey: `feeding:${npc.id}:drained_body`
      });
    }

    let bloodRecord = null;
    if (count > 0) {
      bloodRecord = addRecord({
        kind: EVIDENCE_KINDS.BLOOD_PATTERN,
        sourceEvent: `feeding:${depth}:blood`,
        exposureWeight: depth === FEEDING_DEPTHS.FULL_FEED ? 5 : depth === FEEDING_DEPTHS.DRAIN ? 9 : 2,
        reason: "The feeding leaves an abnormal blood pattern.",
        dedupeKey: `feeding:${npc.id}:blood_pattern`
      });
    }
    for (let i = 0; i < count; i++) {
      this.createBloodStain(npc.x, npc.y, npc.layer, kind, {
        exposureEvidenceIds: bloodRecord?.id ? [bloodRecord.id] : []
      });
    }
    npc.exposureEvidenceIds = this.uniqueEvidenceIds([...(npc.exposureEvidenceIds || []), ...evidenceIds]);
    npc.feedingEvidenceDiscovered = false;
    return evidenceIds;
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

  createBloodStain(x, y, layer, kind = "blood", options = {}) {
    const stain = {
      id: this.nextBloodId++,
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 18,
      layer,
      kind,
      age: 0,
      life: layer === LAYERS.SEWER ? 12 : 80,
      discovered: false,
      exposureEvidenceIds: this.uniqueEvidenceIds(options.exposureEvidenceIds || [])
    };
    this.bloodStains.push(stain);
    this.stats.bloodStains++;
    if (this.bloodStains.length > 48) this.bloodStains.shift();
    return stain;
  }

  updateBlood(dt) {
    const expired = [];
    for (const stain of this.bloodStains) {
      stain.age += dt;
      stain.life -= stain.layer === LAYERS.SEWER ? dt * 2.5 : dt * 0.12;
      if (stain.life <= 0) expired.push(stain);
    }
    this.bloodStains = this.bloodStains.filter(stain => stain.life > 0);
    this.resolveOrphanedStainEvidence(expired, "Blood evidence faded or was washed away.");
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
    this.scene.exposureSystem?.resolveLinked?.(body.exposureEvidenceIds || [], {
      reason: `${this.subjectNoun(body)} hidden in ${spot.name}.`,
      source: "body_hidden",
      onlyLatent: true
    });
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
    const removed = [];
    this.bloodStains = this.bloodStains.filter(stain => {
      if (stain.layer !== layer) return true;
      const keep = Phaser.Math.Distance.Between(x, y, stain.x, stain.y) > radius;
      if (!keep) removed.push(stain);
      return keep;
    });
    this.resolveOrphanedStainEvidence(removed, "Blood traces were cleaned from the scene.");
    return removed.length;
  }

  uniqueEvidenceIds(values = []) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(value => String(value || "").trim())
      .filter(Boolean))];
  }

  resolveOrphanedStainEvidence(stains = [], reason = "Blood evidence removed.") {
    const candidates = this.uniqueEvidenceIds(stains.flatMap(stain => stain?.exposureEvidenceIds || []));
    const surviving = new Set(this.bloodStains.flatMap(stain => stain?.exposureEvidenceIds || []));
    const orphaned = candidates.filter(id => !surviving.has(id));
    if (orphaned.length) {
      this.scene.exposureSystem?.resolveLinked?.(orphaned, {
        reason,
        source: "blood_cleanup",
        onlyLatent: true
      });
    }
    return orphaned.length;
  }

  updateCorpseDiscovery() {
    for (const body of this.scene.npcSystem.visibleBodies(LAYERS.STREET)) {
      if (body.hiddenBody || body.dragged || body.corpseDiscovered) continue;
      const pendingWitness = this.scene.witnessSystem?.alarmedWitnesses?.()
        .some(witness => witness.witnessSource === body);
      if (pendingWitness) continue;
      const hidden = this.shadowAt(body.x, body.y, body.layer);
      const range = hidden ? 58 : 120;
      const watcher = this.scene.npcSystem.npcs.find(npc => {
        if (npc.dead || npc.inactive || npc.intercepted || npc.hasReported || npc.alarmed || npc.stunnedTimer > 0 || npc.layer !== body.layer) return false;
        if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
        return Phaser.Math.Distance.Between(npc.x, npc.y, body.x, body.y) <= range;
      });
      if (watcher) {
        const evidenceIds = this.uniqueEvidenceIds(body.exposureEvidenceIds || []);
        const alarmed = this.scene.witnessSystem.alarmWitness(watcher, "an abandoned body", 16, {
          masqueradeRisk: evidenceIds.length > 0,
          reactionSeconds: 1.2,
          source: body,
          relatedEvidenceIds: evidenceIds
        });
        if (alarmed) {
          watcher.pendingHuntingAssessmentIds = this.uniqueEvidenceIds([
            ...(watcher.pendingHuntingAssessmentIds || []),
            ...this.feedingAssessmentIds(body)
          ]);
        }
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
        if (npc === victim || npc.dead || npc.inactive || npc.intercepted || npc.hasReported || npc.alarmed || npc.stunnedTimer > 0) return false;
        if (npc.layer !== victim.layer || ![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
        return Phaser.Math.Distance.Between(npc.x, npc.y, victim.x, victim.y) <= range;
      });
      if (!watcher) continue;

      const evidenceIds = this.uniqueEvidenceIds(victim.exposureEvidenceIds || []);
      const pendingWitness = this.scene.witnessSystem?.alarmedWitnesses?.()
        .some(candidate => candidate.witnessSource === victim);
      if (pendingWitness) continue;
      const alarmed = this.scene.witnessSystem?.alarmWitness?.(watcher, "an unconscious victim with strange bite marks", 14, {
        masqueradeRisk: true,
        reactionSeconds: 1.0,
        source: victim,
        relatedEvidenceIds: evidenceIds
      });
      if (alarmed) {
        watcher.pendingHuntingAssessmentIds = this.uniqueEvidenceIds([
          ...(watcher.pendingHuntingAssessmentIds || []),
          ...this.feedingAssessmentIds(victim)
        ]);
      }
    }
  }

  feedingAssessmentIds(subject) {
    return [...new Set([
      ...(Array.isArray(subject?.huntingAssessmentIds) ? subject.huntingAssessmentIds : []),
      subject?.huntingAssessmentId
    ].map(value => String(value || "").trim()).filter(Boolean))];
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
