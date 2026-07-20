import { COMBAT_STATES } from "../data/combat.js";
import { NPC_TYPES } from "../data/npcs.js";
import {
  DEFAULT_WEAPON_INVENTORY,
  WEAPON_IDS,
  WEAPON_TYPES,
  consumeWeaponAmmo,
  cycleWeaponIndex,
  weaponById
} from "../data/weapons.js";
import { RawAudio } from "./RawAudioSystem.js";

const HUMAN_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG
]);

export class WeaponSystem {
  constructor(scene, { inventory = DEFAULT_WEAPON_INVENTORY } = {}) {
    this.scene = scene;
    this.inventory = [...inventory].filter(id => weaponById(id));
    if (!this.inventory.length) this.inventory.push(WEAPON_IDS.UNARMED);
    this.index = 0;
    this.ammo = Object.create(null);
    for (const id of this.inventory) {
      const weapon = weaponById(id);
      if (weapon.ammoCapacity != null) this.ammo[id] = weapon.ammoCapacity;
    }
    this.scene.inputSystem?.setWheelCaptureEnabled?.(true);
    this.publish();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  currentWeapon() {
    return weaponById(this.inventory[this.index]);
  }

  ammoRemaining(id = this.currentWeapon().id) {
    const weapon = weaponById(id);
    if (weapon.ammoCapacity == null) return null;
    return Math.max(0, Number(this.ammo[id]) || 0);
  }

  update(frame) {
    if (frame?.weaponStep && this.canCycle(frame)) this.cycle(frame.weaponStep);
    this.publish();
  }

  canCycle(frame) {
    return Boolean(
      frame?.worldEnabled
      && !this.scene.transitionSystem?.active
      && !this.scene.interactionSystem?.isOpen
      && !this.scene.feedingSystem?.isActive()
      && !this.scene.combatSystem?.isBusy()
      && !this.scene.playerDamageSystem?.isHitStunned()
      && !this.scene.missionSystem?.failed
    );
  }

  cycle(step) {
    const next = cycleWeaponIndex(this.index, step, this.inventory.length);
    if (next === this.index) return false;
    const previous = this.currentWeapon();
    this.index = next;
    const current = this.currentWeapon();
    RawAudio.play("menu", { cooldown: 0.04 });
    this.scene.lastActionText = `EQUIPPED: ${current.name}${this.ammoLabel(current, true)}.`;
    this.scene.events?.emit?.("weapon:changed", {
      previousWeaponId: previous.id,
      weaponId: current.id,
      name: current.name,
      ammo: this.ammoRemaining(current.id)
    });
    this.publish();
    return true;
  }

  beginAttack(weapon = this.currentWeapon()) {
    const ammoResult = consumeWeaponAmmo(weapon, this.ammoRemaining(weapon.id));
    if (!ammoResult.fired) {
      RawAudio.play("cancel", { cooldown: 0.12 });
      this.scene.lastActionText = `${weapon.name.toUpperCase()} EMPTY · use the mouse wheel to change weapon.`;
      this.scene.events?.emit?.("weapon:empty", { weaponId: weapon.id });
      this.publish();
      return false;
    }

    if (weapon.ammoCapacity != null) this.ammo[weapon.id] = ammoResult.after;
    this.playAttackAudio(weapon);
    if (weapon.noiseOnAttackStart) this.emitGunshot(weapon);
    this.scene.events?.emit?.("weapon:fired", {
      weaponId: weapon.id,
      attackType: weapon.attackType,
      ammoBefore: weapon.ammoCapacity == null ? null : ammoResult.before,
      ammoAfter: weapon.ammoCapacity == null ? null : ammoResult.after
    });
    this.publish();
    return true;
  }

  playAttackAudio(weapon) {
    if (weapon.id === WEAPON_IDS.UNARMED) {
      RawAudio.play("stun", { cooldown: 0.08 });
      return;
    }

    const context = RawAudio.unlock?.();
    if (!context) return;
    if (weapon.id === WEAPON_IDS.PIPE) {
      RawAudio.noise?.(0.11, { volume: 0.042, filter: 720, filterType: "bandpass", q: 1.2 });
      RawAudio.tone?.(155, 0.10, { to: 78, volume: 0.034, type: "triangle", filter: 780 });
      return;
    }

    if (weapon.id === WEAPON_IDS.PISTOL) {
      RawAudio.noise?.(0.10, { volume: 0.12, filter: 1650, filterType: "highpass" });
      RawAudio.tone?.(190, 0.13, { to: 58, volume: 0.082, type: "square", filter: 1500 });
      RawAudio.tone?.(820, 0.05, { delay: 0.01, to: 210, volume: 0.035, type: "sawtooth", filter: 2500 });
    }
  }

  onMeleeImpact(weapon, victim) {
    if (!weapon || weapon.attackType !== WEAPON_TYPES.MELEE || !victim) return;
    this.emitHeardOnly(weapon, { x: victim.x, y: victim.y, layer: victim.layer }, new Set([victim]));
  }

  emitGunshot(weapon) {
    const source = {
      x: this.scene.player.x,
      y: this.scene.player.y,
      layer: this.scene.currentLayer
    };
    const maxRadius = Math.max(weapon.soundRadius || 0, weapon.visualRadius || 0);
    const candidates = this.scene.npcSystem?.queryRadius?.(
      source.x,
      source.y,
      maxRadius,
      source.layer,
      npc => HUMAN_TYPES.has(npc.type)
    ) || this.scene.npcSystem?.npcs || [];
    let visualWitnesses = 0;
    let heardOnly = 0;

    for (const npc of candidates) {
      if (!this.validObserver(npc, source.layer)) continue;
      const saw = Boolean(this.scene.witnessSystem?.canWitnessSee?.(
        npc,
        { ...source, layer: source.layer },
        weapon.visualRadius || 180
      ));

      if (saw) {
        visualWitnesses++;
        this.reactToVisibleGunshot(npc, source, weapon);
        continue;
      }

      const distance = Phaser.Math.Distance.Between(npc.x, npc.y, source.x, source.y);
      if (distance > weapon.soundRadius || npc.alarmed || npc.chasingPlayer || npc.enemyAttack) continue;
      this.startHeardOnlyReaction(npc, source, 1.9);
      heardOnly++;
    }

    if (heardOnly) RawAudio.play("witnessWtf", { cooldown: 0.4 });
    this.scene.lastActionText = `GUNSHOT: ${weapon.name} fired · ${this.ammoRemaining(weapon.id)}/${weapon.ammoCapacity} rounds.${visualWitnesses ? ` ${visualWitnesses} observer(s) saw the shot.` : ""}${heardOnly ? ` ${heardOnly} NPC(s) heard it.` : ""}`;
    this.scene.events?.emit?.("noise:emitted", {
      kind: "gunshot",
      x: source.x,
      y: source.y,
      layer: source.layer,
      radius: weapon.soundRadius,
      sourceEntityId: "player",
      severity: weapon.witnessSeverity
    });
  }

  emitHeardOnly(weapon, source, excluded = new Set()) {
    const candidates = this.scene.npcSystem?.queryRadius?.(
      source.x,
      source.y,
      weapon.soundRadius,
      source.layer,
      npc => HUMAN_TYPES.has(npc.type)
    ) || this.scene.npcSystem?.npcs || [];
    let heardOnly = 0;
    for (const npc of candidates) {
      if (excluded.has(npc) || !this.validObserver(npc, source.layer)) continue;
      if (npc.alarmed || npc.chasingPlayer || npc.enemyAttack) continue;
      const distance = Phaser.Math.Distance.Between(npc.x, npc.y, source.x, source.y);
      if (distance > weapon.soundRadius) continue;
      const saw = this.scene.witnessSystem?.canWitnessSee?.(npc, source, Math.min(weapon.soundRadius, 135));
      if (saw) continue;
      this.startHeardOnlyReaction(npc, source, weapon.id === WEAPON_IDS.UNARMED ? 0.75 : 1.15);
      heardOnly++;
    }
    if (heardOnly) RawAudio.play("witnessWtf", { cooldown: 0.5 });
    this.scene.events?.emit?.("noise:emitted", {
      kind: weapon.id === WEAPON_IDS.UNARMED ? "punch" : "meleeWeapon",
      x: source.x,
      y: source.y,
      layer: source.layer,
      radius: weapon.soundRadius,
      sourceEntityId: "player",
      severity: weapon.witnessSeverity
    });
  }

  reactToVisibleGunshot(npc, source, weapon) {
    this.turnToward(npc, source);
    npc.soundReactionTimer = 0;
    npc.__nbdWtfLabel?.setVisible?.(false);

    if (npc.type === NPC_TYPES.POLICE) {
      npc.chasingPlayer = true;
      npc.alarmed = true;
      const reason = `Police saw a ${weapon.name.toLowerCase()} fired.`;
      this.scene.exposureSystem?.forceLevel?.(1, reason);
      this.scene.policeSystem?.addHeat?.(source.x, source.y, weapon.policeHeat || 30, reason);
      RawAudio.play("police", { cooldown: 0.35 });
      return;
    }

    if ([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) {
      this.scene.witnessSystem?.alarmWitness?.(npc, "a gunshot", weapon.witnessSeverity || 18, {
        masqueradeRisk: false,
        reactionSeconds: 0.55,
        source
      });
      return;
    }

    npc.alarmed = true;
    npc.reactionTimer = Math.max(npc.reactionTimer || 0, 0.55);
    if (npc.type === NPC_TYPES.THUG) npc.thugHostile = true;
    if (npc.type === NPC_TYPES.HUNTER) npc.hunterIntent = "hunt";
  }

  startHeardOnlyReaction(npc, source, seconds) {
    npc.soundReactionTimer = Math.max(npc.soundReactionTimer || 0, seconds);
    npc.soundSourceX = source.x;
    npc.soundSourceY = source.y;
    npc.vx = 0;
    npc.vy = 0;
    npc.chasingPlayer = false;
    this.turnToward(npc, source);
    this.ensureWtfLabel(npc);
  }

  turnToward(npc, source) {
    const dx = source.x - npc.x;
    const dy = source.y - npc.y;
    const length = Math.hypot(dx, dy) || 1;
    npc.dirX = dx / length;
    npc.dirY = dy / length;
  }

  ensureWtfLabel(npc) {
    if (!npc.__nbdWtfLabel) {
      npc.__nbdWtfLabel = this.scene.add.text(npc.x, npc.y - 26, "WTF", {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffd58b",
        backgroundColor: "rgba(5, 6, 11, .78)",
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(72);
      npc.__nbdWtfLabel.setResolution?.(3);
      npc.__nbdWtfLabel.setStroke?.("#05060b", 2);
    }
    npc.__nbdWtfLabel.setPosition(npc.x, npc.y - 26).setVisible(true);
  }

  validObserver(npc, layer) {
    return Boolean(
      npc
      && HUMAN_TYPES.has(npc.type)
      && !npc.dead
      && !npc.inactive
      && !npc.hiddenBody
      && !npc.intercepted
      && !npc.missionInformant
      && npc.layer === layer
      && npc.stunnedTimer <= 0
      && npc.combat?.state !== COMBAT_STATES.DOWNED
      && !npc.drainVictim
    );
  }

  ammoLabel(weapon = this.currentWeapon(), leadingSpace = false) {
    if (weapon.ammoCapacity == null) return "";
    return `${leadingSpace ? " · " : ""}${this.ammoRemaining(weapon.id)}/${weapon.ammoCapacity}`;
  }

  state() {
    const weapon = this.currentWeapon();
    const ammo = this.ammoRemaining(weapon.id);
    return {
      id: weapon.id,
      name: weapon.name,
      attackType: weapon.attackType,
      ammo,
      capacity: weapon.ammoCapacity,
      ammoText: weapon.ammoCapacity == null ? "∞" : `${ammo}/${weapon.ammoCapacity}`,
      empty: weapon.ammoCapacity != null && ammo <= 0,
      inventory: [...this.inventory]
    };
  }

  publish() {
    this.scene.statePublisher?.set?.("weaponState", this.state())
      || this.scene.registry?.set?.("weaponState", this.state());
  }

  summary() {
    const state = this.state();
    return `Weapon ${state.name} · ammo ${state.ammoText}`;
  }

  destroy() {
    this.scene.inputSystem?.setWheelCaptureEnabled?.(false);
  }
}
