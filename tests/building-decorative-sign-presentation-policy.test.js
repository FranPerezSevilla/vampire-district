import test from "node:test";
import assert from "node:assert/strict";

import {
  COOL_CIVIC_LIGHT_PRESENTATION,
  INDUSTRIAL_DIRTY_LIGHT_PRESENTATION,
  NIGHTLIFE_LIGHT_PRESENTATION,
  WARM_FRONTAGE_LIGHT_PRESENTATION
} from "../phaser/src/policies/CityPracticalLightPresentationPolicy.js";
import {
  DECORATIVE_SIGN_FAMILIES,
  buildBuildingDecorativeSignDescriptor,
  drawBuildingDecorativeSignPresentation,
  installBuildingDecorativeSignPresentationPolicy
} from "../phaser/src/policies/BuildingDecorativeSignPresentationPolicy.js";

class FakeGraphics {
  constructor() {
    this.operations = [];
  }

  fillStyle(color, alpha) {
    this.operations.push(["fillStyle", color, alpha]);
    return this;
  }

  fillRect(x, y, w, h) {
    this.operations.push(["fillRect", x, y, w, h]);
    return this;
  }

  lineStyle(width, color, alpha) {
    this.operations.push(["lineStyle", width, color, alpha]);
    return this;
  }

  strokeRect(x, y, w, h) {
    this.operations.push(["strokeRect", x, y, w, h]);
    return this;
  }

  fillCircle(x, y, radius) {
    this.operations.push(["fillCircle", x, y, radius]);
    return this;
  }
}

function building(id, sign, extra = {}) {
  return {
    id,
    sign,
    x: 100,
    y: 200,
    w: 180,
    h: 96,
    ...extra
  };
}

test("M7.1 maps semantic sign families onto the existing M3 light palette", () => {
  const nightlife = buildBuildingDecorativeSignDescriptor(building("west-club", "RED VELVET CLUB"));
  const motel = buildBuildingDecorativeSignDescriptor(building("sunset-motel", "SUNSET MOTEL"));
  const medical = buildBuildingDecorativeSignDescriptor(building("north-clinic", "NORTH CLINIC"));
  const service = buildBuildingDecorativeSignDescriptor(building("canal-garage", "CANAL GARAGE"));

  assert.equal(nightlife.family, DECORATIVE_SIGN_FAMILIES.NIGHTLIFE_BAND);
  assert.equal(nightlife.paletteFamily, NIGHTLIFE_LIGHT_PRESENTATION.family);
  assert.equal(nightlife.accentColor, NIGHTLIFE_LIGHT_PRESENTATION.sourceColor);
  assert.equal(nightlife.coreColor, NIGHTLIFE_LIGHT_PRESENTATION.coreColor);

  assert.equal(motel.family, DECORATIVE_SIGN_FAMILIES.MOTEL_MARQUEE);
  assert.equal(motel.paletteFamily, WARM_FRONTAGE_LIGHT_PRESENTATION.family);
  assert.equal(motel.accentColor, WARM_FRONTAGE_LIGHT_PRESENTATION.sourceColor);

  assert.equal(medical.family, DECORATIVE_SIGN_FAMILIES.MEDICAL_PANEL);
  assert.equal(medical.paletteFamily, COOL_CIVIC_LIGHT_PRESENTATION.family);
  assert.equal(medical.accentColor, COOL_CIVIC_LIGHT_PRESENTATION.sourceColor);

  assert.equal(service.family, DECORATIVE_SIGN_FAMILIES.SERVICE_PANEL);
  assert.equal(service.paletteFamily, INDUSTRIAL_DIRTY_LIGHT_PRESENTATION.family);
  assert.equal(service.accentColor, INDUSTRIAL_DIRTY_LIGHT_PRESENTATION.sourceColor);
});

test("M7.1 stays selective and does not invent labels for generic or unnamed buildings", () => {
  assert.equal(
    buildBuildingDecorativeSignDescriptor(building("west-market", "WEST MARKET")),
    null
  );
  assert.equal(
    buildBuildingDecorativeSignDescriptor(building("anonymous-garage", "")),
    null
  );
});

test("M7.1 descriptors are deterministic, frozen and bounded by the authored building footprint", () => {
  const source = building("bounded-clinic", "A VERY LONG MEDICAL CLINIC NAME", { w: 92, h: 58 });
  const before = structuredClone(source);
  const first = buildBuildingDecorativeSignDescriptor(source);
  const second = buildBuildingDecorativeSignDescriptor(source);

  assert.deepEqual(source, before);
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.panel));
  assert.ok(Object.isFrozen(first.label));

  assert.ok(first.panel.x >= source.x);
  assert.ok(first.panel.y >= source.y);
  assert.ok(first.panel.x + first.panel.w <= source.x + source.w);
  assert.ok(first.panel.y + first.panel.h <= source.y + source.h);
  assert.ok(first.labelText.endsWith("…"));
  assert.equal("radius" in first, false);
  assert.equal("spillAlpha" in first, false);
  assert.equal("lightSpot" in first, false);
});

test("M7.1 rendering is plaque-only and uses no light-emitter primitive", () => {
  const descriptor = buildBuildingDecorativeSignDescriptor(building("night-bar", "NIGHT BAR"));
  const graphics = new FakeGraphics();

  drawBuildingDecorativeSignPresentation(graphics, descriptor);

  assert.ok(graphics.operations.some(([name]) => name === "fillRect"));
  assert.ok(graphics.operations.some(([name]) => name === "strokeRect"));
  assert.equal(graphics.operations.some(([name]) => name === "fillEllipse"), false);
});

test("M7.1 installer composes after normal building drawing and adds at most one nearby label", () => {
  class FakeScene {
    drawBuilding() {
      this.baseDraws = (this.baseDraws || 0) + 1;
      return "base-result";
    }
  }

  installBuildingDecorativeSignPresentationPolicy(FakeScene);
  installBuildingDecorativeSignPresentationPolicy(FakeScene);

  const scene = new FakeScene();
  scene.currentLayer = 0;
  scene.map = new FakeGraphics();
  scene.mapLabels = [];
  scene.renderFocus = () => ({ x: 180, y: 250 });
  scene.addMapLabel = (text, x, y, color) => {
    scene.mapLabels.push({ text, x, y, color, visible: true });
  };

  const result = scene.drawBuilding(building("review-bar", "REVIEW BAR"));

  assert.equal(result, "base-result");
  assert.equal(scene.baseDraws, 1);
  assert.equal(scene.mapLabels.length, 1);
  assert.equal(scene.mapLabels[0].text, "REVIEW BAR");
  assert.ok(scene.map.operations.some(([name]) => name === "strokeRect"));

  scene.drawBuilding(building("review-bar", "REVIEW BAR"));
  assert.equal(scene.baseDraws, 2);
  assert.equal(scene.mapLabels.length, 1);
});
