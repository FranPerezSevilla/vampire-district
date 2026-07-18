import {
  COMBAT_STATES,
  UNARMED_ATTACK,
  applyNpcDamage,
  createNpcCombatState,
  targetInsideMeleeArc,
  worldAimDirection
} from "../data/combat.js";
import { NPC_TYPES } from "../data/npcs.js";
import {
  WEAPON_IDS,
  WEAPON_TYPES,
  selectHitscanTarget,
  weaponById
} from "../data/weapons.js";
import { resolveAction } from "../systems/ActionSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

const HUMAN_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.THUG,
  NPC_TYPES.HUNTER
]);

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.aimDirection = { x: 0, y: -1 };
    this.attack = null;
    this.attackSerial = 0;
    this.graphics = scene.add.graphics().setDepth(71);
    this.labels = new Map();
    this.tutorialPatched = false;
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(dt, frame) {
    this.ensureCombatStates();
    this.installTutorialCompatibility();
    this.updateAim(frame);
    this.updateAttack(dt, frame);
    this.syncNpcVisuals();
    this.draw(frame);
  }

  ensureCombatStates() {
    const now = this.scene.time.now;
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!HUMAN_TYPES.has(npc.type)) continue;
      npc.combat ||= createNpcCombatState(npc.type);
      if (!npc.combat) continue;

      if (npc.dead) {
        npc.combat.state = npc.deathKind === "drained" ? COMBAT_STATES.DRAINED : COMBAT_STATES.DEAD;
        continue;
      }

      if (npc.combat.state === COMBAT_STATES.STAGGERED && now >= npc.combat.staggerUntil) {
        npc.combat.state = COMBAT_STATES.ACTIVE;
      }
    }
  }

  installTutorialCompatibility() {
    const director = this.scene.tutorialDirector;
    if (!director || director.__nbdCombatTutorialFilterPatch) return;

    const originalFilterActions = director.filterActions.bind(director);
    director.filterActions = options => {
      const filtered = originalFilterActions(options);
      if (director.state !== "drain-thug") return filtered;
      const thug = director.thug?.();
      const downed = thug?.combat?.state === COMBAT_STATES.DOWNED;
      return downed ? filtered : filtered.filter(option => option.type !== "drain");
    };
    director.__nbdCombatTutorialFilterPatch = true;
    this.tutorialPatched = true;
  }

  currentAttackConfig() {
    return this.scene.weaponSystem?.currentWeapon?.() || weaponById(WEAPON_IDS.UNARMED);
  }

  updateAim(frame) {
    const config = this.currentAttackConfig();
    this.aimDirection = worldAimDirection(
      this.scene.player,
      frame?.aimWorld,
      this.aimDirection,
      config.aimDeadZone ?? UNARMED_ATTACK.aimDeadZone
    );

    const angle = Math.atan2(this.aimDirection.y, this.aimDirection.x) + Math.PI / 2;
    this.scene.player?.setRotation?.(angle);
  }

  updateAttack(dt, frame) {
    if (!this.attack) {
      if (frame?.primaryPressed && this.canStartAttack(frame)) this.startAttack();
      return;
    }

    const config = this.attack.config;
    this.attack.elapsedMs += dt * 1000;
    const activeStart = config.windupMs;
    const recoveryStart = activeStart + config.activeMs;
    const completeAt = recoveryStart + config.recoveryMs;

    if (this.attack.elapsedMs < activeStart) {
      this.attack.phase = "windup";
      return;
    }

    if (this.attack.elapsedMs < recoveryStart) {
      this.attack.phase = "active";
      this.resolveAttackHits();
      return;
    }

    if (this.attack.elapsedMs < completeAt) {
      this.attack.phase = "recovery";
      return;
    }

    this.attack = null;
  }

  canStartAttack(frame) {
    return Boolean(
      frame?.worldEnabled
      && !this.scene.transitionSystem?.active
      && !this.scene.interactionSystem?.isOpen
      && !this.scene.feedingSystem?.isActive()
      && !this.scene.missionSystem?.failed
      && !this.scene.missionSystem?.completed
    );
  }

  startAttack() {
    const selected = this.currentAttackConfig();
    const config = { ...selected };
    if (this.scene.weaponSystem && !this.scene.weaponSystem.beginAttack(config)) return false;

    this.attackSerial += 1;
    this.attack = {
      serial: this.attackSerial,
      elapsedMs: 0,
      phase: "windup",
      direction: { ...this.aimDirection },
      hitIds: new Set(),
      resolved: false,
      tracer: null,
      config
    };

    if (!this.scene.weaponSystem) RawAudio.play("stun", { cooldown: 0.08 });
    this.scene.events?.emit?.("combat:attack-started", {
      attackId: this.attack.serial,
      weaponId: config.id,
      attackType: config.attackType,
      direction: { ...this.attack.direction }
    });
    return true;
  }

  resolveAttackHits() {
    if (!this.attack) return;
    if (this.attack.config.attackType === WEAPON_TYPES.HITSCAN) {
      this.resolveHitscanAttack();
      return;
    }

    const origin = { x: this.scene.player.x, y: this.scene.player.y };
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!this.validTarget(npc)) continue;
      if (this.attack.hitIds.has(npc.id)) continue;
      if (!targetInsideMeleeArc(origin, this.attack.direction, npc, this.attack.config)) continue;
      this.attack.hitIds.add(npc.id);
      this.applyHit(npc, this.attack.config);
    }

    this.scene.propDamageSystem?.resolveAttack?.(this.attack, origin, this.attack.config);
  }

  resolveHitscanAttack() {
    if (!this.attack || this.attack.resolved) return;
    this.attack.resolved = true;
    const config = this.attack.config;
    const origin = { x: this.scene.player.x, y: this.scene.player.y };
    const candidates = [];

    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!this.validTarget(npc)) continue;
      candidates.push({
        id: `npc:${npc.id}`,
        kind: "npc",
        entity: npc,
        x: npc.x,
        y: npc.y,
        hitRadius: 7
      });
    }

    for (const prop of this.scene.propDamageSystem?.props || []) {
      if (!this.scene.propDamageSystem.validTarget(prop)) continue;
      candidates.push({
        id: `prop:${prop.id}`,
        kind: "prop",
        entity: prop,
        x: prop.x,
        y: prop.y,
        hitRadius: prop.hitRadius || 7
      });
    }

    const selected = selectHitscanTarget(origin, this.attack.direction, candidates, config, {
      lineClear: candidate => this.hitscanLineClear(origin, candidate)
    });
    const endpoint = selected
      ? { x: selected.candidate.x, y: selected.candidate.y, hit: true }
      : {
          x: origin.x + this.attack.direction.x * config.range,
          y: origin.y + this.attack.direction.y * config.range,
          hit: false
        };
    this.attack.tracer = endpoint;

    if (!selected) return;
    const candidate = selected.candidate;
    this.attack.hitIds.add(candidate.id);
    if (candidate.kind === "npc") this.applyHit(candidate.entity, config);
    if (candidate.kind === "prop") {
      this.scene.propDamageSystem?.damage?.(candidate.entity, config.damage || 1, this.attack.serial);
    }
  }

  hitscanLineClear(origin, candidate) {
    if (!this.scene.npcSystem?.lineClear) return true;
    const subject = candidate.kind === "npc"
      ? candidate.entity
      : { layer: this.scene.currentLayer };
    return this.scene.npcSystem.lineClear(subject, origin.x, origin.y, candidate.x, candidate.y);
  }

  validTarget(npc) {
    if (!npc || !HUMAN_TYPES.has(npc.type) || npc.missionInformant) return false;
    if (npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted) return false;
    if (npc.layer !== this.scene.currentLayer) return false;
    const state = npc.combat?.state;
    return state === COMBAT_STATES.ACTIVE || state === COMBAT_STATES.STAGGERED;
  }

  applyHit(npc, config = this.attack?.config || this.currentAttackConfig()) {
    const now = this.scene.time.now;
    const combat = npc.combat || (npc.combat = createNpcCombatState(npc.type));
    if (!combat) return;

    applyNpcDamage(combat, config.damage || 1);
    combat.lastHitBy = config.id || "player";
    combat.feedbackUntil = now + (config.feedbackMs || UNARMED_ATTACK.feedbackMs);
    npc.vx = 0;
    npc.vy = 0;
    npc.luredTimer = 0;
    npc.soundReactionTimer = 0;

    this.notifyViolence(npc, combat.state === COMBAT_STATES.DOWNED, config);

    if (combat.state === COMBAT_STATES.DOWNED) {
      this.knockDown(npc, config);
    } else {
      combat.staggerUntil = now + (config.staggerMs || UNARMED_ATTACK.staggerMs);
      npc.stunnedTimer = Math.max(npc.stunnedTimer || 0, (config.staggerMs || UNARMED_ATTACK.staggerMs) / 1000);
      this.alertVictim(npc);
      this.scene.lastActionText = `HIT · ${config.name}: ${this.targetName(npc)} · resilience ${combat.resilience}/${combat.maxResilience}.`;
    }

    this.scene.events?.emit?.("combat:hit", {
      attackId: this.attack?.serial || 0,
      weaponId: config.id,
      damage: config.damage || 1,
      targetId: npc.id,
      resilience: combat.resilience,
      maxResilience: combat.maxResilience,
      downed: combat.state === COMBAT_STATES.DOWNED
    });
  }

  notifyViolence(npc, downed, config) {
    if (config.attackType === WEAPON_TYPES.MELEE) {
      resolveAction(this.scene, "stun", {
        x: npc.x,
        y: npc.y,
        layer: npc.layer,
        target: npc,
        exclude: [npc],
        cooldownKey: `${config.id}:${this.attack?.serial || this.attackSerial}`,
        cooldown: 0.05
      });

      this.scene.witnessSystem?.onMundaneViolence?.(
        npc,
        `${this.targetName(npc)} ${downed ? `knocked down with ${config.name.toLowerCase()}` : config.violenceLabel || "struck"}`,
        downed ? Math.max(9, config.witnessSeverity || 6) : config.witnessSeverity || 6
      );
      this.scene.weaponSystem?.onMeleeImpact?.(config, npc);
    }

    if (npc.type === NPC_TYPES.POLICE) {
      const reason = `A police officer was ${downed ? "knocked down" : config.violenceLabel || "assaulted"}.`;
      this.scene.exposureSystem?.forceLevel?.(1, reason);
      this.scene.policeSystem?.addHeat?.(
        npc.x,
        npc.y,
        config.attackType === WEAPON_TYPES.HITSCAN ? config.policeHeat || 34 : downed ? 24 : 15,
        reason
      );
      const zone = this.scene.policeSystem?.zoneAt?.(this.scene.player.x, this.scene.player.y);
      if (this.scene.policeSystem) {
        this.scene.policeSystem.lastKnownPlayer = {
          x: this.scene.player.x,
          y: this.scene.player.y,
          zoneId: zone?.id || "district"
        };
      }
      RawAudio.play("police", { cooldown: 0.3 });
    }
  }

  alertVictim(npc) {
    if ([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) {
      this.scene.witnessSystem?.alarmWitness?.(npc, "an assault", 9, {
        masqueradeRisk: false,
        reactionSeconds: 0.35,
        source: this.scene.player
      });
      return;
    }

    npc.alarmed = true;
    npc.reactionTimer = Math.max(npc.reactionTimer || 0, 0.35);
    if (npc.type === NPC_TYPES.POLICE) npc.chasingPlayer = true;
  }

  knockDown(npc, config = this.attack?.config || this.currentAttackConfig()) {
    npc.combat.state = COMBAT_STATES.DOWNED;
    npc.combat.resilience = 0;
    npc.stunnedTimer = Number.POSITIVE_INFINITY;
    npc.alarmed = false;
    npc.chasingPlayer = false;
    npc.reactionTimer = 0;
    npc.reportTarget = null;
    npc.witnessReason = "";
    npc.luredTimer = 0;
    npc.soundReactionTimer = 0;
    npc.vx = 0;
    npc.vy = 0;

    RawAudio.play("bodyDrop", { cooldown: 0.08 });
    this.scene.lastActionText = `DOWNED · ${config.name}: ${this.targetName(npc)} can no longer move, pursue or report.`;
    this.scene.events?.emit?.("combat:entity-downed", {
      targetId: npc.id,
      type: npc.type,
      weaponId: config.id
    });
  }

  blocksMovement() {
    return Boolean(this.attack && (this.attack.phase === "windup" || this.attack.phase === "active"));
  }

  isBusy() {
    return Boolean(this.attack);
  }

  syncNpcVisuals() {
    const now = this.scene.time.now;
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!npc.combat || !npc.container) continue;
      const label = this.ensureLabel(npc);
      const onCurrentLayer = npc.layer === this.scene.currentLayer && !npc.hiddenBody;

      if (npc.dead) {
        npc.container.setScale(1).setAlpha(1);
        label.setVisible(false);
        continue;
      }

      if (npc.combat.state === COMBAT_STATES.DOWNED) {
        npc.container.setScale(1.32, 0.55).setAlpha(0.76);
        label.setText("DOWN").setPosition(npc.x, npc.y - 19).setVisible(onCurrentLayer);
        continue;
      }

      npc.container.setScale(1);
      if (npc.combat.feedbackUntil > now) {
        const pulse = 0.68 + Math.abs(Math.sin(now / 55)) * 0.32;
        npc.container.setAlpha(pulse);
        label
          .setText(`${npc.combat.resilience}/${npc.combat.maxResilience}`)
          .setPosition(npc.x, npc.y - 19)
          .setVisible(onCurrentLayer);
      } else {
        npc.container.setAlpha(1);
        label.setVisible(false);
      }
    }
  }

  ensureLabel(npc) {
    if (this.labels.has(npc.id)) return this.labels.get(npc.id);
    const label = this.scene.add.text(npc.x, npc.y - 19, "", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#fff0bd",
      backgroundColor: "rgba(5, 6, 11, .82)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(73).setVisible(false);
    label.setResolution?.(3);
    label.setStroke?.("#05060b", 2);
    this.labels.set(npc.id, label);
    return label;
  }

  draw(frame) {
    const graphics = this.graphics;
    graphics.clear();
    if (!frame?.worldEnabled) return;

    const config = this.attack?.config || this.currentAttackConfig();
    const px = this.scene.player.x;
    const py = this.scene.player.y;
    if (frame.pointerInside) {
      const distance = config.reticleDistance || 27;
      const ax = px + this.aimDirection.x * distance;
      const ay = py + this.aimDirection.y * distance;
      graphics.lineStyle(2, config.color || 0xd7c8ff, 0.72);
      graphics.beginPath();
      graphics.moveTo(px + this.aimDirection.x * 9, py + this.aimDirection.y * 9);
      graphics.lineTo(ax, ay);
      graphics.strokePath();
      graphics.lineStyle(1, config.color || 0xd7c8ff, 0.58).strokeCircle(ax, ay, config.attackType === WEAPON_TYPES.HITSCAN ? 5 : 4);
    }

    if (this.attack) this.drawAttackArc();

    const now = this.scene.time.now;
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!npc.combat || npc.dead || npc.hiddenBody || npc.layer !== this.scene.currentLayer) continue;
      if (npc.combat.state === COMBAT_STATES.DOWNED) {
        graphics.fillStyle(0xffb02e, 0.09).fillEllipse(npc.x, npc.y + 3, 26, 13);
        graphics.lineStyle(2, 0xffb02e, 0.72).strokeEllipse(npc.x, npc.y + 3, 26, 13);
      }
      if (npc.combat.feedbackUntil > now) this.drawResiliencePips(npc);
    }
  }

  drawAttackArc() {
    const config = this.attack.config;
    const phase = this.attack.phase;
    const color = config.color || (phase === "active" ? 0xfff2a8 : phase === "windup" ? 0xa75cff : 0x78c7a3);
    const alpha = phase === "active" ? 0.88 : phase === "windup" ? 0.48 : 0.24;
    const px = this.scene.player.x;
    const py = this.scene.player.y;

    if (config.attackType === WEAPON_TYPES.HITSCAN) {
      const endpoint = this.attack.tracer || {
        x: px + this.attack.direction.x * Math.min(config.range, 80),
        y: py + this.attack.direction.y * Math.min(config.range, 80),
        hit: false
      };
      this.graphics.lineStyle(phase === "active" ? 3 : 1, color, alpha);
      this.graphics.beginPath();
      this.graphics.moveTo(px + this.attack.direction.x * 8, py + this.attack.direction.y * 8);
      this.graphics.lineTo(endpoint.x, endpoint.y);
      this.graphics.strokePath();
      if (endpoint.hit) this.graphics.lineStyle(2, 0xfff2a8, alpha).strokeCircle(endpoint.x, endpoint.y, 7);
      return;
    }

    const angle = Math.atan2(this.attack.direction.y, this.attack.direction.x);
    const start = angle - config.halfAngle;
    const end = angle + config.halfAngle;

    this.graphics.lineStyle(2, color, alpha);
    this.graphics.beginPath();
    this.graphics.arc(px, py, config.range, start, end, false);
    this.graphics.strokePath();
    this.graphics.lineStyle(1, color, alpha * 0.62);
    this.graphics.beginPath();
    this.graphics.moveTo(px, py);
    this.graphics.lineTo(px + Math.cos(start) * config.range, py + Math.sin(start) * config.range);
    this.graphics.moveTo(px, py);
    this.graphics.lineTo(px + Math.cos(end) * config.range, py + Math.sin(end) * config.range);
    this.graphics.strokePath();
  }

  drawResiliencePips(npc) {
    const combat = npc.combat;
    const width = 5;
    const gap = 2;
    const total = combat.maxResilience * width + (combat.maxResilience - 1) * gap;
    const startX = npc.x - total / 2;
    const y = npc.y - 25;
    for (let index = 0; index < combat.maxResilience; index++) {
      const active = index < combat.resilience;
      this.graphics.fillStyle(active ? 0xfff2a8 : 0x3a3145, active ? 0.92 : 0.72);
      this.graphics.fillRect(startX + index * (width + gap), y, width, 3);
    }
  }

  targetName(npc) {
    if (npc.type === NPC_TYPES.TARGET) return "journalist";
    if (npc.type === NPC_TYPES.POLICE) return "police officer";
    if (npc.type === NPC_TYPES.THUG) return "rooftop thug";
    if (npc.type === NPC_TYPES.HUNTER) return "hunter";
    return "civilian";
  }

  destroy() {
    this.graphics?.destroy?.();
    for (const label of this.labels.values()) label.destroy?.();
    this.labels.clear();
  }
}
