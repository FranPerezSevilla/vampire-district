import {
  DEATH_BEAT,
  DEATH_SEQUENCE_PHASES,
  HOSPITAL_RECOVERY,
  advanceDeathSequence,
  createDeathSequenceState,
  deathDialogueAlpha,
  deathFadeAlpha,
  startDeathSequence
} from "../data/death-recovery.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { VEHICLE_OWNERSHIP } from "../data/vehicles.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

function copyPayload(payload = {}) {
  return JSON.parse(JSON.stringify(payload || {}));
}

function setPosition(entity, x, y) {
  entity?.setPosition?.(x, y);
  if (entity && !entity.setPosition) {
    entity.x = x;
    entity.y = y;
  }
}

export class DeathRecoverySystem {
  constructor(scene) {
    this.scene = scene;
    this.state = createDeathSequenceState();
    this.deathPayload = null;
    this.audioFadeStarted = false;
    this.fadeCompleteEmitted = false;
    this.recovered = false;
    this.recoveryBagCollected = false;
    this.lackey = null;
    this.bagContainer = null;
    this.recoveryVehicleId = HOSPITAL_RECOVERY.replacementVehicleId;
    this.audioSnapshot = null;

    this.backdrop = scene.add.rectangle(0, 0, 1, 1, 0x000000, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(980)
      .setAlpha(0)
      .setVisible(false);
    this.panel = scene.add.rectangle(0, 0, 330, 92, 0x09080d, 0.94)
      .setScrollFactor(0)
      .setDepth(981)
      .setStrokeStyle(1, 0x8a1735, 0.85)
      .setVisible(false);
    this.speakerLabel = scene.add.text(0, 0, "MASTER", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#d77a91",
      letterSpacing: 2
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(982).setVisible(false);
    this.dialogueLabel = scene.add.text(0, 0, "Pathetic.", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "24px",
      fontStyle: "italic",
      color: "#f4e9ec"
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(982).setVisible(false);
    this.dialogueLabel.setResolution?.(3);
    this.dialogueLabel.setStroke?.("#05060b", 2);

    this.handlePlayerDeath = payload => this.start(payload);
    scene.events?.on?.("player:died", this.handlePlayerDeath);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.deathRecoverySystem = this;
  }

  start(payload = {}) {
    if (!startDeathSequence(this.state)) return false;
    this.deathPayload = copyPayload(payload);
    this.audioFadeStarted = false;
    this.fadeCompleteEmitted = false;
    this.recovered = false;
    this.audioSnapshot = {
      master: Number(RawAudio.master?.gain?.value),
      narrative: Number(RawAudio.narrativeMaster?.gain?.value)
    };

    if (this.scene.interactionSystem?.isOpen) {
      this.scene.interactionSystem.close("Death interrupts the interaction.");
    }
    if (this.scene.feedingSystem?.isActive?.()) {
      this.scene.feedingSystem.cancel("Death breaks the feeding channel.");
    }
    if (this.scene.combatSystem?.attack) this.scene.combatSystem.attack = null;
    this.scene.playerDamageSystem?.cancelAllEnemyAttacks?.();

    RawAudio.stopSampleLoop?.("drainLoop");
    RawAudio.stopSampleLoop?.("vehicleSkidLoop");
    RawAudio.stopAllVehicleEngines?.();

    this.scene.registry?.set?.("deathSequenceActive", true);
    this.scene.statePublisher?.setMany?.({
      deathSequenceActive: true,
      deathSequencePhase: this.state.phase,
      deathSequenceText: "MASTER · Pathetic."
    });
    this.scene.events?.emit?.("death:sequence-started", {
      ...this.deathPayload,
      phase: this.state.phase
    });
    this.syncPresentation();
    return true;
  }

  update(dt) {
    if (!this.isActive()) return;
    const before = this.state.phase;
    const result = advanceDeathSequence(this.state, Math.max(0, Number(dt) || 0) * 1000);

    if (before !== DEATH_SEQUENCE_PHASES.FADE && this.state.phase === DEATH_SEQUENCE_PHASES.FADE) {
      this.beginAudioFade();
    }
    this.syncPresentation();

    this.scene.statePublisher?.setMany?.({
      deathSequenceActive: true,
      deathSequencePhase: this.state.phase,
      deathSequenceText: this.state.phase === DEATH_SEQUENCE_PHASES.BLACK
        ? "Death sequence · black"
        : "MASTER · Pathetic."
    });

    if (result.fadeCompleted && !this.fadeCompleteEmitted) {
      this.fadeCompleteEmitted = true;
      this.scene.events?.emit?.("death:fade-complete", {
        ...this.deathPayload,
        phase: this.state.phase
      });
      this.completeHospitalRecovery();
    }
  }

  beginAudioFade() {
    if (this.audioFadeStarted) return false;
    this.audioFadeStarted = true;
    const ctx = RawAudio.ctx;
    const buses = [RawAudio.master, RawAudio.narrativeMaster].filter(Boolean);
    if (!ctx || !buses.length) return false;
    const now = ctx.currentTime;
    const end = now + DEATH_BEAT.fadeMs / 1000;
    for (const bus of buses) {
      try {
        const current = Math.max(0.0001, Number(bus.gain.value) || 0.0001);
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(current, now);
        bus.gain.linearRampToValueAtTime(0.0001, end);
      } catch {
        try { bus.gain.value = 0.0001; } catch {}
      }
    }
    return true;
  }

  restoreAudio() {
    const ctx = RawAudio.ctx;
    if (!ctx) return false;
    const targets = [
      [RawAudio.master, this.audioSnapshot?.master],
      [RawAudio.narrativeMaster, this.audioSnapshot?.narrative]
    ];
    for (const [bus, snapshot] of targets) {
      if (!bus?.gain) continue;
      const target = Number.isFinite(snapshot) && snapshot > 0 ? snapshot : 1;
      try {
        const now = ctx.currentTime;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(Math.max(0.0001, Number(bus.gain.value) || 0.0001), now);
        bus.gain.linearRampToValueAtTime(target, now + 0.35);
      } catch {
        try { bus.gain.value = target; } catch {}
      }
    }
    return true;
  }

  choosePlayerSpawn() {
    return HOSPITAL_RECOVERY.playerCandidates.find(point => this.scene.canStandAt?.(point.x, point.y) !== false)
      || HOSPITAL_RECOVERY.playerCandidates[0];
  }

  resetTransientNpcAlarmState() {
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!npc || npc.dead || npc.inactive) continue;
      npc.enemyAttack = null;
      npc.chasingPlayer = false;
      npc.alarmed = false;
      npc.investigateTarget = null;
      npc.reportTarget = null;
      npc.reportSeverity = 0;
      npc.witnessReason = "";
      npc.reactionTimer = 0;
      npc.soundReactionTimer = 0;
    }
  }

  clearTransientCombat() {
    if (this.scene.combatSystem) {
      this.scene.combatSystem.attack = null;
      this.scene.combatSystem.projectiles?.splice?.(0);
      this.scene.combatSystem.impactEffects?.splice?.(0);
    }
    if (this.scene.policeFirearmSystem) {
      this.scene.policeFirearmSystem.projectiles?.splice?.(0);
      this.scene.policeFirearmSystem.impactEffects?.splice?.(0);
    }
    this.scene.playerDamageSystem?.cancelAllEnemyAttacks?.();
  }

  placeLackey(spawn) {
    const existing = (this.scene.npcSystem?.npcs || []).find(npc => npc.id === HOSPITAL_RECOVERY.lackeyId);
    const x = spawn.x + 25;
    const y = spawn.y - 18;
    if (existing) {
      existing.inactive = false;
      existing.active = true;
      existing.dead = false;
      existing.missionInformant = true;
      existing.x = x;
      existing.y = y;
      existing.container?.setPosition?.(x, y).setVisible?.(true);
      this.lackey = existing;
      return existing;
    }
    if (!this.scene.npcSystem?.createNpc) return null;
    const lackey = this.scene.npcSystem.createNpc({
      id: HOSPITAL_RECOVERY.lackeyId,
      type: NPC_TYPES.CIVILIAN,
      x,
      y,
      layer: LAYERS.STREET,
      behavior: "guard",
      speed: 0,
      dirX: -1,
      dirY: 0
    });
    lackey.missionInformant = true;
    lackey.recoveryLackey = true;
    const label = this.scene.add.text(8, -14, "LACKEY", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#d6a8b5",
      backgroundColor: "rgba(0,0,0,.55)",
      padding: { x: 2, y: 1 }
    });
    lackey.container?.add?.(label);
    this.scene.npcSystem.npcs.push(lackey);
    this.scene.entityStreamSystem?.applyNpcState?.(lackey, 0);
    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.lackey = lackey;
    return lackey;
  }

  placeBloodBag(spawn) {
    if (!this.bagContainer) {
      this.bagContainer = this.scene.add.container(spawn.x - 22, spawn.y + 18).setDepth(44);
      const shadow = this.scene.add.ellipse(0, 5, 13, 5, 0x000000, 0.35);
      const bag = this.scene.add.rectangle(0, 0, 9, 13, 0x8f1838, 1).setStrokeStyle(1, 0xe69aaa, 0.9);
      const label = this.scene.add.text(8, -12, "BLOOD", {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#f1bdc8",
        backgroundColor: "rgba(0,0,0,.55)",
        padding: { x: 2, y: 1 }
      });
      this.bagContainer.add([shadow, bag, label]);
    } else {
      this.bagContainer.setPosition(spawn.x - 22, spawn.y + 18).setActive(true).setVisible(true);
    }
    this.recoveryBagCollected = false;
  }

  placeReplacementVehicle() {
    const system = this.scene.vehicleSystem;
    if (!system?.addTransientVehicle) return null;
    const existing = system.vehicle?.(this.recoveryVehicleId);
    if (existing?.transient) system.removeTransientVehicle?.(existing.id);
    const point = HOSPITAL_RECOVERY.vehicleCandidates[0];
    return system.addTransientVehicle({
      id: this.recoveryVehicleId,
      name: "Recovery compact",
      archetypeId: "compact",
      x: point.x,
      y: point.y,
      angle: point.angle,
      layer: LAYERS.STREET,
      ownership: VEHICLE_OWNERSHIP.OWNED,
      status: VEHICLE_OWNERSHIP.OWNED,
      ownerId: "player",
      parked: true
    });
  }

  completeHospitalRecovery() {
    if (this.recovered || !this.isBlack()) return false;
    this.recovered = true;
    const spawn = this.choosePlayerSpawn();

    this.scene.heatSystem?.clear?.("Death clears the active police response.");
    const graceUntil = this.scene.policeSystem?.resetAfterPlayerDeath?.(HOSPITAL_RECOVERY.policeGraceMs)
      || ((Number(this.scene.time?.now) || 0) + HOSPITAL_RECOVERY.policeGraceMs);
    this.scene.registry?.set?.("policeReacquisitionGraceUntil", graceUntil);
    this.scene.motorizedPoliceSystem?.clearUnits?.();
    this.scene.motorizedPoliceSystem?.publish?.(true);
    this.resetTransientNpcAlarmState();
    this.clearTransientCombat();

    if (this.scene.vehicleSystem?.isDriving?.()) this.scene.vehicleSystem.exitVehicle?.({ force: true });
    this.scene.currentLayer = LAYERS.STREET;
    this.scene.cityStreamSystem?.updateFocus?.(spawn.x, spawn.y, { force: true });
    this.scene.player?.setActive?.(true).setVisible?.(true);
    setPosition(this.scene.player, spawn.x, spawn.y);
    if (this.scene.player?.body) {
      this.scene.player.body.enable = true;
      this.scene.player.body.setEnable?.(true);
      this.scene.player.body.setVelocity?.(0, 0);
    }
    this.scene.playerDamageSystem?.revive?.({ vitality: HOSPITAL_RECOVERY.reviveVitality });
    this.scene.cameras?.main?.startFollow?.(this.scene.player, true, 0.12, 0.12);

    this.placeLackey(spawn);
    this.placeBloodBag(spawn);
    this.placeReplacementVehicle();
    this.restoreAudio();

    this.state = createDeathSequenceState();
    this.syncPresentation();
    this.scene.registry?.set?.("deathSequenceActive", false);
    this.scene.statePublisher?.setMany?.({
      deathSequenceActive: false,
      deathSequencePhase: DEATH_SEQUENCE_PHASES.IDLE,
      deathSequenceText: "Hospital recovery",
      hospitalRecoveryActive: true,
      policeReacquisitionGraceUntil: graceUntil
    });
    this.scene.lastActionText = `LACKEY: ${HOSPITAL_RECOVERY.lackeyLine}`;
    this.scene.events?.emit?.("death:hospital-recovered", {
      x: spawn.x,
      y: spawn.y,
      vitality: HOSPITAL_RECOVERY.reviveVitality,
      graceUntil,
      vehicleId: this.recoveryVehicleId,
      bloodBagAvailable: true
    });
    return true;
  }

  collectInteractions() {
    if (!this.recovered || this.recoveryBagCollected || !this.bagContainer?.visible) return [];
    const player = this.scene.player;
    if (!player) return [];
    const distance = Math.hypot(player.x - this.bagContainer.x, player.y - this.bagContainer.y);
    if (distance > HOSPITAL_RECOVERY.interactionRadius) return [];
    return [{
      id: "hospital_recovery_blood_bag",
      type: "recovery",
      label: "Drink blood bag",
      detail: "ENTER · partial Hunger relief and Vitality recovery",
      priority: 270,
      distance,
      x: this.bagContainer.x,
      y: this.bagContainer.y,
      target: this.bagContainer,
      run: () => this.consumeBloodBag()
    }];
  }

  consumeBloodBag() {
    if (this.recoveryBagCollected) return false;
    const hunger = this.scene.feedingSystem?.relieveHunger?.(
      HOSPITAL_RECOVERY.bloodBagHungerRelief,
      "hospital-blood-bag"
    );
    const vitality = this.scene.playerDamageSystem?.restoreVitality?.(
      HOSPITAL_RECOVERY.bloodBagVitality,
      "hospital-blood-bag"
    ) || 0;
    this.recoveryBagCollected = true;
    this.bagContainer?.setActive?.(false).setVisible?.(false);
    this.scene.lastActionText = `Blood bag consumed · Hunger -${Math.round(hunger?.relief || 0)} · Vitality +${Math.round(vitality)}.`;
    this.scene.statePublisher?.setMany?.({ hospitalRecoveryActive: false, hospitalBloodBagAvailable: false });
    this.scene.events?.emit?.("death:blood-bag-consumed", {
      hungerRelief: hunger?.relief || 0,
      vitalityRestored: vitality
    });
    return true;
  }

  syncPresentation() {
    const width = Math.max(1, Number(this.scene.scale?.width) || Number(this.scene.cameras?.main?.width) || 960);
    const height = Math.max(1, Number(this.scene.scale?.height) || Number(this.scene.cameras?.main?.height) || 540);
    const centerX = width / 2;
    const centerY = height / 2;
    const overlayAlpha = deathFadeAlpha(this.state);
    const dialogueAlpha = deathDialogueAlpha(this.state);
    const show = this.state.phase !== DEATH_SEQUENCE_PHASES.IDLE;

    this.backdrop
      .setPosition(0, 0)
      .setSize(width, height)
      .setDisplaySize(width, height)
      .setAlpha(overlayAlpha)
      .setVisible(show);

    const dialogueVisible = dialogueAlpha > 0.001;
    this.panel.setPosition(centerX, centerY).setAlpha(dialogueAlpha).setVisible(dialogueVisible);
    this.speakerLabel.setPosition(centerX, centerY - 23).setAlpha(dialogueAlpha).setVisible(dialogueVisible);
    this.dialogueLabel.setPosition(centerX, centerY + 13).setAlpha(dialogueAlpha).setVisible(dialogueVisible);
  }

  isActive() {
    return this.state.phase !== DEATH_SEQUENCE_PHASES.IDLE;
  }

  isBlack() {
    return this.state.phase === DEATH_SEQUENCE_PHASES.BLACK;
  }

  destroy() {
    this.scene.events?.off?.("player:died", this.handlePlayerDeath);
    if (this.scene.deathRecoverySystem === this) this.scene.deathRecoverySystem = null;
    this.backdrop?.destroy?.();
    this.panel?.destroy?.();
    this.speakerLabel?.destroy?.();
    this.dialogueLabel?.destroy?.();
    this.bagContainer?.destroy?.();
  }
}
