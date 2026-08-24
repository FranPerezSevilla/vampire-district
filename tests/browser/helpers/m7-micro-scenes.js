import { writeFile } from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

async function captureCanvas(page, outputDir, name) {
  const canvas = page.locator("#game-root canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(140);
  await canvas.screenshot({ path: path.join(outputDir, `${name}.png`) });
}

async function waitForMicroSceneSystems(page) {
  await page.waitForFunction(() => {
    const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
    return Boolean(
      scene?.npcSystem
      && scene?.vehicleSystem
      && scene?.streetFurnitureSystem
      && scene?.motorizedPoliceSystem
    );
  });
  await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    await scene.motorizedPoliceSystem.initialization;
  });
}

async function prepareClubQueue(page) {
  return page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const district = await import("/phaser/src/data/district.js");
    const signPolicy = await import("/phaser/src/policies/BuildingDecorativeSignPresentationPolicy.js");

    const queue = (scene.npcSystem.npcs || []).filter(npc => (
      npc.ambientActivity === "club-queue"
      && npc.layer === district.LAYERS.STREET
      && !npc.dead
      && !npc.inactive
    ));
    if (!queue.length) return null;
    const queueCenter = {
      x: queue.reduce((sum, npc) => sum + Number(npc.x), 0) / queue.length,
      y: queue.reduce((sum, npc) => sum + Number(npc.y), 0) / queue.length
    };

    const nightlifeSigns = (district.buildings || [])
      .map(building => ({ building, descriptor: signPolicy.buildBuildingDecorativeSignDescriptor(building) }))
      .filter(item => item.descriptor?.family === "nightlife-band")
      .map(item => ({
        ...item,
        center: {
          x: Number(item.building.x) + Number(item.building.w) / 2,
          y: Number(item.building.y) + Number(item.building.h) / 2
        }
      }))
      .sort((left, right) => (
        Math.hypot(left.center.x - queueCenter.x, left.center.y - queueCenter.y)
        - Math.hypot(right.center.x - queueCenter.x, right.center.y - queueCenter.y)
      ));
    const sign = nightlifeSigns[0] || null;
    if (!sign) return null;

    const signPoint = {
      x: Number(sign.descriptor.panel?.x) + Number(sign.descriptor.panel?.w) / 2,
      y: Number(sign.descriptor.panel?.y) + Number(sign.descriptor.panel?.h) / 2
    };
    const reviewCenter = {
      x: (queueCenter.x * 2 + signPoint.x) / 3,
      y: (queueCenter.y * 2 + signPoint.y) / 3
    };
    const offsets = [
      [0, 100], [0, -100], [100, 0], [-100, 0],
      [0, 140], [140, 0], [-140, 0], [0, 0]
    ];
    const stand = offsets
      .map(([dx, dy]) => ({ x: reviewCenter.x + dx, y: reviewCenter.y + dy }))
      .find(point => scene.canStandAt(point.x, point.y)) || queueCenter;

    scene.switchLayer(district.LAYERS.STREET, stand, "M7.3 club queue micro-scene");
    await window.NBD_CITY_STREAM.forceFocus(reviewCenter.x, reviewCenter.y);
    scene.redrawLayer("M7.3 club queue micro-scene");
    const camera = scene.cameras.main;
    camera.stopFollow();
    camera.centerOn(reviewCenter.x, reviewCenter.y);
    scene.scene.pause();

    const runtimeNightlife = (scene.cityPracticalLightDescriptors || [])
      .filter(item => item.family === "nightlife-accent");
    const matchingLight = runtimeNightlife.find(item => item.buildingId === String(sign.building.id || ""))
      || [...runtimeNightlife].sort((left, right) => (
        Math.hypot(left.x - queueCenter.x, left.y - queueCenter.y)
        - Math.hypot(right.x - queueCenter.x, right.y - queueCenter.y)
      ))[0]
      || null;
    const labels = (scene.mapLabels || [])
      .filter(label => label?.visible !== false)
      .map(label => String(label?.text || ""));
    const halfWorldWidth = Math.max(1, Number(camera.width) || 0) / (Number(camera.zoom) || 1) / 2;
    const halfWorldHeight = Math.max(1, Number(camera.height) || 0) / (Number(camera.zoom) || 1) / 2;
    const inFrame = point => (
      Math.abs(Number(point.x) - reviewCenter.x) <= halfWorldWidth
      && Math.abs(Number(point.y) - reviewCenter.y) <= halfWorldHeight
    );

    return {
      storyId: "club-night-queue",
      queueCenter,
      reviewCenter,
      queue: queue.map(npc => ({
        id: npc.id,
        x: Number(npc.x),
        y: Number(npc.y),
        visible: npc.container?.visible !== false,
        inFrame: inFrame(npc)
      })),
      queueCount: queue.length,
      queueVisibleCount: queue.filter(npc => npc.container?.visible !== false && inFrame(npc)).length,
      sign: {
        buildingId: String(sign.building.id || ""),
        family: sign.descriptor.family,
        labelText: sign.descriptor.labelText,
        distanceToQueue: Math.hypot(signPoint.x - queueCenter.x, signPoint.y - queueCenter.y)
      },
      light: matchingLight ? {
        sourceId: matchingLight.sourceId,
        buildingId: matchingLight.buildingId,
        family: matchingLight.family,
        distanceToQueue: Math.hypot(matchingLight.x - queueCenter.x, matchingLight.y - queueCenter.y),
        runtimeVisible: true
      } : null,
      labelVisible: labels.includes(sign.descriptor.labelText)
    };
  });
}

async function prepareFoundryNightShift(page) {
  return page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const district = await import("/phaser/src/data/district.js");
    const grimePolicy = await import("/phaser/src/policies/CityGrimePresentationPolicy.js");

    const vehicle = scene.vehicleSystem.vehicle("foundry:vehicle:utility");
    if (!vehicle) return null;
    const vehiclePoint = { x: Number(vehicle.x), y: Number(vehicle.y) };
    const serviceAnchors = grimePolicy.buildServiceFrontageGrimeDescriptors(district.buildings, null)
      .filter(item => ["industrial", "warehouse"].includes(item.profileId));
    const framingAnchor = [...serviceAnchors]
      .map(item => ({
        item,
        distance: Math.hypot(Number(item.x) - vehiclePoint.x, Number(item.y) - vehiclePoint.y)
      }))
      .sort((left, right) => left.distance - right.distance)[0]
      || null;
    if (!framingAnchor) return null;

    const reviewCenter = {
      x: (vehiclePoint.x + Number(framingAnchor.item.x)) / 2,
      y: (vehiclePoint.y + Number(framingAnchor.item.y)) / 2
    };
    const offsets = [
      [0, 90], [0, -90], [90, 0], [-90, 0],
      [0, 130], [130, 0], [-130, 0], [0, 0]
    ];
    const stand = offsets
      .map(([dx, dy]) => ({ x: reviewCenter.x + dx, y: reviewCenter.y + dy }))
      .find(point => scene.canStandAt(point.x, point.y)) || reviewCenter;

    scene.switchLayer(district.LAYERS.STREET, stand, "M7.3 foundry night-shift micro-scene");
    await window.NBD_CITY_STREAM.forceFocus(reviewCenter.x, reviewCenter.y);
    scene.redrawLayer("M7.3 foundry night-shift micro-scene");
    const camera = scene.cameras.main;
    camera.stopFollow();
    camera.centerOn(reviewCenter.x, reviewCenter.y);
    scene.updateCityServiceSteamPresentation?.(1400);
    scene.scene.pause();

    const runtimeIndustrial = (scene.cityPracticalLightDescriptors || [])
      .filter(item => item.family === "industrial-dirty");
    const matchingIndustrial = runtimeIndustrial.find(item => (
      item.buildingId === String(framingAnchor.item.buildingId || "")
    )) || [...runtimeIndustrial].sort((left, right) => (
      Math.hypot(Number(left.x) - vehiclePoint.x, Number(left.y) - vehiclePoint.y)
      - Math.hypot(Number(right.x) - vehiclePoint.x, Number(right.y) - vehiclePoint.y)
    ))[0] || null;
    const nearbyGrime = (scene.cityServiceFrontageGrimeDescriptors || []).filter(item => (
      Math.hypot(Number(item.x) - vehiclePoint.x, Number(item.y) - vehiclePoint.y) <= 280
    ));
    const nearbySteam = (scene.cityServiceSteamSourceDescriptors || []).filter(item => (
      Math.hypot(Number(item.x) - vehiclePoint.x, Number(item.y) - vehiclePoint.y) <= 320
    ));
    const nearbyDumpsters = (scene.streetFurnitureSystem?.dumpsters || []).filter(item => (
      Math.hypot(Number(item.x) - vehiclePoint.x, Number(item.y) - vehiclePoint.y) <= 320
    ));

    return {
      storyId: "foundry-night-shift",
      reviewCenter,
      vehicle: {
        id: vehicle.id,
        name: vehicle.name || null,
        x: vehiclePoint.x,
        y: vehiclePoint.y,
        parked: Boolean(vehicle.parked),
        visible: vehicle.container?.visible !== false
      },
      industrialLight: matchingIndustrial ? {
        sourceId: matchingIndustrial.sourceId,
        buildingId: matchingIndustrial.buildingId,
        family: matchingIndustrial.family,
        distanceToVehicle: Math.hypot(
          Number(matchingIndustrial.x) - vehiclePoint.x,
          Number(matchingIndustrial.y) - vehiclePoint.y
        ),
        runtimeVisible: true
      } : null,
      framingService: {
        sourceId: framingAnchor.item.sourceId,
        buildingId: framingAnchor.item.buildingId,
        profileId: framingAnchor.item.profileId,
        distanceToVehicle: framingAnchor.distance
      },
      nearbyServiceContext: {
        grimeCount: nearbyGrime.length,
        steamSourceCount: nearbySteam.length,
        dumpsterCount: nearbyDumpsters.length
      }
    };
  });
}

async function preparePoliceWetCivic(page) {
  return page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const district = await import("/phaser/src/data/district.js");
    const lightPolicy = await import("/phaser/src/policies/CityPracticalLightPresentationPolicy.js");
    const wetPolicy = await import("/phaser/src/policies/CityWetStreetPresentationPolicy.js");

    const civicLights = lightPolicy.buildCoolCivicLightDescriptors(district.buildings, null);
    const civic = civicLights.find(item => item.profileId === "police") || civicLights[0] || null;
    if (!civic) return null;
    const receiver = wetPolicy.findNearestRoadReceiver(civic, district.roads, {
      maximumDistance: 220
    });
    if (!receiver) return null;

    const center = receiver.receivingPoint;
    const offsets = [
      [0, 100], [0, -100], [100, 0], [-100, 0],
      [0, 140], [140, 0], [-140, 0], [0, 0]
    ];
    const stand = offsets
      .map(([dx, dy]) => ({ x: center.x + dx, y: center.y + dy }))
      .find(point => scene.canStandAt(point.x, point.y)) || center;

    scene.switchLayer(district.LAYERS.STREET, stand, "M7.3 police wet-civic micro-scene");
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.redrawLayer("M7.3 police wet-civic micro-scene");
    const camera = scene.cameras.main;
    camera.stopFollow();
    camera.centerOn(center.x, center.y);

    const slot = scene.motorizedPoliceSystem.slots[0];
    if (!slot) return null;
    slot.unitId = "m7-micro-scene-police";
    slot.x = Number(center.x);
    slot.y = Number(center.y);
    slot.angle = 0;
    slot.container.setPosition(slot.x, slot.y).setRotation(0).setActive(true).setVisible(true);
    scene.updateVehicleLightPresentation?.(0);
    scene.scene.pause();

    const vehicleLights = (scene.cityVehicleLightDescriptors || []).filter(item => (
      String(item.sourceId || "").includes("m7-micro-scene-police")
    ));
    const wet = (scene.cityWetDynamicReflectionDescriptors || []).filter(item => (
      String(item.sourceId || "").includes("m7-micro-scene-police")
    ));
    const runtimeCivic = (scene.cityPracticalLightDescriptors || [])
      .filter(item => item.family === "cool-civic");
    const matchingCivic = runtimeCivic.find(item => item.buildingId === String(civic.buildingId || ""))
      || [...runtimeCivic].sort((left, right) => (
        Math.hypot(Number(left.x) - Number(center.x), Number(left.y) - Number(center.y))
        - Math.hypot(Number(right.x) - Number(center.x), Number(right.y) - Number(center.y))
      ))[0]
      || null;

    return {
      storyId: "police-wet-civic",
      center: { x: Number(center.x), y: Number(center.y) },
      roadId: receiver.roadId,
      roadDistanceFromCivic: receiver.distance,
      civicLight: matchingCivic ? {
        sourceId: matchingCivic.sourceId,
        buildingId: matchingCivic.buildingId,
        profileId: matchingCivic.profileId,
        family: matchingCivic.family,
        runtimeVisible: true
      } : null,
      police: {
        unitId: slot.unitId,
        visible: slot.container?.visible !== false,
        families: [...new Set(vehicleLights.map(item => item.family))]
      },
      wet: {
        count: wet.length,
        families: [...new Set(wet.map(item => item.sourceFamily))],
        roadIds: [...new Set(wet.map(item => item.receiverRoadId))]
      }
    };
  });
}

export async function captureM7MicroScenes(page, outputDir) {
  await waitForMicroSceneSystems(page);

  const club = await prepareClubQueue(page);
  expect(club, "expected authored club-queue micro-scene").toBeTruthy();
  expect(club.queueCount).toBeGreaterThanOrEqual(3);
  expect(club.queueVisibleCount).toBeGreaterThanOrEqual(3);
  expect(club.sign.family).toBe("nightlife-band");
  expect(club.light?.family).toBe("nightlife-accent");
  expect(club.light?.runtimeVisible).toBe(true);
  expect(club.labelVisible).toBe(true);
  await captureCanvas(page, outputDir, "m7-micro-club-queue");

  const foundry = await prepareFoundryNightShift(page);
  expect(foundry, "expected authored foundry night-shift micro-scene").toBeTruthy();
  expect(foundry.vehicle.id).toBe("foundry:vehicle:utility");
  expect(foundry.vehicle.parked).toBe(true);
  expect(foundry.vehicle.visible).toBe(true);
  expect(foundry.industrialLight?.family).toBe("industrial-dirty");
  expect(foundry.industrialLight?.runtimeVisible).toBe(true);
  expect(foundry.industrialLight?.distanceToVehicle).toBeLessThanOrEqual(320);
  expect(
    foundry.nearbyServiceContext.grimeCount
      + foundry.nearbyServiceContext.steamSourceCount
      + foundry.nearbyServiceContext.dumpsterCount
  ).toBeGreaterThan(0);
  await captureCanvas(page, outputDir, "m7-micro-foundry-night-shift");

  const police = await preparePoliceWetCivic(page);
  expect(police, "expected police wet-civic micro-scene").toBeTruthy();
  expect(police.civicLight?.family).toBe("cool-civic");
  expect(police.civicLight?.runtimeVisible).toBe(true);
  expect(police.police.visible).toBe(true);
  expect(police.police.families).toContain("police-red");
  expect(police.police.families).toContain("police-blue");
  expect(police.wet.families).toContain("police-red");
  expect(police.wet.families).toContain("police-blue");
  expect(police.wet.roadIds).toContain(police.roadId);
  await captureCanvas(page, outputDir, "m7-micro-police-wet-civic");

  const manifest = {
    schemaVersion: 1,
    initiative: "city-noir-atmosphere",
    milestone: "M7.3",
    purpose: "prove three specific urban micro-stories by composing existing authored NPC, vehicle, practical-light, wet-road and service-context authorities without parallel simulation logic",
    productionRuntimeAdded: false,
    stories: [club, foundry, police],
    captures: [
      "m7-micro-club-queue.png",
      "m7-micro-foundry-night-shift.png",
      "m7-micro-police-wet-civic.png"
    ]
  };
  await writeFile(
    path.join(outputDir, "m7-micro-scenes-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  return manifest;
}
