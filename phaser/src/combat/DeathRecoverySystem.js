import {
  DEATH_BEAT,
  DEATH_SEQUENCE_PHASES,
  HOSPITAL_RECOVERY,
  advanceDeathSequence,
  createDeathSequenceState,
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
    this.audioAttenuationStarted = false;
    this.audioSilenceStarted = false;
    this.fadeCompleteEmitted = false;
    this.recovered = false;
    this.recoveryBagCollected = false;
    this.lackey = null;
    this.bagContainer = null;
    this.recoveryVehicleId = HOSPITAL_RECOVERY.replacementVehicleId;
    this.audioSnapshot = null;
    this.masterPresentationComplete = false;
    this.masterPresentationPromise = null;
    this.cameraZoomSnapshot = null;
    this.deathBlackoutAlpha = 0;
    this.deathDomBackdrop = null;
    this.hospitalRecoveryIntroComplete = false;
    this.recoveryPresentationPromise = null;

    this.backdrop = scene.add.rectangle(0, 0, 1, 1, 0x000000, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(980)
      .setAlpha(0)
      .setVisible(false);
    this.ensureDeathDomBackdrop();

    this.handlePlayerDeath = payload => this.start(payload);
    scene.events?.on?.("player:died", this.handlePlayerDeath);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.deathRecoverySystem = this;
  }

  ensureDeathDomBackdrop() {
    if (typeof document === "undefined") return null;
    if (this.deathDomBackdrop?.isConnected) return this.deathDomBackdrop;
    const host = document.getElementById("game-ui") || document.querySelector(".game-frame");
    if (!host) return null;
    let backdrop = document.getElementById("death-blackout-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "death-blackout-backdrop";
      Object.assign(backdrop.style, {
        position: "absolute",
        inset: "0",
        background: "#000",
        opacity: "0",
        pointerEvents: "none",
        zIndex: "9998"
      });
      host.appendChild(backdrop);
    }
    this.deathDomBackdrop = backdrop;
    return backdrop;
  }

  setSireDialogueAboveBlackout(active) {
    const dialogue = this.scene.tutorialDirector?.ui?.dialogue;
    if (!dialogue?.style) return false;
    if (active) dialogue.style.zIndex = "9999";
    else dialogue.style.removeProperty?.("z-index");
    return true;
  }

  start(payload = {}) {
    if (!startDeathSequence(this.state)) return false;
    this.deathPayload = copyPayload(payload);
    this.audioAttenuationStarted = false;
    this.audioSilenceStarted = false;
    this.fadeCompleteEmitted = false;
    this.recovered = false;
    this.hospitalRecoveryIntroComplete = false;
    this.recoveryPresentationPromise = null;
    this.masterPresentationComplete = false;
    this.masterPresentationPromise = null;
    this.cameraZoomSnapshot = Number(this.scene.cameras?.main?.zoom) || null;
    this.deathBlackoutAlpha = 0;
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

    this.scene.registry?.set?.("deathSequenceActive", true);
    this.scene.statePublisher?.setMany?.({
      deathSequenceActive: true,
      deathSequencePhase: this.state.phase,
      deathSequenceText: "Death sequence · sound falling"
    });
    this.scene.events?.emit?.("death:sequence-started", {
      ...this.deathPayload,
      phase: this.state.phase
    });
    this.syncPresentation();
    this.masterPresentationPromise = this.runMasterDeathBeat();
    return true;
  }

  update(dt) {
    if (!this.isActive()) return;
    if (this.state.phase === DEATH_SEQUENCE_PHASES.MASTER && !this.masterPresentationComplete) {
      this.syncPresentation();
      this.scene.statePublisher?.setMany?.({
        deathSequenceActive: true,
        deathSequencePhase: this.state.phase,
        deathSequenceText: this.deathBlackoutAlpha >= 0.999
          ? "Death sequence · sire"
          : "Death sequence · blackout"
      });
      return;
    }
    if (this.state.phase === DEATH_SEQUENCE_PHASES.MASTER) {
      this.state.elapsedMs = DEATH_BEAT.masterHoldMs;
    }
    const result = advanceDeathSequence(this.state, Math.max(0, Number(dt) || 0) * 1000);
    this.syncPresentation();

    this.scene.statePublisher?.setMany?.({
      deathSequenceActive: true,
      deathSequencePhase: this.state.phase,
      deathSequenceText: this.state.phase === DEATH_SEQUENCE_PHASES.BLACK
        ? "Death sequence · black"
        : "Death sequence · resolving"
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

  waitForPresentation(ms) {
    const duration = Math.max(0, Number(ms) || 0);
    if (!duration) return Promise.resolve();
    return new Promise(resolve => {
      if (this.scene.time?.delayedCall) {
        this.scene.time.delayedCall(duration, resolve);
        return;
      }
      globalThis.setTimeout?.(resolve, duration);
    });
  }

  stopTransientWorldAudio() {
    RawAudio.stopSampleLoop?.("drainLoop");
    RawAudio.stopSampleLoop?.("vehicleSkidLoop");
    RawAudio.stopAllVehicleEngines?.();
  }

  beginWorldAudioAttenuation() {
    if (this.audioAttenuationStarted) return false;
    this.audioAttenuationStarted = true;
    const ctx = RawAudio.ctx;
    const bus = RawAudio.master;
    if (!ctx || !bus?.gain) return false;
    const now = ctx.currentTime;
    const end = now + DEATH_BEAT.audioAttenuateMs / 1000;
    try {
      const current = Math.max(0.0001, Number(bus.gain.value) || 0.0001);
      const target = Math.max(0.0001, current * DEATH_BEAT.audioAttenuatedFactor);
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(current, now);
      bus.gain.linearRampToValueAtTime(target, end);
    } catch {
      try { bus.gain.value = Math.max(0.0001, (Number(bus.gain.value) || 0.0001) * DEATH_BEAT.audioAttenuatedFactor); } catch {}
    }
    return true;
  }

  beginWorldAudioSilence() {
    if (this.audioSilenceStarted) return false;
    this.audioSilenceStarted = true;
    const ctx = RawAudio.ctx;
    const bus = RawAudio.master;
    if (!ctx || !bus?.gain) return false;
    const now = ctx.currentTime;
    const end = now + DEATH_BEAT.blackoutFadeMs / 1000;
    try {
      const current = Math.max(0.0001, Number(bus.gain.value) || 0.0001);
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(current, now);
      bus.gain.linearRampToValueAtTime(0.0001, end);
    } catch {
      try { bus.gain.value = 0.0001; } catch {}
    }
    return true;
  }

  fadeWorldToBlack() {
    const duration = Math.max(1, Number(DEATH_BEAT.blackoutFadeMs) || 1);
    if (!this.scene.tweens?.addCounter) {
      return this.waitForPresentation(duration).then(() => {
        this.deathBlackoutAlpha = 1;
        this.syncPresentation();
      });
    }
    return new Promise(resolve => {
      this.scene.tweens.addCounter({
        from: Math.max(0, Math.min(1, this.deathBlackoutAlpha)),
        to: 1,
        duration,
        ease: "Sine.easeInOut",
        onUpdate: tween => {
          this.deathBlackoutAlpha = Math.max(0, Math.min(1, Number(tween.getValue?.()) || 0));
        },
        onComplete: () => {
          this.deathBlackoutAlpha = 1;
          this.syncPresentation();
          resolve();
        }
      });
    });
  }

  async runMasterDeathBeat() {
    const director = this.scene.tutorialDirector;
    try {
      director?.setTip?.("", "");
      director?.hideDialogue?.();
      this.beginWorldAudioAttenuation();
      const cameraTask = director?.zoomToPlayer
        ? Promise.resolve(director.zoomToPlayer()).catch(error => console.error("Death camera close failed", error))
        : Promise.resolve();

      await this.waitForPresentation(DEATH_BEAT.audioAttenuateMs);
      this.stopTransientWorldAudio();
      this.beginWorldAudioSilence();
      await this.fadeWorldToBlack();
      await cameraTask;

      this.setSireDialogueAboveBlackout(true);
      if (director?.showDialogue) {
        await director.showDialogue({
          speaker: DEATH_BEAT.masterSpeaker,
          text: DEATH_BEAT.masterLine,
          kind: "thought",
          target: this.scene.player
        });
      } else {
        this.scene.lastActionText = `${DEATH_BEAT.masterSpeaker}: ${DEATH_BEAT.masterLine}`;
        await this.waitForPresentation(DEATH_BEAT.fallbackDialogueMs);
      }
      return true;
    } catch (error) {
      console.error("Death sire dialogue failed", error);
      return false;
    } finally {
      director?.hideDialogue?.();
      this.setSireDialogueAboveBlackout(false);
      this.masterPresentationComplete = true;
    }
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
      existing.container?.setPosition?.(x, y).setAlpha?.(1).setVisible?.(true);
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

  lockRecoveryControls() {
    const director = this.scene.tutorialDirector;
    director?.setTip?.("", "");
    director?.hideDialogue?.();
    director?.setControlMode?.("locked");
    if (director?.freezeWorld) {
      director.freezeWorld(true);
    } else {
      this.scene.taskRevealCinematic ||= { active: false, queued: null, initialPlayed: true };
      this.scene.taskRevealCinematic.active = true;
      this.scene.registry?.set?.("taskRevealActive", true);
    }
    this.scene.inputSystem?.setControlMode?.("locked");
    this.scene.inputSystem?.resetWorldEdges?.();
  }

  releaseRecoveryControls() {
    const director = this.scene.tutorialDirector;
    director?.hideDialogue?.();
    director?.freezeWorld?.(false);
    director?.setControlMode?.("full");
    if (this.scene.taskRevealCinematic) this.scene.taskRevealCinematic.active = false;
    this.scene.registry?.set?.("taskRevealActive", false);
    this.scene.inputSystem?.setWorldEnabled?.(true);
    this.scene.inputSystem?.setControlMode?.("full");
    this.scene.inputSystem?.resetWorldEdges?.();
    this.scene.game?.canvas?.focus?.({ preventScroll: true });
    const graceUntil = this.scene.policeSystem?.resetAfterPlayerDeath?.(HOSPITAL_RECOVERY.policeGraceMs)
      || ((Number(this.scene.time?.now) || 0) + HOSPITAL_RECOVERY.policeGraceMs);
    this.scene.registry?.set?.("policeReacquisitionGraceUntil", graceUntil);
    return graceUntil;
  }

  departLackey() {
    const lackey = this.lackey;
    if (!lackey || lackey.inactive) return Promise.resolve();
    lackey.vx = 0;
    lackey.vy = 0;
    const offset = HOSPITAL_RECOVERY.lackeyExitOffset || { x: 74, y: -8 };
    const targetX = lackey.x + (Number(offset.x) || 0);
    const targetY = lackey.y + (Number(offset.y) || 0);
    const finish = () => {
      lackey.vx = 0;
      lackey.vy = 0;
      lackey.inactive = true;
      lackey.active = false;
      lackey.container?.setAlpha?.(0).setVisible?.(false);
      this.scene.npcSystem?.rebuildSpatialIndex?.();
    };
    if (!this.scene.tweens?.add) {
      lackey.x = targetX;
      lackey.y = targetY;
      finish();
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: lackey,
        x: targetX,
        y: targetY,
        duration: HOSPITAL_RECOVERY.lackeyDepartureMs,
        ease: "Sine.easeInOut",
        onUpdate: tween => {
          lackey.container?.setPosition?.(lackey.x, lackey.y);
          const progress = Math.max(0, Math.min(1, Number(tween.progress) || 0));
          if (progress > 0.62) lackey.container?.setAlpha?.(1 - (progress - 0.62) / 0.38);
        },
        onComplete: () => {
          finish();
          resolve();
        }
      });
    });
  }

  async runHospitalRecoveryBeat() {
    const director = this.scene.tutorialDirector;
    try {
      await this.waitForPresentation(HOSPITAL_RECOVERY.hospitalSettleMs);
      if (director?.showDialogue) {
        await director.showDialogue({
          speaker: HOSPITAL_RECOVERY.lackeySpeaker,
          text: HOSPITAL_RECOVERY.lackeyLine,
          kind: "spoken",
          target: this.lackey
        });
      } else {
        this.scene.lastActionText = `${HOSPITAL_RECOVERY.lackeySpeaker}: ${HOSPITAL_RECOVERY.lackeyLine}`;
        await this.waitForPresentation(2200);
      }
      await this.departLackey();
      return true;
    } catch (error) {
      console.error("Hospital lackey recovery beat failed", error);
      return false;
    } finally {
      this.hospitalRecoveryIntroComplete = true;
      const graceUntil = this.releaseRecoveryControls();
      this.scene.statePublisher?.setMany?.({
        hospitalRecoveryIntroComplete: true,
        hospitalBloodBagAvailable: !this.recoveryBagCollected,
        policeReacquisitionGraceUntil: graceUntil
      });
      this.scene.events?.emit?.("death:hospital-recovery-ready", {
        vehicleId: this.recoveryVehicleId,
        bloodBagAvailable: !this.recoveryBagCollected,
        graceUntil
      });
    }
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
    const camera = this.scene.cameras?.main;
    const worldBounds = this.scene.physics?.world?.bounds;
    if (camera) {
      if (worldBounds) {
        camera.setBounds?.(
          Number(worldBounds.x) || 0,
          Number(worldBounds.y) || 0,
          Number(worldBounds.width) || camera.width,
          Number(worldBounds.height) || camera.height
        );
      }
      if (this.cameraZoomSnapshot) camera.setZoom?.(this.cameraZoomSnapshot);
      camera.startFollow?.(this.scene.player, true, 0.12, 0.12);
    }

    this.placeLackey(spawn);
    this.placeBloodBag(spawn);
    this.placeReplacementVehicle();
    this.restoreAudio();
    this.lockRecoveryControls();

    this.state = createDeathSequenceState();
    this.masterPresentationPromise = null;
    this.masterPresentationComplete = false;
    this.cameraZoomSnapshot = null;
    this.deathBlackoutAlpha = 0;
    this.setSireDialogueAboveBlackout(false);
    this.syncPresentation();
    this.scene.registry?.set?.("deathSequenceActive", false);
    this.scene.statePublisher?.setMany?.({
      deathSequenceActive: false,
      deathSequencePhase: DEATH_SEQUENCE_PHASES.IDLE,
      deathSequenceText: "Hospital recovery",
      hospitalRecoveryActive: true,
      hospitalRecoveryIntroComplete: false,
      hospitalBloodBagAvailable: false,
      policeReacquisitionGraceUntil: graceUntil
    });
    this.scene.lastActionText = "Hospital recovery · listen to the lackey.";
    this.scene.events?.emit?.("death:hospital-recovered", {
      x: spawn.x,
      y: spawn.y,
      vitality: HOSPITAL_RECOVERY.reviveVitality,
      graceUntil,
      vehicleId: this.recoveryVehicleId,
      bloodBagAvailable: true
    });
    this.recoveryPresentationPromise = this.runHospitalRecoveryBeat();
    return true;
  }

  collectInteractions() {
    if (!this.recovered
      || !this.hospitalRecoveryIntroComplete
      || this.recoveryBagCollected
      || !this.bagContainer?.visible) return [];
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
    const overlayAlpha = Math.max(deathFadeAlpha(this.state), this.deathBlackoutAlpha);
    const show = overlayAlpha > 0.001
      || this.state.phase === DEATH_SEQUENCE_PHASES.FADE
      || this.state.phase === DEATH_SEQUENCE_PHASES.BLACK;

    this.backdrop
      .setPosition(0, 0)
      .setSize(width, height)
      .setDisplaySize(width, height)
      .setAlpha(overlayAlpha)
      .setVisible(show);

    const domBackdrop = this.ensureDeathDomBackdrop();
    if (domBackdrop?.style) {
      domBackdrop.style.opacity = String(Math.max(0, Math.min(1, overlayAlpha)));
      domBackdrop.style.display = show ? "block" : "none";
    }
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
    this.scene.tutorialDirector?.hideDialogue?.();
    this.setSireDialogueAboveBlackout(false);
    this.backdrop?.destroy?.();
    this.deathDomBackdrop?.remove?.();
    this.deathDomBackdrop = null;
    this.bagContainer?.destroy?.();
  }
}