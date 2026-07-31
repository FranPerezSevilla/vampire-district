import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const CLOSE_RANGE = 42;
const DRIVER_VISION_DOT = -0.28;
const REPORT_DELAY_SECONDS = 1.25;
const REPORT_HISTORY_LIMIT = 24;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeId(value) {
  return String(value || "traffic")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "traffic";
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))];
}

function excludedIds(options = {}) {
  return new Set((options.exclude || []).map(value => (
    typeof value === "string" ? value : value?.id
  )).filter(Boolean));
}

export function trafficWitnessId(tokenId) {
  return `traffic-witness-${safeId(tokenId)}`;
}

export function trafficWitnessCandidates(materializer) {
  if (!materializer?.ready || !Array.isArray(materializer.pool)) return [];
  return materializer.pool
    .filter(slot => Boolean(
      slot?.tokenId
      && slot.container?.active !== false
      && Number.isFinite(Number(slot.x))
      && Number.isFinite(Number(slot.y))
    ))
    .map(slot => {
      const angle = finite(slot.angle);
      const occupants = Math.max(1, Math.floor(finite(
        materializer.occupantCount?.(slot),
        1
      )));
      return {
        id: trafficWitnessId(slot.tokenId),
        name: occupants > 1 ? "Traffic occupants" : "Traffic driver",
        type: NPC_TYPES.CIVILIAN,
        x: finite(slot.x),
        y: finite(slot.y),
        layer: LAYERS.STREET,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        angle,
        alive: true,
        inactive: false,
        trafficWitness: true,
        vehicleOccupant: true,
        trafficTokenId: String(slot.tokenId),
        trafficSlotIndex: finite(slot.slotIndex, -1),
        occupantCount: occupants,
        archetypeId: slot.archetypeId || null
      };
    });
}

export function trafficWitnessCanSee(witness, subject, radius = 140, { shadowed = false } = {}) {
  if (!witness || !subject || witness.layer !== subject.layer) return false;
  const dx = finite(subject.x) - finite(witness.x);
  const dy = finite(subject.y) - finite(witness.y);
  const distance = Math.hypot(dx, dy);
  const effectiveRadius = Math.max(0, finite(radius, 140)) * (shadowed ? 0.62 : 1);
  if (distance > effectiveRadius) return false;
  if (distance <= CLOSE_RANGE) return true;

  const length = distance || 1;
  const facingLength = Math.hypot(finite(witness.dirX), finite(witness.dirY)) || 1;
  const dot = (dx / length) * (finite(witness.dirX) / facingLength)
    + (dy / length) * (finite(witness.dirY) / facingLength);
  return dot >= DRIVER_VISION_DOT;
}

export class TrafficOccupantWitnessSystem {
  constructor(scene) {
    if (!scene?.witnessSystem || !scene?.trafficMaterializationSystem) {
      throw new TypeError("TrafficOccupantWitnessSystem requires witness and traffic materialization systems.");
    }
    this.scene = scene;
    this.pending = new Map();
    this.reportHistory = [];
    this.reported = new Set();
    this.destroyed = false;
    this.original = {};
    this.wrapped = {};
    this.onFeedingResolvedBound = payload => this.onFeedingResolved(payload);

    this.installWitnessBridge();
    scene.events?.on?.("feeding:resolved", this.onFeedingResolvedBound);
    this.installBrowserApi();
  }

  allCandidates() {
    return trafficWitnessCandidates(this.scene.trafficMaterializationSystem);
  }

  candidateMap() {
    return new Map(this.allCandidates().map(candidate => [candidate.id, candidate]));
  }

  witnessesSeeing(subject, radius = 140, options = {}) {
    if (!subject || this.scene.currentLayer !== LAYERS.STREET) return [];
    const layer = subject.layer ?? this.scene.currentLayer;
    if (layer !== LAYERS.STREET) return [];
    const excluded = excludedIds(options);
    const player = this.scene.player;

    return this.allCandidates().filter(candidate => {
      if (excluded.has(candidate.id) || this.pending.has(candidate.id) || this.reported.has(candidate.id)) {
        return false;
      }
      const seesSubject = trafficWitnessCanSee(candidate, subject, radius, {
        shadowed: Boolean(this.scene.currentShadowAt?.(subject.x, subject.y, candidate.layer))
      });
      const seesPlayer = player && trafficWitnessCanSee(candidate, {
        x: player.x,
        y: player.y,
        layer: this.scene.currentLayer
      }, radius, {
        shadowed: Boolean(this.scene.currentShadowAt?.(player.x, player.y, candidate.layer))
      });
      return seesSubject || seesPlayer;
    });
  }

  alarmWitness(witness, reason, severity = 14, options = {}) {
    if (!witness?.trafficWitness || this.pending.has(witness.id) || this.reported.has(witness.id)) return false;
    const source = options.source || null;
    const reactionSeconds = Math.max(0, finite(options.reactionSeconds, 1.4));
    const relatedEvidenceIds = uniqueStrings(options.relatedEvidenceIds || []);
    const memoryIds = [];

    if (options.masqueradeRisk) {
      const memory = this.scene.exposureSystem?.registerWitnessMemory?.(witness, {
        reason: `Vehicle occupants remember ${reason}.`,
        sourceEvent: options.sourceEvent || "traffic_witness_observed_supernatural_event",
        subjectId: source?.id || options.subjectId || "player",
        position: source || witness,
        exposureWeight: Math.max(4, Math.ceil(finite(severity, 14) * 0.55)),
        relatedEvidenceIds
      });
      if (memory?.id) memoryIds.push(String(memory.id));
      memoryIds.push(...uniqueStrings(witness.exposureEvidenceIds || []));
      for (const memoryId of memoryIds) {
        this.scene.exposureSystem?.linkEvidence?.(memoryId, relatedEvidenceIds);
      }
    }

    const alarm = {
      id: witness.id,
      trafficTokenId: witness.trafficTokenId,
      occupantCount: witness.occupantCount || 1,
      x: witness.x,
      y: witness.y,
      layer: witness.layer,
      dirX: witness.dirX,
      dirY: witness.dirY,
      reason: String(reason || "suspicious activity"),
      severity: Math.max(1, finite(severity, 14)),
      masqueradeRisk: Boolean(options.masqueradeRisk),
      sourceId: source?.id || options.subjectId || null,
      sourceRef: source,
      memoryIds: uniqueStrings(memoryIds),
      evidenceIds: uniqueStrings(relatedEvidenceIds),
      huntingAssessmentIds: [],
      remainingSeconds: reactionSeconds + REPORT_DELAY_SECONDS
    };
    this.pending.set(alarm.id, alarm);
    this.scene.events?.emit?.("traffic:witness-alarmed", this.publicAlarm(alarm));
    this.scene.lastActionText = `${alarm.occupantCount > 1 ? "People in a passing car" : "A driver"} saw ${alarm.reason} and can call it in.`;
    this.publish();
    return true;
  }

  onFeedingResolved(payload = {}) {
    const targetId = payload.targetId ? String(payload.targetId) : null;
    if (!targetId) return;
    const evidenceIds = uniqueStrings(payload.evidenceIds || []);
    const huntingAssessmentId = payload.huntingAssessmentId
      ? String(payload.huntingAssessmentId)
      : null;

    for (const alarm of this.pending.values()) {
      if (String(alarm.sourceId || "") !== targetId) continue;
      alarm.evidenceIds = uniqueStrings([...alarm.evidenceIds, ...evidenceIds]);
      if (huntingAssessmentId) {
        alarm.huntingAssessmentIds = uniqueStrings([
          ...alarm.huntingAssessmentIds,
          huntingAssessmentId
        ]);
      }
      for (const memoryId of alarm.memoryIds) {
        this.scene.exposureSystem?.linkEvidence?.(memoryId, evidenceIds);
      }
    }
    this.publish();
  }

  update(dt) {
    if (this.destroyed || !this.pending.size) return;
    if (this.scene.registry?.get?.("uiPaused") || this.scene.registry?.get?.("taskRevealActive")) return;
    const seconds = Math.max(0, finite(dt));
    const current = this.candidateMap();

    for (const alarm of [...this.pending.values()]) {
      const candidate = current.get(alarm.id);
      if (candidate) {
        alarm.x = candidate.x;
        alarm.y = candidate.y;
        alarm.dirX = candidate.dirX;
        alarm.dirY = candidate.dirY;
      }
      alarm.remainingSeconds = Math.max(0, alarm.remainingSeconds - seconds);
      if (alarm.remainingSeconds <= 0) this.report(alarm);
    }
    this.publish();
  }

  report(alarm) {
    if (!alarm || !this.pending.has(alarm.id)) return false;
    this.pending.delete(alarm.id);
    this.reported.add(alarm.id);

    const source = alarm.sourceRef;
    if (source?.dead && !source.corpseDiscovered) {
      source.corpseDiscovered = true;
      if (this.scene.evidenceSystem?.stats) this.scene.evidenceSystem.stats.bodiesDiscovered++;
    }
    if (source?.feedingUnconscious && !source.dead) source.feedingEvidenceDiscovered = true;

    const reason = `${alarm.occupantCount > 1 ? "Occupants of a passing vehicle report" : "A driver reports"} ${alarm.reason}.`;
    this.scene.policeSystem?.addHeat?.(
      alarm.x,
      alarm.y,
      Math.ceil(Math.max(12, alarm.severity) * 0.75),
      reason,
      { source: alarm.masqueradeRisk ? "traffic_supernatural_witness_report" : "traffic_witness_report" }
    );
    this.scene.policeSystem?.rememberPlayerPosition?.();
    this.scene.witnessSystem.reports = Math.max(0, finite(this.scene.witnessSystem.reports)) + 1;

    if (alarm.masqueradeRisk) {
      this.scene.witnessSystem.masqueradeReports = Math.max(
        0,
        finite(this.scene.witnessSystem.masqueradeReports)
      ) + 1;
      const evidenceIds = uniqueStrings([...alarm.memoryIds, ...alarm.evidenceIds]);
      this.scene.exposureSystem?.discoverLinked?.(evidenceIds, {
        knowledgeState: "institutional",
        reason,
        source: "traffic_witness_report"
      });
      for (const id of alarm.huntingAssessmentIds) {
        this.scene.campaignSystem?.huntingLaw?.discover?.(id, {
          source: "traffic_witness_report",
          witnessId: alarm.id,
          referenceId: alarm.sourceId || alarm.id
        });
      }
      if ((this.scene.exposureSystem?.level?.() || 0) >= 5) {
        this.scene.missionSystem?.failMasquerade?.(
          `The veil is broken: traffic witnesses gave institutions overwhelming evidence of ${alarm.reason}.`
        );
      }
    }

    const record = {
      ...this.publicAlarm(alarm),
      reportedAt: Date.now()
    };
    this.reportHistory.push(record);
    if (this.reportHistory.length > REPORT_HISTORY_LIMIT) this.reportHistory.shift();
    this.scene.events?.emit?.("witness-reported", {
      witnessId: alarm.id,
      witnessKind: "traffic-occupants",
      occupantCount: alarm.occupantCount,
      masqueradeRisk: alarm.masqueradeRisk,
      reason: alarm.reason
    });
    this.scene.events?.emit?.("traffic:witness-reported", record);
    this.scene.lastActionText = `${reason} Police pressure now reflects witnesses inside traffic.`;
    this.publish();
    return true;
  }

  publicAlarm(alarm) {
    return {
      id: alarm.id,
      trafficTokenId: alarm.trafficTokenId,
      occupantCount: alarm.occupantCount,
      x: alarm.x,
      y: alarm.y,
      reason: alarm.reason,
      masqueradeRisk: alarm.masqueradeRisk,
      remainingSeconds: Math.round(alarm.remainingSeconds * 100) / 100
    };
  }

  drawMarkers(graphics) {
    if (this.scene.currentLayer !== LAYERS.STREET) return;
    for (const alarm of this.pending.values()) {
      const color = alarm.masqueradeRisk ? 0xff3b50 : 0xffb02e;
      graphics.lineStyle?.(2, color, 0.95)?.strokeCircle?.(alarm.x, alarm.y, 22);
      graphics.fillStyle?.(color, 0.12)?.fillCircle?.(alarm.x, alarm.y, 22);
      this.scene.addMapLabel?.(
        alarm.occupantCount > 1 ? "! CAR WITNESSES" : "! DRIVER",
        alarm.x + 14,
        alarm.y - 20,
        color
      );
    }
  }

  installWitnessBridge() {
    const witnessSystem = this.scene.witnessSystem;
    this.original.witnessesSeeing = witnessSystem.witnessesSeeing;
    this.original.alarmWitness = witnessSystem.alarmWitness;
    this.original.drawMarkers = witnessSystem.drawMarkers;
    this.original.summary = witnessSystem.summary;
    const adapter = this;

    this.wrapped.witnessesSeeing = function trafficAwareWitnessesSeeing(subject, radius, options) {
      const ordinary = adapter.original.witnessesSeeing.call(this, subject, radius, options) || [];
      const traffic = adapter.witnessesSeeing(subject, radius, options);
      const ids = new Set(ordinary.map(witness => witness.id));
      return [...ordinary, ...traffic.filter(witness => !ids.has(witness.id))];
    };
    this.wrapped.alarmWitness = function trafficAwareAlarmWitness(witness, reason, severity, options) {
      if (witness?.trafficWitness) return adapter.alarmWitness(witness, reason, severity, options);
      return adapter.original.alarmWitness.call(this, witness, reason, severity, options);
    };
    this.wrapped.drawMarkers = function trafficAwareDrawMarkers(graphics) {
      adapter.original.drawMarkers.call(this, graphics);
      adapter.drawMarkers(graphics);
    };
    this.wrapped.summary = function trafficAwareWitnessSummary() {
      const base = adapter.original.summary.call(this);
      return `${base} · traffic pending ${adapter.pending.size} · traffic reports ${adapter.reportHistory.length}`;
    };

    witnessSystem.witnessesSeeing = this.wrapped.witnessesSeeing;
    witnessSystem.alarmWitness = this.wrapped.alarmWitness;
    witnessSystem.drawMarkers = this.wrapped.drawMarkers;
    witnessSystem.summary = this.wrapped.summary;
  }

  snapshot() {
    return {
      candidateCount: this.allCandidates().length,
      pendingCount: this.pending.size,
      reportCount: this.reportHistory.length,
      candidates: this.allCandidates().map(candidate => ({
        id: candidate.id,
        trafficTokenId: candidate.trafficTokenId,
        occupantCount: candidate.occupantCount,
        x: candidate.x,
        y: candidate.y,
        dirX: candidate.dirX,
        dirY: candidate.dirY
      })),
      pending: [...this.pending.values()].map(alarm => this.publicAlarm(alarm)),
      reports: this.reportHistory.map(record => ({ ...record }))
    };
  }

  publish() {
    const snapshot = this.snapshot();
    this.scene.statePublisher?.setMany?.({
      trafficWitnessText: `Traffic witnesses ${snapshot.candidateCount} · pending ${snapshot.pendingCount} · reports ${snapshot.reportCount}`,
      trafficWitnessState: snapshot
    });
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC_WITNESSES = Object.freeze({
      snapshot: () => this.snapshot(),
      candidates: () => this.snapshot().candidates
    });
    window.NBD_TRAFFIC_WITNESSES_READY = true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events?.off?.("feeding:resolved", this.onFeedingResolvedBound);
    const witnessSystem = this.scene.witnessSystem;
    if (witnessSystem?.witnessesSeeing === this.wrapped.witnessesSeeing) {
      witnessSystem.witnessesSeeing = this.original.witnessesSeeing;
    }
    if (witnessSystem?.alarmWitness === this.wrapped.alarmWitness) {
      witnessSystem.alarmWitness = this.original.alarmWitness;
    }
    if (witnessSystem?.drawMarkers === this.wrapped.drawMarkers) {
      witnessSystem.drawMarkers = this.original.drawMarkers;
    }
    if (witnessSystem?.summary === this.wrapped.summary) {
      witnessSystem.summary = this.original.summary;
    }
    this.pending.clear();
    this.reported.clear();
    this.reportHistory = [];
    if (typeof window !== "undefined") {
      delete window.NBD_TRAFFIC_WITNESSES;
      window.NBD_TRAFFIC_WITNESSES_READY = false;
    }
  }
}
