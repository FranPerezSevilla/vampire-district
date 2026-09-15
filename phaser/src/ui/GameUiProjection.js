import { buildings, roads, CITY_WORLD, districtZoneAt } from "../data/district.js";
import { buildDomainModel } from "../vampire/VampireDomainModel.js";
import { bindingLabel } from "../input/bindings.js";
import { vehicleSpeedKph } from "../vehicles/VehicleModel.js";

const bounded = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const shape = item => ({ x: item.x, y: item.y, w: item.w, h: item.h, points: item.points || null });
export const cityMapGeometry = Object.freeze({ world: CITY_WORLD, roads: roads.map(shape), buildings: buildings.map(shape) });
const powers = [{ id: "dash", name: "Dash", key: "Q" }, { id: "whisper", name: "Whisper", key: "R" },
  { id: "sense", name: "Sense", key: "F" }, { id: "beast", name: "Give In", key: "B" }];

export function objectiveModel(player, target) {
  if (!player || !target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return null;
  const dx = target.x - player.x, dy = target.y - player.y;
  return { target: target.target, label: target.label, distance: Math.round(Math.hypot(dx, dy)),
    bearing: Math.atan2(dy, dx) * 180 / Math.PI + 90, arrived: Math.hypot(dx, dy) < 55 };
}

export function projectGameUi(ui) {
  const game = ui.scene.get("GameScene"), vampire = game?.vampireRuntime;
  const data = ui.readState(), service = vampire?.service;
  const mode = ui.activeMode();
  // Reflect the installed playtest policy; never advertise disabled actions.
  const simplified = Boolean(ui.__nbdSimplifiedSurfacePolicy);
  const title = Boolean(game?.registry?.get?.("mainMenuActive"));
  let domain = null;
  if (service && mode === "domain") {
    const projected = buildDomainModel(vampire);
    // The direction callback is not part of the plain-data bridge.
    const { direction, ...plain } = projected;
    domain = plain;
  }
  const target = service ? vampire.guideTarget() : null;
  const zone = game?.player ? districtZoneAt(game.player.x, game.player.y) : null;
  const vehicle = game?.vehicleSystem?.currentVehicle?.();
  const radio = game?.radioSystem?.snapshot?.();
  const cooling = (id, label) => Number(String(data.powersText).match(new RegExp(`${label}\\s+([0-9.]+)`, "i"))?.[1]) || 0;
  const prompt = String(data.prompt || "");
  return {
    ready: Boolean(game?.player && service), visible: !title && !game?.playerDamageSystem?.isDead?.(),
    capabilities: { incidentFile: !simplified },
    mode, error: ui.uiError, tab: vampire?.domain?.tab || "tonight", chapterFocus: vampire?.domain?.focus || null, selection: vampire?.domain?.selection || null,
    domain, interaction: mode === "interaction" ? game.interactionSystem.snapshot() : null,
    external: ui.external?.read?.() || null, result: data.result, confirmation: ui.confirmation,
    hunger: bounded(game?.feedingSystem?.hunger), vitality: bounded(game?.playerDamageSystem?.state?.vitality ?? 100),
    cash: service?.wallet?.balance?.() ?? 0, bags: service?.state?.bloodBags ?? 0,
    stage: game?.registry?.get?.("vampireStage") || "Survivor", district: zone?.name || "The city",
    wanted: bounded(game?.heatSystem?.level?.() ?? data.wantedLevel, 0, 3),
    exposure: { value: Math.round(game?.exposureSystem?.value || 0), level: game?.exposureSystem?.level?.() || 0 },
    guide: objectiveModel(game?.player, target), weapon: data.weapon,
    player: game?.player ? { x: game.player.x, y: game.player.y } : null,
    powers: powers.filter(power => !simplified || !["dash", "sense"].includes(power.id)).map(power => ({ ...power, key: bindingLabel(data.inputBindings?.bindings?.[power.id] || power.key),
      cooldown: Math.ceil(cooling(power.id, power.id === "beast" ? "Beast" : power.name) * 10) / 10,
      locked: Boolean(vehicle || vampire?.frenzy?.active || vampire?.frenzy?.exhausted?.()),
      active: power.id === "beast" && cooling("beast", "GiveIn") > 0 })),
    frenzy: Boolean(vampire?.frenzy?.active), exhausted: Boolean(vampire?.frenzy?.exhausted?.()),
    prompt: !mode && prompt ? { key: /^SPACE:/i.test(prompt) ? "SPACE" : "E", text: prompt.replace(/^(E|SPACE):\s*/i, "") } : null,
    guidance: ui.registry.get("tutorialTip") || ui.registry.get("uiGuidance") || null,
    notice: ui.notice, feedback: ui.feedback || vampire?.domain?.feedback || "",
    errand: service?.state?.job ? { stage: service.state.job.stage, issuer: service.state.job.issuer } : null,
    ledger: mode === "ledger" ? ui.readNightLedgerState() : null,
    highContrast: Boolean(ui.registry.get("aimHighContrast")),
    vehicle: vehicle ? { name: vehicle.name, speed: vehicleSpeedKph(vehicle.speed), gear: vehicle.speed < -0.5 ? "R" : String(vehicle.gear || 1),
      hull: bounded(vehicle.health / vehicle.archetype.maxHealth * 100), disabled: vehicle.disabled,
      radio: radio?.stationLabel || radio?.stationName || "" } : null
  };
}
