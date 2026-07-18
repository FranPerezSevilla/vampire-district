import { COMBAT_STATES } from "../data/combat.js";
import {
  PLAYER_DAMAGE,
  applyPlayerDamageState,
  createPlayerDamageState,
  enemyAttackPhase,
  enemyMeleeForType,
  enemyMeleeHits,
  playerIsHitStunned,
  playerIsInvulnerable
} from "../data/player-combat.js";
import { NPC_TYPES } from "../data/npcs.js";
import { normalizeVector } from "../utils/geometry.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

export class PlayerDamageSystem {
  constructor(scene) {
    this.scene = scene;
    this.state = createPlayerDamageState();
    this.graphics = scene.add.graphics().setDepth(72);
    this.feedbackLabel = scene.add.text(0, 0, "", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffd8df",
      backgroundColor: "rgba(25, 5, 12, .88)",
      padding: { x: 5, y: 3 }
    }).setOrigin(0.5, 1).setDepth(74).setVisible(false);
    this.feedbackLabel.setResolution?.(3);
    this.feedbackLabel.setStroke?.("#05060b", 2);
    scene.playerDamageSystem = this;
    scene.playerCombatState = this.state;
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  preUpdate(frame) {
    if (!this.canSimulate(frame)) {
      this.cancelAllEnemyAttacks();
      this.syncPlayerFeedback();
      return;
    }

    for (const npc of this.enemies()) {
      if (npc.enemyAttack) this.lockEnemy(npc, npc.enemyAttack);
    }
  }

  postUpdate(dt, frame) {
    if (!this.canSimulate(frame)) {
      this.cancelAllEnemyAttacks();
      this.syncPlayerFeedback();
      this.draw(frame);
      return;
    }

    const now = this.scene.time.now;
    for (const npc of this.enemies()) {
      const config = enemyMeleeForType(npc.type);
      if (!config || !this.validEnemy(npc)) {
        npc.enemyAttack = null;
        continue;
      }

      if (npc.enemyAttack) {
        this.updateEnemyAttack(npc, config, dt);
        continue;
      }

      if (now < (npc.enemyAttackCooldownUntil || 0)) continue;
      if (!this.enemyWantsToAttack(npc)) continue;
      const distance = Phaser.Math.Distance.Between(npc.x, npc.y, this.scene.player.x, this.scene.player.y);
      if (distance <= config.startRange) this.startEnemyAttack(npc, config);
    }

    this.syncPlayerFeedback();
    this.draw(frame);
  }

  canSimulate(frame) {
    return Boolean(
      frame?.worldEnabled
      && !this.scene.transitionSystem?.active
      && !this.scene.interactionSystem?.isOpen
      && !this.scene.missionSystem?.failed
      && !this.scene.missionSystem?.completed
    );
  }

  enemies() {
    return (this.scene.npcSystem?.npcs || []).filter(npc => enemyMeleeForType(npc.type));
  }

  validEnemy(npc) {
    if (!npc || npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted) return false;
    if (npc.layer !== this.scene.currentLayer) return false;
    if (npc.stunnedTimer > 0) return false;
    return npc.combat?.state !== COMBAT_STATES.DOWNED;
  }

  enemyWantsToAttack(npc) {
    if (npc.type === NPC_TYPES.POLICE) return Boolean(npc.chasingPlayer);
    if (npc.type === NPC_TYPES.HUNTER) {
      if (npc.hunterIntent !== "hunt") return false;
      if (this.scene.currentShadow?.()) return false;
      return true;
    }
    return false;
  }

  startEnemyAttack(npc, config) {
    const direction = normalizeVector(
      this.scene.player.x - npc.x,
      this.scene.player.y - npc.y,
      { x: npc.dirX || 1, y: npc.dirY || 0 }
    );

    npc.dirX = direction.x;
    npc.dirY = direction.y;
    npc.vx = 0;
    npc.vy = 0;
    npc.enemyAttack = {
      elapsedMs: 0,
      phase: "windup",
      direction: { x: direction.x, y: direction.y },
      lockX: npc.x,
      lockY: npc.y,
      hitApplied: false
    };

    this.scene.events?.emit?.("combat:enemy-attack-started", {
      attackerId: npc.id,
      attackId: config.id,
      direction: { ...npc.enemyAttack.direction }
    });
  }

  updateEnemyAttack(npc, config, dt) {
    const attack = npc.enemyAttack;
    if (!attack) return;

    this.lockEnemy(npc, attack);
    attack.elapsedMs += dt * 1000;
    attack.phase = enemyAttackPhase(attack.elapsedMs, config);

    if (attack.phase === "active" && !attack.hitApplied) {
      attack.hitApplied = true;
      if (enemyMeleeHits(npc, attack.direction, this.scene.player, config)) {
        this.damagePlayer(npc, config);
      }
    }

    if (attack.phase === "complete") {
      npc.enemyAttack = null;
      npc.enemyAttackCooldownUntil = this.scene.time.now + config.cooldownMs;
    }
  }

  lockEnemy(npc, attack) {
    npc.x = attack.lockX;
    npc.y = attack.lockY;
    npc.vx = 0;
    npc.vy = 0;
    npc.container?.setPosition?.(npc.x, npc.y);
  }

  damagePlayer(attacker, config) {
    const now = this.scene.time.now;
    const feeding = this.scene.feedingSystem;
    const result = applyPlayerDamageState(
      this.state,
      feeding?.hunger || 0,
      config.hungerDamage,
      now,
      { sourceId: attacker.id, label: config.label }
    );
    if (!result.applied) return false;

    if (feeding) feeding.hunger = result.after;
    if (feeding?.isActive?.()) feeding.cancel("The hit tears you away from the victim.");
    if (this.scene.combatSystem?.attack) this.scene.combatSystem.attack = null;

    const input = this.scene.inputSystem;
    if (input) {
      input.primaryHeld = false;
      input.primaryPressed = false;
      input.drainHeld = false;
      input.drainPressed = false;
      input.pendingWheelStep = 0;
    }

    RawAudio.play("stun", { cooldown: 0.08 });
    this.scene.cameras?.main?.shake?.(120, 0.0022);
    this.scene.lastActionText = result.critical
      ? `HIT: ${config.label}. Hunger +${result.gained}. HUNGER CRITICAL — feed before you lose control.`
      : `HIT: ${config.label}. Hunger +${result.gained}.`;

    this.scene.events?.emit?.("player:damaged", {
      attackerId: attacker.id,
      attackId: config.id,
      hungerDamage: result.gained,
      hungerBefore: result.before,
      hungerAfter: result.after,
      critical: result.critical
    });
    this.scene.events?.emit?.("hunger:changed", {
      source: "damage",
      before: result.before,
      after: result.after,
      amount: result.gained
    });

    if (result.frenzy && !this.scene.missionSystem?.failed) {
      this.scene.missionSystem?.failRun?.(
        "Hunger overwhelms you. You lose control before the order is complete.",
        {
          title: "FRENZY",
          missionText: "FAILED · Hunger reached its limit and you lost control.",
          audio: "masqueradeFail"
        }
      );
    }

    return true;
  }

  filterFrame(frame) {
    if (!this.isHitStunned()) return frame;
    return {
      ...frame,
      move: { x: 0, y: 0 },
      hasMovementIntent: false,
      sprintHeld: false,
      primaryHeld: false,
      primaryPressed: false,
      drainHeld: false,
      drainPressed: false,
      traversePressed: false,
      interactPressed: false,
      weaponStep: 0,
      dashPressed: false,
      whisperPressed: false,
      bloodSensePressed: false,
      debugLayerPressed: 0
    };
  }

  isHitStunned() {
    return playerIsHitStunned(this.state, this.scene.time.now);
  }

  isInvulnerable() {
    return playerIsInvulnerable(this.state, this.scene.time.now);
  }

  blocksMovement() {
    return this.isHitStunned();
  }

  cancelAllEnemyAttacks() {
    for (const npc of this.enemies()) npc.enemyAttack = null;
  }

  syncPlayerFeedback() {
    const now = this.scene.time.now;
    const invulnerable = this.isInvulnerable();
    if (this.scene.player) {
      const pulse = invulnerable ? 0.55 + Math.abs(Math.sin(now / 55)) * 0.45 : 1;
      this.scene.player.setAlpha?.(pulse);
    }

    if (now < this.state.feedbackUntil) {
      this.feedbackLabel
        .setText(this.state.critical ? `HUNGER +${this.state.lastDamage} · CRITICAL` : `HUNGER +${this.state.lastDamage}`)
        .setPosition(this.scene.player.x, this.scene.player.y - 24)
        .setVisible(true);
    } else {
      this.feedbackLabel.setVisible(false);
    }
  }

  draw(frame) {
    const graphics = this.graphics;
    graphics.clear();
    if (!frame?.worldEnabled) return;

    for (const npc of this.enemies()) {
      const attack = npc.enemyAttack;
      const config = enemyMeleeForType(npc.type);
      if (!attack || !config || npc.layer !== this.scene.currentLayer) continue;
      this.drawEnemyAttack(npc, attack, config);
    }

    if (this.isInvulnerable()) {
      const pulse = (Math.sin(this.scene.time.now / 60) + 1) * 0.5;
      graphics.lineStyle(2, 0xff3b50, 0.45 + pulse * 0.35)
        .strokeCircle(this.scene.player.x, this.scene.player.y, 13 + pulse * 3);
    }

    if (this.state.critical && !this.scene.missionSystem?.failed) {
      const pulse = (Math.sin(this.scene.time.now / 120) + 1) * 0.5;
      graphics.lineStyle(2, 0xff3b50, 0.25 + pulse * 0.35)
        .strokeCircle(this.scene.player.x, this.scene.player.y, 20 + pulse * 3);
    }
  }

  drawEnemyAttack(npc, attack, config) {
    const angle = Math.atan2(attack.direction.y, attack.direction.x);
    const start = angle - config.halfAngle;
    const end = angle + config.halfAngle;
    const alpha = attack.phase === "active" ? 0.9 : attack.phase === "windup" ? 0.55 : 0.24;

    this.graphics.lineStyle(2, config.color, alpha);
    this.graphics.beginPath();
    this.graphics.arc(npc.x, npc.y, config.range, start, end, false);
    this.graphics.strokePath();
    this.graphics.lineStyle(1, config.color, alpha * 0.65);
    this.graphics.beginPath();
    this.graphics.moveTo(npc.x, npc.y);
    this.graphics.lineTo(npc.x + Math.cos(start) * config.range, npc.y + Math.sin(start) * config.range);
    this.graphics.moveTo(npc.x, npc.y);
    this.graphics.lineTo(npc.x + Math.cos(end) * config.range, npc.y + Math.sin(end) * config.range);
    this.graphics.strokePath();
  }

  destroy() {
    this.cancelAllEnemyAttacks();
    this.scene.player?.setAlpha?.(1);
    this.graphics?.destroy?.();
    this.feedbackLabel?.destroy?.();
  }
}
