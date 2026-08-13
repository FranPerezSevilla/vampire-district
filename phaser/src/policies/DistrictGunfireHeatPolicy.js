import { NPC_TYPES } from "../data/npcs.js";
import { WEAPON_TYPES } from "../data/weapons.js";
import { CombatSystem } from "../combat/CombatSystem.js";

const CIVILIAN_GUNFIRE_HEAT = 10;
const HOSTILE_GUNFIRE_HEAT = 8;
const POLICE_GUNFIRE_HEAT = 34;

function heatForVictim(npc) {
  if (npc?.type === NPC_TYPES.POLICE) return POLICE_GUNFIRE_HEAT;
  if ([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc?.type)) return CIVILIAN_GUNFIRE_HEAT;
  if ([NPC_TYPES.THUG, NPC_TYPES.HUNTER].includes(npc?.type)) return HOSTILE_GUNFIRE_HEAT;
  return 0;
}

export function installDistrictGunfireHeatPolicy() {
  const prototype = CombatSystem?.prototype;
  if (!prototype || prototype.__nbdDistrictGunfireHeatPolicy) return;

  const originalKnockDown = prototype.knockDown;
  if (typeof originalKnockDown !== "function") return;

  prototype.knockDown = function districtGunfireAwareKnockDown(npc, config) {
    const result = originalKnockDown.call(this, npc, config);
    if (config?.attackType !== WEAPON_TYPES.HITSCAN || !npc) return result;

    const amount = heatForVictim(npc);
    if (!(amount > 0)) return result;

    const reason = npc.type === NPC_TYPES.POLICE
      ? "A police shooting triggers an immediate district response."
      : "Repeated gunfire casualties draw police attention even without direct witnesses.";

    this.scene.heatSystem?.add?.(
      npc.x,
      npc.y,
      amount,
      reason,
      { source: "gunfire_casualty" }
    );

    return result;
  };

  Object.defineProperty(prototype, "__nbdDistrictGunfireHeatPolicy", {
    value: true,
    configurable: true
  });
}
