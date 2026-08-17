import {
  DEATH_BEAT,
  DEATH_SEQUENCE_PHASES,
  advanceDeathSequence,
  createDeathSequenceState,
  deathDialogueAlpha,
  deathFadeAlpha,
  startDeathSequence
} from "../data/death-recovery.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

function copyPayload(payload = {}) {
  return JSON.parse(JSON.stringify(payload || {}));
}

export class DeathRecoverySystem {
  constructor(scene) {
    this.scene = scene;
    this.state = createDeathSequenceState();
    this.deathPayload = null;
    this.audioFadeStarted = false;
    this.fadeCompleteEmitted = false;

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
  }
}
