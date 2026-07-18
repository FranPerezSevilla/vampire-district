import { UNARMED_ATTACK } from "../data/combat.js";
import { LAYERS, lights } from "../data/district.js";
import { PROP_TYPES, applyPropDamage, createDamageableProp, propInsideMeleeArc } from "../data/props.js";
import { RawAudio } from "./RawAudioSystem.js";

export class PropDamageSystem {
  constructor(scene) {
    this.scene = scene;
    this.props = lights.map(light => createDamageableProp(light, {
      type: PROP_TYPES.STREETLIGHT,
      layer: LAYERS.STREET,
      hitRadius: 7,
      maxDurability: 1
    }));
    scene.propDamageSystem = this;
  }

  resolveAttack(attack, origin, config = UNARMED_ATTACK) {
    if (!attack || !origin || this.scene.currentLayer !== LAYERS.STREET) return 0;
    let hits = 0;

    for (const prop of this.props) {
      if (!this.validTarget(prop)) continue;
      const hitKey = `prop:${prop.id}`;
      if (attack.hitIds?.has(hitKey)) continue;
      if (!propInsideMeleeArc(origin, attack.direction, prop, config)) continue;

      attack.hitIds?.add(hitKey);
      this.damage(prop, config.damage || 1, attack.serial || 0);
      hits++;
    }

    return hits;
  }

  validTarget(prop) {
    return Boolean(
      prop
      && !prop.broken
      && prop.layer === this.scene.currentLayer
      && !this.scene.brokenLights?.has?.(prop.id)
    );
  }

  damage(prop, amount = 1, attackId = 0) {
    const result = applyPropDamage(prop, amount);
    if (!result.applied) return result;

    this.scene.events?.emit?.("prop:damaged", {
      attackId,
      propId: prop.id,
      propType: prop.type,
      durability: result.durability,
      maxDurability: result.maxDurability,
      broken: result.broken
    });

    if (result.broken) this.breakProp(prop, attackId);
    return result;
  }

  breakProp(prop, attackId = 0) {
    if (!prop || this.scene.brokenLights?.has?.(prop.id)) return;

    this.scene.brokenLights.add(prop.id);
    RawAudio.play("breakLight", { cooldown: 0.08 });

    const source = {
      id: prop.id,
      x: prop.x,
      y: prop.y,
      layer: prop.layer
    };
    const reaction = this.scene.sensoryAwarenessSystem?.emit?.("breakLight", source) || "No one nearby reacts.";

    // Preserve a small systemic district cost even when no observer has direct
    // sight. Visual police/civilian reactions are resolved by sensory awareness.
    this.scene.exposureSystem?.add?.(6, `${prop.name} smashed. The impact carries through the district.`);
    this.scene.lastActionText = `${prop.name} smashed. A patch of darkness opens. ${reaction}`;
    this.showBreakFeedback(prop);
    this.scene.redrawLayer?.(this.scene.lastActionText);

    this.scene.events?.emit?.("prop:broken", {
      attackId,
      propId: prop.id,
      propType: prop.type,
      x: prop.x,
      y: prop.y,
      layer: prop.layer
    });
    this.scene.events?.emit?.("noise:emitted", {
      kind: "streetlightBreak",
      x: prop.x,
      y: prop.y,
      layer: prop.layer,
      radius: 176,
      sourceEntityId: prop.id,
      severity: 10
    });
  }

  showBreakFeedback(prop) {
    const burst = this.scene.add.graphics().setDepth(76);
    burst.lineStyle(2, 0xfff2a8, 0.95).strokeCircle(prop.x, prop.y - 10, 10);
    burst.lineStyle(1, 0xffb02e, 0.8);
    for (let index = 0; index < 8; index++) {
      const angle = (Math.PI * 2 * index) / 8;
      burst.beginPath();
      burst.moveTo(prop.x + Math.cos(angle) * 7, prop.y - 10 + Math.sin(angle) * 7);
      burst.lineTo(prop.x + Math.cos(angle) * 17, prop.y - 10 + Math.sin(angle) * 17);
      burst.strokePath();
    }

    const label = this.scene.add.text(prop.x, prop.y - 25, "BROKEN", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#fff0bd",
      backgroundColor: "rgba(20, 5, 10, .86)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(77);
    label.setResolution?.(3);
    label.setStroke?.("#05060b", 2);

    this.scene.tweens?.add?.({
      targets: [burst, label],
      alpha: 0,
      y: "-=5",
      duration: 520,
      ease: "Quad.easeOut",
      onComplete: () => {
        burst.destroy();
        label.destroy();
      }
    });
  }

  summary() {
    const broken = this.props.filter(prop => prop.broken || this.scene.brokenLights?.has?.(prop.id)).length;
    return `Props ${this.props.length} streetlights · ${broken} broken`;
  }
}
