import { COMBAT_STATES } from "../data/combat.js";
import { HUNGER } from "../data/balance.js";
import { NPC_TYPES } from "../data/npcs.js";
import { districtZoneAt } from "../data/district.js";
import {
  FEEDING_DEPTH_ORDER,
  FEEDING_DEPTHS,
  FEEDING_RULES,
  deepestFeedingDepthAt,
  feedingDepthLabel,
  feedingDepthRank,
  feedingDurationFor,
  feedingIncrementalRelief,
  feedingOutcomeFor,
  feedingThresholdFor,
  feedingThresholdsFor,
  nextFeedingDepth
} from "../data/feeding.js";
import { resolveAction } from "./ActionSystem.js";
import { RawAudio } from "./RawAudioSystem.js";

const STUN_SECONDS = 5.8;

export class FeedingSystem {
  constructor(scene) {
    this.scene = scene;
    this.hunger = HUNGER.start;
    this.active = null;
    this.passiveTick = 0;
    this.stats = {
      feeds: 0,
      quickBites: 0,
      fullFeeds: 0,
      drains: 0,
      targetFed: false,
      kills: 0,
      stuns: 0,
      targetHandled: false,
      civilianFeeds: 0,
      ratFeeds: 0,
      policeNeutralized: 0,
      huntersNeutralized: 0
    };
  }

  collectInteractions() {
    // Combat is deliberately absent from E. Left mouse attacks with the equipped
    // weapon and right mouse feeds on a valid target. These public methods remain
    // available to mission logic and automated scenarios without creating a
    // second player-input path.
    return [];
  }

  addPassiveHunger(dt) {
    if (!dt || this.scene.missionSystem?.failed) return;
    const before = this.hunger;
    this.hunger = Math.min(100, this.hunger + HUNGER.passivePerSecond * dt);
    this.passiveTick += dt;
    if (Math.floor(before / 25) !== Math.floor(this.hunger / 25) && this.passiveTick > 3) {
      this.passiveTick = 0;
      this.scene.lastActionText = `Hunger rises with time: ${Math.round(this.hunger)}%. Feeding becomes more tempting.`;
    }
  }

  addNoise(x, y, amount, reason) {
    if (this.scene.currentLayer !== undefined && this.scene.currentLayer !== 0) return;
    this.scene.policeSystem?.addHeat(x, y, amount, reason);
  }

  actionExclude(npc) {
    return npc?.type === NPC_TYPES.POLICE ? [] : [npc].filter(Boolean);
  }

  stun(npc) {
    if (!npc || npc.dead || npc.inactive) return;
    RawAudio.play("stun");
    resolveAction(this.scene, "stun", {
      target: npc,
      exclude: this.actionExclude(npc)
    });
    this.scene.npcSystem.markStunned(npc, STUN_SECONDS);
    this.stats.stuns++;
    this.addNoise(npc.x, npc.y, npc.type === NPC_TYPES.POLICE ? 12 : 6, `${this.targetName(npc)} stunned; a scuffle makes noise`);
    const seen = this.scene.witnessSystem?.onMundaneViolence(npc, `${this.targetName(npc)} stunned`, 5) || 0;
    const unlock = npc.type === NPC_TYPES.THUG ? " The police roof jump is open while he is down." : "";
    this.scene.lastActionText = `STUN: ${this.targetName(npc)} is down for ${Math.round(STUN_SECONDS)}s.${unlock} Noise spreads nearby.${seen ? ` ${seen} witness(es) saw the scuffle.` : ""}`;
  }

  kill(npc) {
    if (!npc || npc.dead || npc.inactive) return;
    RawAudio.play("kill");
    resolveAction(this.scene, "kill", {
      target: npc,
      exclude: this.actionExclude(npc)
    });
    const seen = this.scene.witnessSystem?.onMundaneViolence(npc, `${this.targetName(npc)} killed`, this.killSeverity(npc)) || 0;
    this.scene.npcSystem.markKilled(npc);
    this.scene.evidenceSystem?.onKillCompleted(npc);
    this.stats.kills++;
    this.trackNeutralized(npc);
    this.publishNeutralized(npc, "killed", "lethal action");
    this.addNoise(npc.x, npc.y, this.killNoise(npc), `${this.targetName(npc)} killed; impact and struggle heard`);
    if (npc.type === NPC_TYPES.TARGET) {
      this.stats.targetHandled = true;
      this.scene.missionSystem.resolveJournalistPlaceholder("Journalist eliminated without draining. Return to the rooftop refuge to report.");
    }
    const unlock = npc.type === NPC_TYPES.THUG ? " The police roof jump is now open." : "";
    this.scene.lastActionText = `KILL: ${this.targetName(npc)} eliminated.${unlock} Killing is noisy and leaves a body.${seen ? ` ${seen} witness(es) may report ordinary violence.` : ""}`;
    this.scene.redrawLayer(this.scene.lastActionText);
  }

  startDrain(npc, { source = "system", eligibility = "legacy" } = {}) {
    if (!npc || npc.dead || npc.inactive || this.active) return false;
    const startingDepth = this.normalizedExistingDepth(npc);
    if (feedingDepthRank(startingDepth) >= feedingDepthRank(FEEDING_DEPTHS.DRAIN)) return false;

    RawAudio.play("drainStart");
    resolveAction(this.scene, "drain", {
      target: npc,
      exclude: [npc]
    });

    const startingTime = feedingThresholdFor(npc.type, startingDepth) || 0;
    this.active = {
      kind: "drain",
      npc,
      time: startingTime,
      duration: this.durationFor(npc),
      startingDepth,
      startingNeutralized: Boolean(npc.dead || npc.combat?.state === COMBAT_STATES.DOWNED),
      deepestDepth: FEEDING_DEPTHS.NONE,
      emittedDepths: new Set(),
      seenNotified: false,
      maxWitnesses: 0,
      source,
      eligibility
    };
    npc.vx = 0;
    npc.vy = 0;
    npc.luredTimer = 0;
    npc.enemyAttack = null;
    npc.drainVictim = true;

    const nextDepth = nextFeedingDepth(npc.type, startingDepth);
    const nextLabel = nextDepth ? feedingDepthLabel(nextDepth) : feedingDepthLabel(FEEDING_DEPTHS.DRAIN);
    this.scene.lastActionText = `FEEDING started: ${this.targetName(npc)}. Hold RMB for ${nextLabel}; release after a threshold to take only that much.`;
    this.scene.events?.emit?.("feeding:started", {
      targetId: npc.id,
      source,
      eligibility,
      duration: this.active.duration,
      startingDepth,
      nextDepth,
      thresholds: { ...feedingThresholdsFor(npc.type) }
    });
    return true;
  }

  update(dt, movementIntent = false) {
    if (!this.active) return;
    if (movementIntent) {
      this.interrupt("movement", "You move and break away from the victim.");
      return;
    }

    const feed = this.active;
    const speed = Math.max(0.1, Number(this.scene.powersSystem?.feedingSpeedMultiplier?.()) || 1);
    feed.time = Math.min(feed.duration, feed.time + Math.max(0, Number(dt) || 0) * speed);
    this.updateReachedThresholds(feed);
    if (this.active === feed && feed.deepestDepth === FEEDING_DEPTHS.DRAIN) {
      this.resolveDepth(FEEDING_DEPTHS.DRAIN, { reason: "threshold", interrupted: false });
    }
  }

  updateReachedThresholds(feed = this.active) {
    if (!feed) return FEEDING_DEPTHS.NONE;
    for (const depth of FEEDING_DEPTH_ORDER) {
      if (feedingDepthRank(depth) <= feedingDepthRank(feed.startingDepth)) continue;
      const threshold = feedingThresholdFor(feed.npc?.type, depth);
      if (!Number.isFinite(threshold) || feed.time + 1e-9 < threshold || feed.emittedDepths.has(depth)) continue;
      feed.emittedDepths.add(depth);
      feed.deepestDepth = depth;
      this.scene.events?.emit?.("feeding:threshold-reached", {
        targetId: feed.npc?.id || null,
        depth,
        label: feedingDepthLabel(depth),
        threshold,
        progress: Math.min(1, feed.time / Math.max(0.001, feed.duration)),
        source: feed.source || "system"
      });
    }
    if (feed.deepestDepth === FEEDING_DEPTHS.NONE) {
      feed.deepestDepth = deepestFeedingDepthAt(feed.time, feed.npc?.type, { afterDepth: feed.startingDepth });
    }
    return feed.deepestDepth;
  }

  release(reason = "input-release") {
    const feed = this.active;
    if (!feed) return false;
    const depth = this.updateReachedThresholds(feed);
    if (depth === FEEDING_DEPTHS.NONE) {
      this.cancel("You release before taking enough blood.", reason);
      return false;
    }
    return this.resolveDepth(depth, { reason, interrupted: false });
  }

  interrupt(reason = "interrupted", message = "Feeding interrupted.") {
    const feed = this.active;
    if (!feed) return false;
    const depth = this.updateReachedThresholds(feed);
    if (depth === FEEDING_DEPTHS.NONE) {
      this.cancel(message, reason);
      this.scene.events?.emit?.("feeding:interrupted", {
        targetId: feed.npc?.id || null,
        source: feed.source || "system",
        reason,
        resolved: false,
        depth: null
      });
      return false;
    }
    return this.resolveDepth(depth, { reason, interrupted: true });
  }

  cancel(message = "Feeding cancelled.", reason = "cancelled") {
    const feed = this.active;
    if (feed) RawAudio.play("drainCancel");
    if (feed?.npc) feed.npc.drainVictim = false;
    this.active = null;
    this.scene.lastActionText = message;
    if (feed) {
      this.scene.events?.emit?.("feeding:cancelled", {
        targetId: feed.npc?.id || null,
        source: feed.source || "system",
        reason,
        message
      });
    }
  }

  completeDrain() {
    const feed = this.active;
    if (!feed) return null;
    feed.time = feed.duration;
    feed.deepestDepth = FEEDING_DEPTHS.DRAIN;
    return this.resolveDepth(FEEDING_DEPTHS.DRAIN, { reason: "complete-drain", interrupted: false });
  }

  resolveDepth(depth, { reason = "released", interrupted = false } = {}) {
    const feed = this.active;
    if (!feed) return null;
    const npc = feed.npc;
    if (!npc || feedingDepthRank(depth) <= feedingDepthRank(feed.startingDepth)) return null;

    this.active = null;
    npc.drainVictim = false;

    const alreadyDowned = npc.combat?.state === COMBAT_STATES.DOWNED;
    const outcome = feedingOutcomeFor(npc.type, depth, { alreadyDowned });
    const witnessResult = feed.seenNotified
      ? { witnesses: Math.max(1, feed.maxWitnesses || 0), witnessIds: feed.witnessIds || [] }
      : this.scene.witnessSystem?.onFeedingResolved?.(npc, depth) || { witnesses: 0, witnessIds: [] };
    const relief = this.reliefFor(npc, depth, feed.startingDepth);
    const hungerBefore = this.hunger;
    this.hunger = Math.max(0, this.hunger - relief);

    this.applyFeedingOutcome(npc, depth, outcome);
    this.recordStats(npc, depth, outcome);

    const result = {
      feedingDepth: depth,
      feedingDepthLabel: feedingDepthLabel(depth),
      progress: Math.min(1, feed.time / Math.max(0.001, feed.duration)),
      thresholdReached: feedingThresholdFor(npc.type, depth),
      hungerBefore,
      hungerAfter: this.hunger,
      hungerRelief: relief,
      victimOutcome: outcome.victimOutcome,
      victimAlive: outcome.victimAlive,
      victimConscious: outcome.victimConscious,
      bodyEvidence: outcome.bodyEvidence,
      biteEvidence: outcome.biteEvidence,
      memoryState: outcome.memoryState,
      interrupted: Boolean(interrupted),
      interruptionReason: interrupted ? reason : null,
      source: feed.source || "system",
      eligibility: feed.eligibility || "legacy",
      witnessCount: Math.max(0, Number(witnessResult.witnesses) || 0)
    };

    const huntingAssessment = this.assessHuntingLaw(npc, feed, witnessResult, result);
    if (huntingAssessment?.id) {
      npc.huntingAssessmentId = huntingAssessment.id;
      npc.huntingAssessmentIds = [...new Set([...(npc.huntingAssessmentIds || []), huntingAssessment.id])];
    }

    const evidenceIds = this.scene.evidenceSystem?.onFeedingResolved?.(npc, {
      ...result,
      huntingAssessmentId: huntingAssessment?.id || null,
      bloodStains: outcome.bloodStains,
      recoverableVictim: outcome.recoverableVictim
    }) || [];
    result.evidenceIds = [...evidenceIds];
    const witnessIds = [...new Set((witnessResult.witnessIds || []).map(String).filter(Boolean))];
    for (const witnessId of witnessIds) {
      const witness = this.scene.npcSystem?.npcs?.find(candidate => candidate.id === witnessId);
      if (!witness) continue;
      for (const memoryId of witness.exposureEvidenceIds || []) {
        this.scene.exposureSystem?.linkEvidence?.(memoryId, evidenceIds);
      }
      if (huntingAssessment?.id) {
        witness.pendingHuntingAssessmentIds = [...new Set([
          ...(witness.pendingHuntingAssessmentIds || []),
          huntingAssessment.id
        ])];
      }
    }

    if (outcome.neutralized && !feed.startingNeutralized && npc.type !== NPC_TYPES.RAT) {
      this.trackNeutralized(npc);
      this.publishNeutralized(npc, depth === FEEDING_DEPTHS.DRAIN ? "drained" : "fed-unconscious", depth);
    }

    if (npc.type === NPC_TYPES.TARGET && depth !== FEEDING_DEPTHS.QUICK_BITE) {
      this.stats.targetHandled = true;
      const action = depth === FEEDING_DEPTHS.DRAIN ? "drained" : "left unconscious after feeding";
      this.scene.missionSystem.resolveJournalistPlaceholder(`Journalist ${action}. Return to the rooftop refuge to report before the district reacts.`);
    }

    const publicNote = result.witnessCount ? ` Veil witness(es): ${result.witnessCount}.` : "";
    const unlock = npc.type === NPC_TYPES.THUG && outcome.neutralized ? " The police roof jump is now open." : "";
    const politicalNote = huntingAssessment?.notice ? ` ${huntingAssessment.notice}.` : "";
    const outcomeNote = this.outcomeNote(npc, depth, outcome);
    const interruptionNote = interrupted ? ` Interrupted by ${String(reason).replaceAll("_", " ")}.` : "";
    this.scene.lastActionText = `${feedingDepthLabel(depth)}: ${this.targetName(npc)}. Hunger -${relief}.${unlock} ${outcomeNote}${publicNote}${politicalNote}${interruptionNote}`.replace(/\s+/g, " ").trim();

    const eventPayload = {
      targetId: npc.id,
      source: result.source,
      eligibility: result.eligibility,
      depth,
      feedingDepth: depth,
      hungerBefore,
      hungerAfter: this.hunger,
      relief,
      hungerRelief: relief,
      victimOutcome: outcome.victimOutcome,
      victimAlive: outcome.victimAlive,
      victimConscious: outcome.victimConscious,
      bodyEvidence: outcome.bodyEvidence,
      biteEvidence: outcome.biteEvidence,
      memoryState: outcome.memoryState,
      interrupted: Boolean(interrupted),
      interruptionReason: interrupted ? reason : null,
      witnessCount: result.witnessCount,
      huntingAssessmentId: huntingAssessment?.id || null,
      huntingClassification: huntingAssessment?.classification || null,
      huntingPoliticalViolation: Boolean(huntingAssessment?.politicalViolation),
      huntingDiscoveryState: huntingAssessment?.currentDiscoveryState || huntingAssessment?.discoveryState || null,
      evidenceIds: [...evidenceIds]
    };
    this.scene.events?.emit?.("feeding:resolved", eventPayload);
    // Compatibility event for existing AI/mission fixtures. New code should use feeding:resolved.
    this.scene.events?.emit?.("feeding:completed", eventPayload);
    if (interrupted) {
      this.scene.events?.emit?.("feeding:interrupted", {
        targetId: npc.id,
        source: result.source,
        reason,
        resolved: true,
        depth
      });
    }
    this.scene.events?.emit?.("hunger:changed", {
      source: "feeding",
      before: hungerBefore,
      after: this.hunger,
      amount: this.hunger - hungerBefore,
      feedingDepth: depth
    });

    RawAudio.play(depth === FEEDING_DEPTHS.DRAIN ? "drainComplete" : "drainCancel", { cooldown: 0.05 });
    this.scene.redrawLayer(this.scene.lastActionText);
    return { ...result, huntingAssessment };
  }

  applyFeedingOutcome(npc, depth, outcome) {
    npc.feedingDepth = depth;
    npc.feedingMemoryState = outcome.memoryState;
    npc.feedingBiteEvidence = Boolean(outcome.biteEvidence);
    npc.feedingEvidenceDiscovered = false;
    npc.lastFeedingDepth = depth;

    if (depth === FEEDING_DEPTHS.QUICK_BITE) {
      npc.feedingUnconscious = Boolean(npc.combat?.state === COMBAT_STATES.DOWNED);
      if (!npc.feedingUnconscious) {
        this.scene.npcSystem?.markStunned?.(npc, FEEDING_RULES.quickBiteDisorientationSeconds);
      }
      return;
    }

    if (depth === FEEDING_DEPTHS.FULL_FEED) {
      npc.feedingUnconscious = true;
      if (npc.combat?.state !== COMBAT_STATES.DOWNED) {
        if (this.scene.combatSystem?.knockDown) {
          this.scene.combatSystem.knockDown(npc, { id: "full_feed", name: "Full Feed" });
        } else if (npc.combat) {
          npc.combat.state = COMBAT_STATES.DOWNED;
          npc.combat.resilience = 0;
          npc.stunnedTimer = Number.POSITIVE_INFINITY;
        } else {
          npc.stunnedTimer = Number.POSITIVE_INFINITY;
        }
      }
      return;
    }

    npc.feedingUnconscious = false;
    npc.feedingMemoryState = "none";
    this.scene.npcSystem?.markFed?.(npc);
  }

  recordStats(npc, depth, outcome) {
    this.stats.feeds++;
    if (depth === FEEDING_DEPTHS.QUICK_BITE) this.stats.quickBites++;
    if (depth === FEEDING_DEPTHS.FULL_FEED) this.stats.fullFeeds++;
    if (depth === FEEDING_DEPTHS.DRAIN) this.stats.drains++;
    if (npc.type === NPC_TYPES.TARGET) this.stats.targetFed = true;
    if (npc.type === NPC_TYPES.CIVILIAN) this.stats.civilianFeeds++;
    if (npc.type === NPC_TYPES.RAT) this.stats.ratFeeds++;
    if (outcome.lethal && npc.type !== NPC_TYPES.RAT) this.stats.targetHandled ||= npc.type === NPC_TYPES.TARGET;
  }

  outcomeNote(npc, depth, outcome) {
    if (npc.type === NPC_TYPES.RAT) return "The rat is consumed; no human scene remains.";
    if (depth === FEEDING_DEPTHS.QUICK_BITE) {
      return outcome.victimConscious
        ? "The victim remains alive, disoriented and marked."
        : "The victim remains alive and unconscious with a fresh bite.";
    }
    if (depth === FEEDING_DEPTHS.FULL_FEED) return "The victim survives unconscious with visible bite evidence.";
    return "A drained body remains.";
  }

  assessHuntingLaw(npc, feed, witnessResult = {}, result = {}) {
    const huntingLaw = this.scene.campaignSystem?.huntingLaw;
    if (!huntingLaw || !npc) return null;
    const district = districtZoneAt(npc.x, npc.y);
    if (!district?.id) return null;
    const witnessCount = Math.max(
      0,
      Number(witnessResult?.witnesses) || 0,
      Number(feed?.maxWitnesses) || 0
    );
    try {
      return huntingLaw.assessFeed({
        districtId: district.id,
        victim: {
          id: npc.id,
          type: npc.type,
          huntingProtected: npc.huntingProtected,
          huntingProtection: npc.huntingProtection,
          huntingProtectionReason: npc.huntingProtectionReason,
          protectedByFactionId: npc.protectedByFactionId,
          protectedByContactId: npc.protectedByContactId
        },
        feedingDepth: result.feedingDepth || FEEDING_DEPTHS.DRAIN,
        victimOutcome: result.victimOutcome || "dead",
        victimAlive: result.victimAlive ?? false,
        victimConscious: result.victimConscious ?? false,
        memoryState: result.memoryState || "none",
        witnessCount,
        bodyEvidence: Boolean(result.bodyEvidence),
        biteEvidence: Boolean(result.biteEvidence),
        wantedLevel: this.scene.heatSystem?.level?.() ?? this.scene.exposureSystem?.level?.() ?? 0,
        factionObserver: false,
        source: feed?.source || "system",
        eligibility: feed?.eligibility || "legacy",
        layer: npc.layer ?? this.scene.currentLayer ?? 0
      });
    } catch (error) {
      console.warn("Hunting-law assessment failed; feeding remains playable.", error);
      return null;
    }
  }

  publishNeutralized(npc, kind, weaponId) {
    if (!npc || npc.type === NPC_TYPES.RAT) return;
    this.scene.events?.emit?.("combat:entity-neutralized", {
      targetId: npc.id,
      type: npc.type,
      kind,
      weaponId
    });
  }

  trackNeutralized(npc) {
    if (npc.type === NPC_TYPES.POLICE) this.stats.policeNeutralized++;
    if (npc.type === NPC_TYPES.HUNTER) this.stats.huntersNeutralized++;
  }

  killSeverity(npc) {
    if (npc.type === NPC_TYPES.POLICE) return 18;
    if (npc.type === NPC_TYPES.HUNTER) return 22;
    if (npc.type === NPC_TYPES.THUG) return 13;
    if (npc.type === NPC_TYPES.TARGET) return 14;
    return 10;
  }

  killNoise(npc) {
    if (npc.type === NPC_TYPES.POLICE) return 22;
    if (npc.type === NPC_TYPES.HUNTER) return 26;
    if (npc.type === NPC_TYPES.THUG) return 14;
    if (npc.type === NPC_TYPES.TARGET) return 16;
    return 12;
  }

  normalizedExistingDepth(npc) {
    const depth = String(npc?.feedingDepth || FEEDING_DEPTHS.NONE);
    return feedingDepthRank(depth) > 0 ? depth : FEEDING_DEPTHS.NONE;
  }

  reliefFor(npc, depth = FEEDING_DEPTHS.DRAIN, previousDepth = FEEDING_DEPTHS.NONE) {
    if (!npc) return 0;
    return feedingIncrementalRelief(npc.type, depth, previousDepth);
  }

  durationFor(npc) {
    return feedingDurationFor(npc?.type);
  }

  targetName(npc) {
    if (!npc) return "target";
    if (npc.type === NPC_TYPES.TARGET) return "journalist";
    if (npc.type === NPC_TYPES.POLICE) return "police officer";
    if (npc.type === NPC_TYPES.HUNTER) return "hunter";
    if (npc.type === NPC_TYPES.THUG) return "rooftop thug";
    if (npc.type === NPC_TYPES.RAT) return "rat";
    return "civilian";
  }

  isActive() {
    return Boolean(this.active);
  }

  progress() {
    if (!this.active) return null;
    const feed = this.active;
    const reachedDepth = feed.deepestDepth !== FEEDING_DEPTHS.NONE ? feed.deepestDepth : null;
    const currentDepth = reachedDepth || feed.startingDepth;
    const nextDepth = nextFeedingDepth(feed.npc?.type, currentDepth);
    return {
      x: this.scene.player.x,
      y: this.scene.player.y,
      pct: Math.min(1, feed.time / Math.max(0.001, feed.duration)),
      time: feed.time,
      duration: feed.duration,
      startingDepth: feed.startingDepth,
      reachedDepth,
      reachedLabel: reachedDepth ? feedingDepthLabel(reachedDepth) : null,
      nextDepth,
      nextLabel: nextDepth ? feedingDepthLabel(nextDepth) : null,
      ready: Boolean(reachedDepth),
      thresholds: { ...feedingThresholdsFor(feed.npc?.type) },
      label: reachedDepth
        ? `Release · ${feedingDepthLabel(reachedDepth)}`
        : `Hold · ${feedingDepthLabel(nextDepth || FEEDING_DEPTHS.DRAIN)}`
    };
  }

  summary() {
    const active = this.active ? ` · feeding ${Math.round((this.active.time / this.active.duration) * 100)}%` : "";
    return `Hunger ${Math.round(this.hunger)}% · bites ${this.stats.quickBites} · full ${this.stats.fullFeeds} · drains ${this.stats.drains} · kills ${this.stats.kills}${active}`;
  }
}
