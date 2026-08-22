import { LAYERS } from "../data/district.js";
import {
  resolveBuildingPresentationDefinition,
  resolveBuildingVisualProfile
} from "../rendering/BuildingPresentation.js";
import {
  COOL_CIVIC_LIGHT_PRESENTATION,
  INDUSTRIAL_DIRTY_LIGHT_PRESENTATION,
  NIGHTLIFE_LIGHT_PRESENTATION,
  WARM_FRONTAGE_LIGHT_PRESENTATION
} from "./CityPracticalLightPresentationPolicy.js";

export const DECORATIVE_SIGN_FAMILIES = Object.freeze({
  NIGHTLIFE_BAND: "nightlife-band",
  MOTEL_MARQUEE: "motel-marquee",
  MEDICAL_PANEL: "medical-panel",
  SERVICE_PANEL: "service-panel"
});

const SIGN_RULES = Object.freeze([
  Object.freeze({
    family: DECORATIVE_SIGN_FAMILIES.NIGHTLIFE_BAND,
    tokens: Object.freeze(["bar", "club", "nightclub", "lounge", "liquor", "pub"]),
    profiles: Object.freeze(["club"]),
    lightPresentation: NIGHTLIFE_LIGHT_PRESENTATION,
    height: 20,
    glowAlpha: 0.07,
    borderAlpha: 0.5,
    accentAlpha: 0.72
  }),
  Object.freeze({
    family: DECORATIVE_SIGN_FAMILIES.MOTEL_MARQUEE,
    tokens: Object.freeze(["motel", "hotel", "inn"]),
    profiles: Object.freeze([]),
    lightPresentation: WARM_FRONTAGE_LIGHT_PRESENTATION,
    height: 22,
    glowAlpha: 0.04,
    borderAlpha: 0.46,
    accentAlpha: 0.62
  }),
  Object.freeze({
    family: DECORATIVE_SIGN_FAMILIES.MEDICAL_PANEL,
    tokens: Object.freeze(["hospital", "clinic", "medical", "infirmary", "pharmacy", "chemist"]),
    profiles: Object.freeze(["medical"]),
    lightPresentation: COOL_CIVIC_LIGHT_PRESENTATION,
    height: 19,
    glowAlpha: 0.025,
    borderAlpha: 0.42,
    accentAlpha: 0.54
  }),
  Object.freeze({
    family: DECORATIVE_SIGN_FAMILIES.SERVICE_PANEL,
    tokens: Object.freeze(["garage", "workshop", "repair", "works", "factory", "foundry", "auto"]),
    profiles: Object.freeze(["industrial"]),
    lightPresentation: INDUSTRIAL_DIRTY_LIGHT_PRESENTATION,
    height: 18,
    glowAlpha: 0.018,
    borderAlpha: 0.34,
    accentAlpha: 0.44
  })
]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function normalizedWords(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function semanticWords(building = {}) {
  return new Set([
    building.id,
    building.sign,
    building.label,
    building.name,
    building.kind
  ].flatMap(normalizedWords));
}

function displayText(building = {}) {
  return [building.sign, building.label, building.name]
    .map(value => String(value || "").trim())
    .find(Boolean) || "";
}

function resolvedProfileId(building = {}) {
  const definition = resolveBuildingPresentationDefinition(building);
  return resolveBuildingVisualProfile(building, definition.archetypeId, {
    profileId: definition.profileId
  }).id;
}

function ruleForBuilding(building) {
  const words = semanticWords(building);
  const profileId = resolvedProfileId(building);
  return SIGN_RULES.find(rule => (
    rule.tokens.some(token => words.has(token))
      || rule.profiles.includes(profileId)
  )) || null;
}

function colorToCss(color) {
  return `#${(Number(color) >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}

function safePanelBounds(building, text, rule) {
  const x = finite(building.x);
  const y = finite(building.y);
  const w = Math.max(0, finite(building.w));
  const h = Math.max(0, finite(building.h));
  if (w < 52 || h < 34) return null;

  const horizontalInset = clamp(w * 0.035, 5, 9);
  const maximumWidth = w - horizontalInset * 2;
  if (maximumWidth < 42) return null;

  const desiredWidth = 18 + Math.min(26, text.length) * 7;
  const minimumWidth = Math.min(maximumWidth, rule.family === DECORATIVE_SIGN_FAMILIES.MOTEL_MARQUEE ? 52 : 44);
  const width = clamp(desiredWidth, minimumWidth, maximumWidth);
  const height = Math.min(rule.height, Math.max(16, h - 14));
  const topInset = clamp(h * 0.055, 7, 11);

  return Object.freeze({
    x: x + horizontalInset,
    y: y + topInset,
    w: width,
    h: height
  });
}

function labelTextFor(text, panelWidth) {
  const maximumCharacters = Math.max(4, Math.floor((panelWidth - 10) / 7));
  if (text.length <= maximumCharacters) return text;
  return `${text.slice(0, Math.max(3, maximumCharacters - 1)).trimEnd()}…`;
}

export function buildBuildingDecorativeSignDescriptor(building = {}) {
  const text = displayText(building);
  if (!text) return null;

  const rule = ruleForBuilding(building);
  if (!rule) return null;

  const panel = safePanelBounds(building, text, rule);
  if (!panel) return null;

  const lightPresentation = rule.lightPresentation;
  const labelText = labelTextFor(text, panel.w);
  return Object.freeze({
    buildingId: String(building.id || ""),
    family: rule.family,
    paletteFamily: lightPresentation.family,
    text,
    labelText,
    panel,
    label: Object.freeze({
      x: panel.x + 5,
      y: panel.y + 3
    }),
    panelColor: 0x07080d,
    accentColor: lightPresentation.sourceColor,
    coreColor: lightPresentation.coreColor,
    labelColor: colorToCss(lightPresentation.coreColor),
    glowAlpha: rule.glowAlpha,
    borderAlpha: rule.borderAlpha,
    accentAlpha: rule.accentAlpha
  });
}

export function drawBuildingDecorativeSignPresentation(graphics, descriptor) {
  if (!graphics || !descriptor?.panel) return descriptor || null;
  const { panel } = descriptor;

  if (descriptor.glowAlpha > 0) {
    graphics.fillStyle(descriptor.accentColor, descriptor.glowAlpha);
    graphics.fillRect(panel.x - 3, panel.y - 3, panel.w + 6, panel.h + 6);
  }

  graphics.fillStyle(descriptor.panelColor, 0.92);
  graphics.fillRect(panel.x, panel.y, panel.w, panel.h);
  graphics.lineStyle(1, descriptor.accentColor, descriptor.borderAlpha);
  graphics.strokeRect(panel.x, panel.y, panel.w, panel.h);

  if (descriptor.family === DECORATIVE_SIGN_FAMILIES.NIGHTLIFE_BAND) {
    graphics.fillStyle(descriptor.accentColor, descriptor.accentAlpha);
    graphics.fillRect(panel.x + 2, panel.y + 2, panel.w - 4, 2);
  } else if (descriptor.family === DECORATIVE_SIGN_FAMILIES.MOTEL_MARQUEE) {
    graphics.fillStyle(descriptor.accentColor, descriptor.accentAlpha);
    graphics.fillRect(panel.x + 2, panel.y + 2, 2, panel.h - 4);
    const dotY = panel.y + panel.h - 3;
    for (let index = 0; index < 3; index += 1) {
      graphics.fillCircle?.(panel.x + panel.w - 5 - index * 5, dotY, 1);
    }
  } else if (descriptor.family === DECORATIVE_SIGN_FAMILIES.MEDICAL_PANEL) {
    graphics.fillStyle(descriptor.accentColor, descriptor.accentAlpha);
    graphics.fillRect(panel.x + 2, panel.y + 2, 2, panel.h - 4);
    graphics.fillRect(panel.x + 6, panel.y + 2, Math.min(14, panel.w * 0.18), 2);
  } else if (descriptor.family === DECORATIVE_SIGN_FAMILIES.SERVICE_PANEL) {
    graphics.fillStyle(descriptor.accentColor, descriptor.accentAlpha);
    graphics.fillRect(panel.x + 2, panel.y + panel.h - 3, panel.w - 4, 1);
  }

  return descriptor;
}

function distanceToBuildingCenter(scene, building) {
  const focus = scene.renderFocus?.() || scene.player || { x: 0, y: 0 };
  const centerX = finite(building.x) + finite(building.w) / 2;
  const centerY = finite(building.y) + finite(building.h) / 2;
  return Math.hypot(finite(focus.x) - centerX, finite(focus.y) - centerY);
}

export function installBuildingDecorativeSignPresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceBuildingDecorativeSignPresentationPolicy) return;
  const drawBuilding = prototype.drawBuilding;
  if (typeof drawBuilding !== "function") {
    throw new Error("BuildingDecorativeSignPresentationPolicy requires GameScene.drawBuilding.");
  }

  prototype.__viceBuildingDecorativeSignPresentationPolicy = true;
  prototype.drawBuilding = function viceBloodDrawBuildingWithDecorativeSign(building, ...args) {
    const result = drawBuilding.call(this, building, ...args);
    if (this.currentLayer !== LAYERS.STREET || !this.map) return result;

    const descriptor = buildBuildingDecorativeSignDescriptor(building);
    if (!descriptor) return result;

    drawBuildingDecorativeSignPresentation(this.map, descriptor);
    if (distanceToBuildingCenter(this, building) >= 520 || typeof this.addMapLabel !== "function") {
      return result;
    }

    const alreadyLabeled = (this.mapLabels || []).some(label => (
      label?.visible !== false
        && String(label?.text || "") === descriptor.labelText
    ));
    if (!alreadyLabeled) {
      this.addMapLabel(
        descriptor.labelText,
        descriptor.label.x,
        descriptor.label.y,
        descriptor.labelColor
      );
    }
    return result;
  };
}
