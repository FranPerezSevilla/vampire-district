import { HUNGER } from "../data/balance.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import {
  PREDATOR_POWER_RULES,
  WHISPER_COMMANDS,
  beastModifiers,
  beastProfileForHunger,
  bloodSenseReading,
  bloodSenseRangeForHunger,
  evaluateWhisperCommand,
  whisperCommandAvailability,
  whisperCommandConfig,
  whisperCommandLabel
} from "../data/predator-powers.js";
import { resolveAction } from "./ActionSystem.js";
import { RawAudio } from "./RawAudioSystem.js";

const HUMAN_MIND_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG
]);

const COMMAND_ORDER = Object.freeze([
  WHISPER_COMMANDS.COME_HERE,
  WHISPER_COMMANDS.WALK_AWAY,
  WHISPER_COMMANDS.STAY_CALM,
  WHISPER_COMMANDS.FORGET_THIS,
  WHISPER_COMMANDS.OPEN_IT,
  WHISPER_COMMANDS.GET_IN,
  WHISPER_COMMANDS.CALL_THEM_OFF
]);

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

export class PowersSystem {
  constructor(scene) {
    this.scene = scene;
    this.cooldowns = {
      dash: 0,
      whisper: 0,
      sense: 0,
      beast: 0
    };
    this.senseTimer = 0;
    this.beastTimer = 0;
    this.lastDir = { x: 0, y: 1 };
    this.lastSenseReadings = [];
    this.graphics = scene.add.graphics().setDepth(48);
    this.senseLabels = new Map();
    this.installDiagnostics();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(dt, input = this.scene.currentInputFrame) {
    this.scene.feedingSystem?.addPassiveHunger(dt);
    this.cooldowns.dash = Math.max(0, this.cooldowns.dash - dt);
    this.cooldowns.whisper = Math.max(0, this.cooldowns.whisper - dt);
    this.cooldowns.sense = Math.max(0, this.cooldowns.sense - dt);
    this.cooldowns.beast = Math.max(0, this.cooldowns.beast - dt);
    this.senseTimer = Math.max(0, this.senseTimer - dt);

    const beastBefore = this.beastTimer;
    this.beastTimer = Math.max(0, this.beastTimer - dt);
    if (beastBefore > 0 && this.beastTimer <= 0) {
      this.scene.events?.emit?.("beast:ended", {
        hunger: this.hunger(),
        state: this.beastProfile().state
      });
      this.scene.lastActionText = "The Beast recedes. Control returns, but the Hunger remains.";
    }

    this.updateWhisperCommands(dt);

    const frame = this.normalizeInput(input);
    if (frame.hasMovementIntent) this.lastDir = { ...frame.move };

    if (!this.scene.interactionSystem?.isOpen && !this.scene.feedingSystem?.isActive()) {
      if (frame.bloodSensePressed) this.useBloodSense();
      if (frame.whisperPressed) this.useWhisper();
      if (frame.dashPressed) this.useDash();
      if (frame.beastPressed) this.giveIn();
    }

    this.drawSenseOverlay();
    this.drawWhisperLines();
    this.drawBeastAura();
  }

  normalizeInput(input) {
    if (input && Object.hasOwn(input, "dashPressed")) {
      return {
        move: input.move || { x: 0, y: 0 },
        hasMovementIntent: Boolean(input.hasMovementIntent),
        dashPressed: Boolean(input.dashPressed),
        whisperPressed: Boolean(input.whisperPressed),
        bloodSensePressed: Boolean(input.bloodSensePressed),
        beastPressed: Boolean(input.beastPressed)
      };
    }

    const keys = input || {};
    let x = 0;
    let y = 0;
    if (keys.left?.isDown || keys.a?.isDown) x -= 1;
    if (keys.right?.isDown || keys.d?.isDown) x += 1;
    if (keys.up?.isDown || keys.w?.isDown) y -= 1;
    if (keys.down?.isDown || keys.s?.isDown) y += 1;
    const length = Math.hypot(x, y) || 1;
    return {
      move: { x: x / length, y: y / length },
      hasMovementIntent: Boolean(x || y),
      dashPressed: this.justDown(keys.dash),
      whisperPressed: this.justDown(keys.whisper),
      bloodSensePressed: this.justDown(keys.sense),
      beastPressed: this.justDown(keys.beast)
    };
  }

  justDown(key) {
    return Boolean(key && Phaser.Input.Keyboard.JustDown(key));
  }

  hunger() {
    return Math.max(0, Math.min(100, finite(this.scene.feedingSystem?.hunger)));
  }

  beastProfile() {
    return beastProfileForHunger(this.hunger());
  }

  modifiers() {
    return beastModifiers(this.hunger(), { givenIn: this.isGivenIn() });
  }

  isGivenIn() {
    return this.beastTimer > 0;
  }

  movementMultiplier() {
    return this.modifiers().movementMultiplier;
  }

  feedingSpeedMultiplier() {
    return this.modifiers().feedingMultiplier;
  }

  attackModifiers(config = {}) {
    if (!this.isGivenIn() || config.attackType !== "melee") return { ...config };
    const modifiers = this.modifiers();
    return {
      ...config,
      damage: Math.max(1, finite(config.damage, 1) + modifiers.meleeDamageBonus),
      windupMs: Math.max(40, finite(config.windupMs) * modifiers.attackTimeMultiplier),
      activeMs: Math.max(40, finite(config.activeMs) * modifiers.attackTimeMultiplier),
      recoveryMs: Math.max(60, finite(config.recoveryMs) * modifiers.attackTimeMultiplier)
    };
  }

  addHunger(amount, label) {
    const feeding = this.scene.feedingSystem;
    if (!feeding) return 0;
    const before = this.hunger();
    const after = Math.min(100, before + Math.max(0, finite(amount)));
    feeding.hunger = after;
    const gained = after - before;
    this.scene.events?.emit?.("hunger:changed", {
      source: "power",
      before,
      after,
      amount: gained,
      label
    });
    if (label) this.scene.lastActionText = `${label}. Hunger +${gained}.`;
    return gained;
  }

  useBloodSense() {
    if (this.cooldowns.sense > 0) {
      RawAudio.play("cancel");
      return false;
    }
    this.cooldowns.sense = HUNGER.senseCooldown;
    this.senseTimer = PREDATOR_POWER_RULES.bloodSense.seconds;
    RawAudio.play("sense");
    this.addHunger(HUNGER.senseCost, "Blood Sense opens the district's veins");
    resolveAction(this.scene, "bloodSense", {
      x: this.scene.player.x,
      y: this.scene.player.y,
      layer: this.scene.currentLayer
    });
    this.lastSenseReadings = this.bloodSenseReadings();
    const hearts = this.lastSenseReadings.filter(reading => reading.heartbeat).length;
    const silence = this.lastSenseReadings.filter(reading => reading.kind === "silent").length;
    const profile = this.beastProfile();
    this.scene.lastActionText = `BLOOD SENSE · ${hearts} heartbeat(s) · ${silence} silence(s) · ${profile.label}.`;
    this.scene.events?.emit?.("blood-sense:activated", {
      hunger: this.hunger(),
      beastState: profile.state,
      range: bloodSenseRangeForHunger(this.hunger()),
      readings: this.lastSenseReadings.map(reading => ({
        id: reading.id,
        kind: reading.kind,
        protectionKnown: reading.protectionKnown,
        distance: reading.distance
      }))
    });
    return true;
  }

  bloodSenseReadings() {
    const player = this.scene.player || { x: 0, y: 0 };
    const readings = [];
    const range = bloodSenseRangeForHunger(this.hunger());
    const candidates = this.scene.npcSystem?.queryRadius?.(
      player.x,
      player.y,
      range,
      this.scene.currentLayer
    ) || this.scene.npcSystem?.npcs || [];

    for (const npc of candidates) {
      if (npc.layer !== this.scene.currentLayer) continue;
      const reading = bloodSenseReading(npc, {
        player,
        hunger: this.hunger(),
        protectionKnown: this.protectionKnown(npc)
      });
      if (!reading) continue;
      reading.behindCover = !this.lineClearTo(npc);
      readings.push(reading);
    }

    for (const stain of this.scene.evidenceSystem?.bloodStains || []) {
      if (stain.cleaned || stain.layer !== this.scene.currentLayer) continue;
      const distance = Phaser.Math.Distance.Between(player.x, player.y, stain.x, stain.y);
      if (distance > range) continue;
      readings.push({
        id: `blood:${stain.id}`,
        kind: "blood",
        label: "FRESH BLOOD",
        color: 0xb31934,
        x: stain.x,
        y: stain.y,
        layer: stain.layer,
        distance,
        range,
        intensity: Math.max(0.18, 1 - distance / range),
        vulnerability: 0,
        protectionKnown: false,
        protectedLabel: null,
        heartbeat: false,
        behindCover: false
      });
    }

    return readings.sort((left, right) => {
      const priority = reading => {
        if (reading.kind === "silent") return 0;
        if (reading.kind === "wounded" || reading.kind === "unconscious") return 1;
        if (reading.kind === "drained" || reading.kind === "blood") return 2;
        return 3;
      };
      return priority(left) - priority(right) || left.distance - right.distance || left.id.localeCompare(right.id);
    });
  }

  protectionKnown(npc) {
    if (!npc) return false;
    const protection = this.scene.campaignSystem?.huntingLaw?.protection?.(npc);
    return Boolean(
      protection
      && !protection.revokedAt
      && (npc.huntingProtectionKnown || npc.protectionKnown || protection.knownToPlayer)
    );
  }

  lineClearTo(npc) {
    if (!this.scene.npcSystem?.lineClear || !npc) return true;
    return this.scene.npcSystem.lineClear(
      npc,
      this.scene.player.x,
      this.scene.player.y,
      npc.x,
      npc.y
    );
  }

  useWhisper() {
    if (this.cooldowns.whisper > 0) {
      RawAudio.play("cancel");
      return false;
    }
    const npc = this.nearestWhisperTarget();
    if (!npc) {
      RawAudio.play("whisperFail");
      this.scene.lastActionText = "WHISPER FAILED · no reachable living mind in your aim.";
      this.cooldowns.whisper = PREDATOR_POWER_RULES.whisper.failureCooldown;
      return false;
    }

    const options = this.whisperOptions(npc);
    if (!options.length) {
      RawAudio.play("whisperFail");
      this.scene.lastActionText = npc.type === NPC_TYPES.HUNTER
        ? "WHISPER FAILED · the hunter's trained mind is sealed against you."
        : "WHISPER FAILED · this mind offers no valid command in the current context.";
      this.cooldowns.whisper = PREDATOR_POWER_RULES.whisper.failureCooldown;
      return false;
    }

    this.scene.interactionSystem.open(options);
    this.scene.lastActionText = `WHISPER · choose a command for ${this.targetName(npc)}.`;
    this.scene.events?.emit?.("whisper:menu-opened", {
      targetId: npc.id,
      commands: options.map(option => option.command),
      hunger: this.hunger(),
      beastState: this.beastProfile().state
    });
    return true;
  }

  whisperOptions(targetOrId) {
    const npc = typeof targetOrId === "string"
      ? this.scene.npcSystem?.npcs?.find(candidate => candidate.id === targetOrId)
      : targetOrId;
    if (!npc) return [];
    const context = this.whisperContextFor(npc);
    const distance = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, npc.x, npc.y);
    return COMMAND_ORDER.flatMap((command, index) => {
      const availability = whisperCommandAvailability(command, npc, context);
      if (!availability.available) return [];
      const evaluation = evaluateWhisperCommand(command, npc, {
        ...context,
        hunger: this.hunger(),
        givenIn: this.isGivenIn()
      });
      const config = whisperCommandConfig(command);
      const outcome = evaluation.succeeds ? "will obey" : "will resist";
      return [{
        id: `whisper_${command}_${npc.id}`,
        type: "whisper",
        command,
        label: config.label,
        detail: `${config.cost} Hunger · ${outcome} · resistance ${Number.isFinite(evaluation.resistance) ? evaluation.resistance.toFixed(1) : "immune"}`,
        priority: 200 - index,
        distance,
        x: npc.x,
        y: npc.y,
        target: npc,
        run: () => this.resolveWhisperCommand(npc, command)
      }];
    });
  }

  whisperContextFor(npc) {
    const records = this.scene.exposureSystem?.state?.records || {};
    const latentMemoryIds = unique(npc?.exposureEvidenceIds || []).filter(id => {
      const record = records[id];
      return record?.kind === "witness_memory"
        && record.knowledgeState === "latent"
        && !(record.resolvedAt > 0);
    });
    const openTarget = this.scene.whisperOpenContextFor?.(npc)
      || (this.scene.whisperContexts || []).find(context => {
        if (!context?.whisperOpen) return false;
        const x = finite(context.x, npc.x);
        const y = finite(context.y, npc.y);
        return Phaser.Math.Distance.Between(npc.x, npc.y, x, y) <= (context.radius || 44);
      })
      || null;
    const vehicle = this.nearestWhisperVehicle(npc);
    const heatLevel = this.scene.heatSystem?.level?.() || 0;
    const susceptible = Boolean(npc.whisperSusceptible || npc.compromised);
    const canCallOff = npc.type === NPC_TYPES.POLICE
      && !npc.chasingPlayer
      && !npc.enemyAttack
      && (susceptible || npc.whisperAuthority);
    return {
      latentMemoryIds,
      openTarget,
      vehicle,
      heatLevel,
      canCallOff,
      susceptible,
      contextResistance: 0
    };
  }

  resolveWhisperCommand(npc, command) {
    if (!npc || this.cooldowns.whisper > 0) return false;
    const context = this.whisperContextFor(npc);
    const evaluation = evaluateWhisperCommand(command, npc, {
      ...context,
      hunger: this.hunger(),
      givenIn: this.isGivenIn()
    });
    if (!evaluation.availability.available || !evaluation.config) {
      RawAudio.play("whisperFail");
      this.scene.lastActionText = `WHISPER · ${evaluation.availability.reason}`;
      return false;
    }

    const gained = this.addHunger(evaluation.config.cost, null);
    this.cooldowns.whisper = evaluation.succeeds
      ? PREDATOR_POWER_RULES.whisper.successCooldown
      : PREDATOR_POWER_RULES.whisper.failureCooldown;

    if (!evaluation.succeeds) {
      this.handleWhisperResistance(npc, command, evaluation, gained);
      return false;
    }

    RawAudio.play("whisper");
    resolveAction(this.scene, "whisper", {
      x: npc.x,
      y: npc.y,
      layer: npc.layer,
      target: npc,
      exclude: [npc]
    });
    const result = this.executeWhisperCommand(npc, command, context);
    const witnessed = this.recordWhisperWitnesses(npc, command);
    npc.lureFlash = Math.max(npc.lureFlash || 0, 1.1);
    this.scene.lastActionText = `WHISPER · ${whisperCommandLabel(command).toUpperCase()} · ${this.targetName(npc)} obeys. Hunger +${gained}.${witnessed ? ` ${witnessed} witness(es) saw the compulsion.` : ""}`;
    this.scene.events?.emit?.("whisper:command-resolved", {
      targetId: npc.id,
      command,
      hungerCost: gained,
      witnessed,
      result
    });
    return true;
  }

  executeWhisperCommand(npc, command, context) {
    const config = whisperCommandConfig(command);
    const duration = config?.duration || 0;

    if (command === WHISPER_COMMANDS.COME_HERE) {
      npc.alarmed = false;
      npc.reactionTimer = 0;
      npc.soundReactionTimer = 0;
      npc.luredTimer = duration;
      npc.whisperCommand = command;
      npc.whisperCommandTimer = duration;
      npc.lureStopDistance = npc.type === NPC_TYPES.TARGET ? 30 : 24;
      this.scene.aiStateSystem?.resolveNpc?.(npc);
      return { command, duration };
    }

    if (command === WHISPER_COMMANDS.WALK_AWAY) {
      const dx = npc.x - this.scene.player.x;
      const dy = npc.y - this.scene.player.y;
      const length = Math.hypot(dx, dy) || 1;
      npc.alarmed = false;
      npc.reactionTimer = 0;
      npc.soundReactionTimer = 0;
      npc.luredTimer = 0;
      npc.whisperCommand = command;
      npc.whisperCommandTimer = duration;
      npc.whisperTargetX = npc.x + (dx / length) * 180;
      npc.whisperTargetY = npc.y + (dy / length) * 180;
      this.scene.aiStateSystem?.resolveNpc?.(npc);
      return { command, duration, x: npc.whisperTargetX, y: npc.whisperTargetY };
    }

    if (command === WHISPER_COMMANDS.STAY_CALM) {
      this.clearImmediateWitnessIntent(npc, { preserveMemory: true });
      npc.whisperCommand = command;
      npc.whisperCommandTimer = duration;
      npc.whisperCalmTimer = duration;
      this.scene.aiStateSystem?.resolveNpc?.(npc);
      return { command, duration, memoryPreserved: true };
    }

    if (command === WHISPER_COMMANDS.FORGET_THIS) {
      const resolved = [];
      for (const id of context.latentMemoryIds || []) {
        const record = this.scene.exposureSystem?.resolveEvidence?.(id, {
          reason: "Whisper blurred the witness's unreported supernatural memory.",
          source: "whisper_forget",
          onlyLatent: true,
          persist: false
        });
        if (record) resolved.push(record.id);
      }
      if (resolved.length) this.scene.exposureSystem?.persist?.({ save: true });
      this.clearImmediateWitnessIntent(npc, { preserveMemory: false });
      npc.pendingHuntingAssessmentIds = [];
      return { command, resolvedMemoryIds: resolved };
    }

    if (command === WHISPER_COMMANDS.OPEN_IT) {
      const target = context.openTarget;
      let opened = false;
      if (typeof target?.run === "function") opened = target.run(npc) !== false;
      else if (typeof target?.open === "function") opened = target.open(npc) !== false;
      this.scene.events?.emit?.("whisper:open-requested", {
        targetId: npc.id,
        contextId: target?.id || null,
        opened
      });
      return { command, contextId: target?.id || null, opened };
    }

    if (command === WHISPER_COMMANDS.GET_IN) {
      const vehicle = context.vehicle;
      npc.alarmed = false;
      npc.reactionTimer = 0;
      npc.soundReactionTimer = 0;
      npc.whisperCommand = command;
      npc.whisperCommandTimer = duration;
      npc.whisperPassengerVehicleId = vehicle.id;
      npc.whisperPassengerBoarded = false;
      this.scene.aiStateSystem?.resolveNpc?.(npc);
      return { command, vehicleId: vehicle.id, duration };
    }

    if (command === WHISPER_COMMANDS.CALL_THEM_OFF) {
      const district = this.scene.heatSystem?.districtAt?.(npc.x, npc.y);
      const reduced = this.scene.heatSystem?.reduceInDistrict?.(
        district?.id,
        36,
        "A compelled officer downgrades the active response.",
        { source: "whisper_call_off" }
      ) || 0;
      const officers = this.scene.policeSystem?.allPolice?.()
        || this.scene.policeSystem?.police?.()
        || [];
      for (const officer of officers) {
        if (officer === npc || officer.dead || officer.inactive) continue;
        officer.chasingPlayer = false;
        officer.enemyAttack = null;
        officer.investigateTarget = null;
        if (officer.ai) {
          officer.ai.role = "search";
          officer.ai.intent = "stand-down";
        }
      }
      return { command, districtId: district?.id || null, reduced };
    }

    return { command };
  }

  handleWhisperResistance(npc, command, evaluation, hungerCost) {
    RawAudio.play("whisperFail");
    npc.lureFlash = Math.max(npc.lureFlash || 0, 1.25);
    const label = whisperCommandLabel(command);
    let evidenceId = null;

    if ([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) {
      this.scene.witnessSystem?.alarmWitness?.(npc, "an attempted vampiric command", 24, {
        masqueradeRisk: true,
        reactionSeconds: 0.45,
        source: this.scene.player,
        sourceEvent: "whisper_resisted"
      });
      evidenceId = this.registerPowerEvidence("resisted vampiric Whisper", [npc.id], "latent", 18)?.id || null;
      for (const memoryId of npc.exposureEvidenceIds || []) {
        if (evidenceId) this.scene.exposureSystem?.linkEvidence?.(memoryId, [evidenceId]);
      }
    } else if (npc.type === NPC_TYPES.POLICE) {
      npc.alarmed = true;
      npc.chasingPlayer = true;
      this.scene.policeSystem?.addHeat?.(npc.x, npc.y, 22, "Police recognise an attempted supernatural compulsion.", {
        source: "whisper_resisted_police"
      });
      evidenceId = this.registerPowerEvidence("resisted vampiric Whisper", [npc.id], "institutional", 22)?.id || null;
    } else if (npc.type === NPC_TYPES.THUG) {
      npc.alarmed = true;
      npc.thugHostile = true;
    } else if (npc.type === NPC_TYPES.HUNTER) {
      npc.alarmed = true;
      npc.hunterIntent = "hunt";
    }

    const nearby = this.scene.witnessSystem?.onSuspiciousPower?.(
      "an attempted vampiric command",
      22,
      PREDATOR_POWER_RULES.whisper.resistedRadius,
      {
        source: this.scene.player,
        exclude: [npc],
        sourceEvent: "whisper_resisted",
        exposureWeight: 16
      }
    ) || { witnesses: 0 };
    this.scene.lastActionText = `WHISPER RESISTED · ${this.targetName(npc)} rejects ${label}. Hunger +${hungerCost}.${nearby.witnesses ? ` ${nearby.witnesses} witness(es) react.` : ""}`;
    this.scene.events?.emit?.("whisper:resisted", {
      targetId: npc.id,
      command,
      power: evaluation.power,
      resistance: evaluation.resistance,
      threshold: evaluation.threshold,
      hungerCost,
      evidenceId,
      witnesses: nearby.witnesses || 0
    });
    this.scene.aiStateSystem?.resolveNpc?.(npc);
  }

  recordWhisperWitnesses(npc, command) {
    const profile = this.beastProfile();
    const hungerNoise = profile.state === "controlled" ? 0 : profile.state === "strained" ? 16 : profile.state === "ravenous" ? 34 : 52;
    const radius = PREDATOR_POWER_RULES.whisper.witnessedRadius + hungerNoise + (this.isGivenIn() ? 24 : 0);
    const result = this.scene.witnessSystem?.onSuspiciousPower?.(
      `a vampiric command: ${whisperCommandLabel(command)}`,
      14 + Math.round(hungerNoise / 8),
      radius,
      {
        source: this.scene.player,
        exclude: [npc],
        sourceEvent: `whisper:${command}`,
        exposureWeight: 10 + Math.round(hungerNoise / 5)
      }
    );
    return Number(result?.witnesses) || 0;
  }

  registerPowerEvidence(label, witnessIds = [], knowledgeState = "latent", exposureWeight = 12) {
    return this.scene.exposureSystem?.registerVisiblePowerUse?.({
      label,
      x: this.scene.player.x,
      y: this.scene.player.y,
      layer: this.scene.currentLayer,
      exposureWeight,
      knowledgeState,
      witnessIds
    }) || null;
  }

  clearImmediateWitnessIntent(npc, { preserveMemory = true } = {}) {
    npc.alarmed = false;
    npc.reportTarget = null;
    npc.reportSeverity = 0;
    npc.witnessReason = "";
    npc.witnessSource = null;
    npc.masqueradeRisk = false;
    npc.reactionTimer = 0;
    npc.soundReactionTimer = 0;
    // A completed report is institutional knowledge and cannot be undone here.
    npc.vx = 0;
    npc.vy = 0;
    if (!preserveMemory) npc.pendingHuntingAssessmentIds = [];
    if (npc.ai) {
      npc.ai.role = "none";
      npc.ai.intent = preserveMemory ? "calmed" : "memory-blurred";
    }
  }

  nearestWhisperTarget(radius = PREDATOR_POWER_RULES.whisper.baseRange) {
    const candidates = this.scene.npcSystem?.queryRadius?.(
      this.scene.player.x,
      this.scene.player.y,
      radius + 28,
      this.scene.currentLayer
    ) || this.scene.npcSystem?.npcs || [];
    const aim = this.scene.combatSystem?.aimDirection || this.lastDir || { x: 0, y: 1 };
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const npc of candidates) {
      if (!npc || !HUMAN_MIND_TYPES.has(npc.type)) continue;
      if (npc.dead || npc.inactive || npc.intercepted || npc.hiddenBody || npc.feedingUnconscious || npc.whisperPassengerBoarded) continue;
      if (npc.layer !== this.scene.currentLayer) continue;
      const dx = npc.x - this.scene.player.x;
      const dy = npc.y - this.scene.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const dot = distance > 0 ? (dx / distance) * aim.x + (dy / distance) * aim.y : 1;
      if (distance > 42 && dot < 0.05) continue;
      const typePenalty = npc.type === NPC_TYPES.HUNTER ? 30 : npc.type === NPC_TYPES.POLICE ? 8 : 0;
      const score = distance + (1 - dot) * 44 + typePenalty;
      if (score < bestScore) {
        best = npc;
        bestScore = score;
      }
    }
    return best;
  }

  nearestWhisperVehicle(npc, radius = 72) {
    if (!npc || this.scene.currentLayer !== LAYERS.STREET) return null;
    const vehicles = this.scene.vehicleSystem?.vehicles || [];
    return vehicles
      .filter(vehicle => Boolean(
        vehicle
        && !vehicle.disabled
        && vehicle.layer === LAYERS.STREET
        && vehicle.ownership !== "police"
        && vehicle.status !== "police"
        && Math.abs(finite(vehicle.speed)) <= 5
      ))
      .map(vehicle => ({
        vehicle,
        distance: Phaser.Math.Distance.Between(npc.x, npc.y, vehicle.x, vehicle.y)
      }))
      .filter(entry => entry.distance <= radius)
      .sort((left, right) => left.distance - right.distance || String(left.vehicle.id).localeCompare(String(right.vehicle.id)))[0]?.vehicle || null;
  }

  updateWhisperCommands(dt) {
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (npc.whisperCalmTimer > 0) npc.whisperCalmTimer = Math.max(0, npc.whisperCalmTimer - dt);
      if (!(npc.whisperCommandTimer > 0)) continue;
      npc.whisperCommandTimer = Math.max(0, npc.whisperCommandTimer - dt);

      if (npc.whisperPassengerVehicleId) {
        const vehicle = this.scene.vehicleSystem?.vehicle?.(npc.whisperPassengerVehicleId);
        if (!vehicle) {
          this.releasePassenger(npc, null);
          continue;
        }
        if (npc.whisperPassengerBoarded) {
          npc.x = vehicle.x;
          npc.y = vehicle.y;
          npc.vx = 0;
          npc.vy = 0;
        }
      }

      if (npc.whisperCommandTimer <= 0) {
        if (npc.whisperPassengerVehicleId) this.releasePassenger(npc, this.scene.vehicleSystem?.vehicle?.(npc.whisperPassengerVehicleId));
        npc.whisperCommand = null;
        npc.luredTimer = 0;
        npc.whisperTargetX = null;
        npc.whisperTargetY = null;
        this.scene.aiStateSystem?.resolveNpc?.(npc);
      }
    }
  }

  releasePassenger(npc, vehicle) {
    if (!npc) return;
    npc.whisperPassengerBoarded = false;
    npc.whisperPassengerVehicleId = null;
    const offsets = [[18, 0], [-18, 0], [0, 18], [0, -18]];
    const candidates = vehicle
      ? offsets.map(([x, y]) => ({ x: vehicle.x + x, y: vehicle.y + y }))
      : [];
    const point = candidates.find(candidate => this.scene.npcSystem?.canNpcStandAt?.(npc, candidate.x, candidate.y))
      || candidates[0]
      || null;
    if (point) {
      npc.x = point.x;
      npc.y = point.y;
    }
    npc.container?.setVisible?.(true);
  }

  giveIn() {
    if (this.beastTimer > 0 || this.cooldowns.beast > 0) {
      RawAudio.play("cancel");
      this.scene.lastActionText = this.beastTimer > 0
        ? "The Beast is already at the surface."
        : `GIVE IN recovering · ${this.cooldowns.beast.toFixed(1)}s.`;
      return false;
    }
    const rules = PREDATOR_POWER_RULES.giveIn;
    this.beastTimer = rules.seconds;
    this.cooldowns.beast = rules.cooldown;
    const hungerCost = this.addHunger(rules.cost, null);
    const now = this.scene.time?.now || 0;
    const damageState = this.scene.playerDamageSystem?.state;
    if (damageState) {
      damageState.hitStunUntil = Math.min(damageState.hitStunUntil || 0, now);
      damageState.invulnerableUntil = Math.max(damageState.invulnerableUntil || 0, now + 320);
    }
    RawAudio.play("dash", { cooldown: 0.05 });
    const witnesses = this.scene.witnessSystem?.onSuspiciousPower?.(
      "the vampire giving in to the Beast",
      rules.witnessSeverity,
      rules.witnessRadius,
      {
        source: this.scene.player,
        sourceEvent: "beast_given_in",
        exposureWeight: rules.evidenceWeight
      }
    ) || { witnesses: 0, evidenceId: null };
    this.scene.lastActionText = `GIVE IN · ${rules.seconds}s of speed, force and rapid feeding. Hunger +${hungerCost}.${witnesses.witnesses ? ` ${witnesses.witnesses} witness(es) saw the transformation.` : ""}`;
    this.scene.events?.emit?.("beast:given-in", {
      hunger: this.hunger(),
      hungerCost,
      duration: rules.seconds,
      cooldown: rules.cooldown,
      witnesses: witnesses.witnesses || 0,
      evidenceId: witnesses.evidenceId || null
    });
    return true;
  }

  useDash() {
    if (this.cooldowns.dash > 0) {
      RawAudio.play("dashFail");
      return false;
    }
    this.cooldowns.dash = HUNGER.dashCooldown;
    const maxDistance = HUNGER.dashDistance;
    const step = 6;
    let moved = 0;
    let nextX = this.scene.player.x;
    let nextY = this.scene.player.y;

    for (let d = step; d <= maxDistance; d += step) {
      const x = this.scene.player.x + this.lastDir.x * d;
      const y = this.scene.player.y + this.lastDir.y * d;
      if (!this.scene.canStandAt(x, y)) break;
      nextX = x;
      nextY = y;
      moved = d;
    }

    if (moved <= 0) {
      RawAudio.play("dashFail");
      this.scene.lastActionText = "Shadow Dash fails: no space to slip through.";
      return false;
    }

    this.scene.player.setPosition(nextX, nextY);
    RawAudio.play("dash");
    this.addHunger(HUNGER.dashCost, "Shadow Dash tears you across the dark");
    resolveAction(this.scene, "shadowDash", {
      x: nextX,
      y: nextY,
      layer: this.scene.currentLayer
    });
    return true;
  }

  drawSenseOverlay() {
    this.graphics.clear();
    this.hideSenseLabels();
    if (this.senseTimer <= 0) return;

    const time = this.scene.time?.now || 0;
    const pulse = (Math.sin(time / 105) + 1) * 0.5;
    const range = bloodSenseRangeForHunger(this.hunger());
    this.graphics.lineStyle(1, 0xa75cff, 0.28 + pulse * 0.12)
      .strokeCircle(this.scene.player.x, this.scene.player.y, 82 + pulse * 13);
    this.graphics.lineStyle(1, 0xe65b77, 0.12)
      .strokeCircle(this.scene.player.x, this.scene.player.y, Math.min(range, 180));

    this.lastSenseReadings = this.bloodSenseReadings();
    const view = this.scene.cameras?.main?.worldView;
    for (const reading of this.lastSenseReadings) {
      if (view && !this.pointNearView(reading.x, reading.y, view, 8)) {
        this.drawSenseEdgeIndicator(reading, view, pulse);
      } else {
        this.drawSenseReading(reading, pulse);
      }
    }
  }

  drawSenseReading(reading, pulse) {
    const color = reading.color;
    const radius = 8 + Math.min(12, reading.intensity * 7) + pulse * 3;
    if (reading.heartbeat) {
      this.graphics.lineStyle(2, color, Math.min(0.95, 0.42 + reading.intensity * 0.35))
        .strokeCircle(reading.x, reading.y, radius);
      this.graphics.lineStyle(1, color, 0.24 + pulse * 0.18)
        .strokeCircle(reading.x, reading.y, radius + 5 + pulse * 4);
    } else if (reading.kind === "silent") {
      this.graphics.lineStyle(2, color, 0.88).strokeCircle(reading.x, reading.y, radius + 2);
      this.graphics.beginPath();
      this.graphics.moveTo(reading.x - radius * 0.6, reading.y - radius * 0.6);
      this.graphics.lineTo(reading.x + radius * 0.6, reading.y + radius * 0.6);
      this.graphics.moveTo(reading.x + radius * 0.6, reading.y - radius * 0.6);
      this.graphics.lineTo(reading.x - radius * 0.6, reading.y + radius * 0.6);
      this.graphics.strokePath();
    } else {
      this.graphics.lineStyle(2, color, 0.72).strokeCircle(reading.x, reading.y, radius);
      this.graphics.fillStyle(color, 0.08 + pulse * 0.05).fillCircle(reading.x, reading.y, radius);
    }
    if (reading.behindCover) {
      this.graphics.lineStyle(1, color, 0.22);
      this.graphics.beginPath();
      this.graphics.moveTo(this.scene.player.x, this.scene.player.y);
      this.graphics.lineTo(reading.x, reading.y);
      this.graphics.strokePath();
    }
    const label = `${reading.label}${reading.protectionKnown ? " · PROTECTED" : ""}`;
    this.showSenseLabel(reading.id, label, reading.x + radius + 3, reading.y - radius, color);
  }

  drawSenseEdgeIndicator(reading, view, pulse) {
    const margin = 24;
    const cx = view.x + view.width / 2;
    const cy = view.y + view.height / 2;
    const dx = reading.x - cx;
    const dy = reading.y - cy;
    const scale = Math.min(
      Math.abs(dx) > 0.001 ? (view.width / 2 - margin) / Math.abs(dx) : Number.POSITIVE_INFINITY,
      Math.abs(dy) > 0.001 ? (view.height / 2 - margin) / Math.abs(dy) : Number.POSITIVE_INFINITY
    );
    const x = cx + dx * scale;
    const y = cy + dy * scale;
    const angle = Math.atan2(dy, dx);
    const size = 8 + pulse * 2;
    this.graphics.fillStyle(reading.color, 0.72);
    this.graphics.fillTriangle(
      x + Math.cos(angle) * size,
      y + Math.sin(angle) * size,
      x + Math.cos(angle + 2.35) * size,
      y + Math.sin(angle + 2.35) * size,
      x + Math.cos(angle - 2.35) * size,
      y + Math.sin(angle - 2.35) * size
    );
    this.showSenseLabel(`edge:${reading.id}`, reading.label, x + 8, y - 8, reading.color);
  }

  pointNearView(x, y, view, margin = 0) {
    return x >= view.x - margin
      && x <= view.x + view.width + margin
      && y >= view.y - margin
      && y <= view.y + view.height + margin;
  }

  showSenseLabel(id, text, x, y, color) {
    let label = this.senseLabels.get(id);
    if (!label) {
      label = this.scene.add.text(x, y, text, {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        color: `#${color.toString(16).padStart(6, "0")}`,
        backgroundColor: "rgba(5, 6, 11, .70)",
        padding: { x: 3, y: 1 }
      }).setDepth(74);
      label.setResolution?.(3);
      label.setStroke?.("#05060b", 2);
      this.senseLabels.set(id, label);
    }
    label.setText(text).setPosition(x, y).setColor?.(`#${color.toString(16).padStart(6, "0")}`).setVisible(true);
  }

  hideSenseLabels() {
    for (const label of this.senseLabels.values()) label.setVisible(false);
  }

  drawWhisperLines() {
    for (const npc of this.scene.npcSystem?.visibleInCamera?.(40) || this.scene.npcSystem?.npcs || []) {
      if (npc.layer !== this.scene.currentLayer || npc.dead || npc.hiddenBody) continue;
      if (!(npc.luredTimer > 0 || npc.whisperCommandTimer > 0)) continue;
      const pulse = 0.28 + Math.sin((this.scene.time?.now || 0) / 70) * 0.10;
      this.graphics.lineStyle(2, 0xff4bd8, 0.42 + pulse);
      this.graphics.beginPath();
      this.graphics.moveTo(npc.x, npc.y);
      const targetX = npc.whisperCommand === WHISPER_COMMANDS.WALK_AWAY ? npc.whisperTargetX : this.scene.player.x;
      const targetY = npc.whisperCommand === WHISPER_COMMANDS.WALK_AWAY ? npc.whisperTargetY : this.scene.player.y;
      this.graphics.lineTo(finite(targetX, npc.x), finite(targetY, npc.y));
      this.graphics.strokePath();
      this.graphics.fillStyle(0xff4bd8, 0.12 + pulse * 0.28).fillCircle(npc.x, npc.y, 14 + pulse * 6);
    }
  }

  drawBeastAura() {
    if (!this.isGivenIn()) return;
    const pulse = (Math.sin((this.scene.time?.now || 0) / 55) + 1) * 0.5;
    this.graphics.lineStyle(3, 0xff334f, 0.48 + pulse * 0.32)
      .strokeCircle(this.scene.player.x, this.scene.player.y, 18 + pulse * 7);
    this.graphics.lineStyle(1, 0xa75cff, 0.35 + pulse * 0.25)
      .strokeCircle(this.scene.player.x, this.scene.player.y, 27 + pulse * 9);
  }

  targetName(npc) {
    if (!npc) return "target";
    if (npc.type === NPC_TYPES.TARGET) return "journalist";
    if (npc.type === NPC_TYPES.POLICE) return "police officer";
    if (npc.type === NPC_TYPES.HUNTER) return "hunter";
    if (npc.type === NPC_TYPES.THUG) return "thug";
    return "civilian";
  }

  snapshot() {
    return {
      hunger: this.hunger(),
      beast: {
        ...this.modifiers(),
        activeSeconds: this.beastTimer,
        cooldownSeconds: this.cooldowns.beast
      },
      cooldowns: { ...this.cooldowns },
      senseSeconds: this.senseTimer,
      senseRange: bloodSenseRangeForHunger(this.hunger()),
      readings: this.lastSenseReadings.map(reading => ({
        id: reading.id,
        kind: reading.kind,
        label: reading.label,
        distance: reading.distance,
        protectionKnown: reading.protectionKnown,
        behindCover: reading.behindCover
      }))
    };
  }

  installDiagnostics() {
    const root = typeof window !== "undefined" ? window : globalThis;
    const api = {
      snapshot: () => this.snapshot(),
      bloodSenseReadings: () => this.bloodSenseReadings(),
      whisperOptions: targetId => this.whisperOptions(targetId).map(option => ({
        id: option.id,
        command: option.command,
        label: option.label,
        detail: option.detail
      })),
      command: (targetId, command) => {
        const target = this.scene.npcSystem?.npcs?.find(candidate => candidate.id === String(targetId || ""));
        return this.resolveWhisperCommand(target, command);
      },
      giveIn: () => this.giveIn()
    };
    root.NBD_PREDATOR_POWERS = api;
    this.diagnosticRoot = root;
    this.diagnosticApi = api;
  }

  summary() {
    const ready = value => value <= 0 ? "ready" : value.toFixed(1);
    const beastValue = this.beastTimer > 0 ? this.beastTimer : this.cooldowns.beast;
    const profile = this.beastProfile();
    const senseActive = this.senseTimer > 0 ? ` · SenseActive ${this.senseTimer.toFixed(1)}` : "";
    const beastActive = this.beastTimer > 0 ? ` · GiveIn ${this.beastTimer.toFixed(1)}` : "";
    return `Dash ${ready(this.cooldowns.dash)} · Whisper ${ready(this.cooldowns.whisper)} · Sense ${ready(this.cooldowns.sense)} · Beast ${ready(beastValue)} · BeastState ${profile.label}${senseActive}${beastActive}`;
  }

  destroy() {
    this.graphics?.destroy?.();
    for (const label of this.senseLabels.values()) label.destroy?.();
    this.senseLabels.clear();
    if (this.diagnosticRoot?.NBD_PREDATOR_POWERS === this.diagnosticApi) delete this.diagnosticRoot.NBD_PREDATOR_POWERS;
  }
}
