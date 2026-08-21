import { expect, test } from "@playwright/test";

async function waitForMotorizedPolice(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_MOTORIZED_POLICE_READY
    && window.NBD_MOTORIZED_POLICE
  ));
}

test.describe.configure({ timeout: 90_000 });

test("wanted levels bring nearby foot police, multiple cruisers and final district saturation", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForMotorizedPolice(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const district = await import("/phaser/src/data/district.js");
    const focus = district.CITY_ANCHORS.foundryStreet;
    scene.switchLayer(0, focus, "Police response regression: Foundry interception.");
    await window.NBD_CITY_STREAM.forceFocus(focus.x, focus.y);

    // Keep the local-road portion deterministic. Distant macro movement no
    // longer samples these blockers until a cruiser has materialized.
    for (const slot of scene.trafficMaterializationSystem.pool) {
      if (slot.tokenId) scene.trafficMaterializationSystem.release(slot);
    }
    for (const vehicle of scene.vehicleSystem.vehicles) {
      if (vehicle.id === "refuge_compact") continue;
      vehicle.x += 110;
      vehicle.y -= 90;
      vehicle.container?.setPosition?.(vehicle.x, vehicle.y);
    }

    scene.heatSystem.clear("Police response baseline.");
    scene.exposureSystem.clear("Police response baseline.");

    scene.heatSystem.forceLevel(1, "Police response level-one test.");
    scene.policeSystem.spawnForExposure(1);
    const levelOnePolice = scene.policeSystem.allPolice();
    const levelOneSpawned = levelOnePolice
      .filter(cop => /^police_\d+$/.test(cop.id))
      .map(cop => ({
        id: cop.id,
        distance: Math.hypot(cop.x - focus.x, cop.y - focus.y),
        targetKind: cop.investigateTarget?.kind || null
      }));

    scene.heatSystem.forceLevel(2, "Police response level-two test.");
    window.NBD_MOTORIZED_POLICE.reconcile();
    const levelTwoInitial = window.NBD_MOTORIZED_POLICE.snapshot();
    const totalTargetAtTwo = scene.policeSystem.desiredCount(2);
    const desiredFootAtTwo = scene.policeSystem.footDesiredCount(2);
    const levelTwoAfterTravel = window.NBD_MOTORIZED_POLICE.step(12);
    const aggressionAfterLevelTwo = scene.motorizedPoliceAggressionPolicy?.snapshot?.() || null;
    const pursuit = levelTwoAfterTravel.units[0];
    const pursuitSeparation = Math.hypot(pursuit.x - focus.x, pursuit.y - focus.y);
    const levelTwoOfficerCounts = levelTwoAfterTravel.units.map(unit => ({
      unitId: unit.id,
      role: unit.role,
      officers: scene.policeSystem.allPolice().filter(cop => cop.motorizedUnitId === unit.id).length
    }));

    scene.heatSystem.forceLevel(3, "Police response level-three test.");
    window.NBD_MOTORIZED_POLICE.reconcile();
    const levelThreeInitial = window.NBD_MOTORIZED_POLICE.snapshot();
    const totalTargetAtThree = scene.policeSystem.desiredCount(3);
    const desiredFootAtThree = scene.policeSystem.footDesiredCount(3);
    scene.policeSystem.spawnForExposure(3);
    const levelThreeAfterTravel = window.NBD_MOTORIZED_POLICE.step(14);
    const aggressionAfterLevelThree = scene.motorizedPoliceAggressionPolicy?.snapshot?.() || null;
    const roadblock = levelThreeAfterTravel.units.find(unit => unit.role === "roadblock");
    const roadblockOfficers = scene.policeSystem.allPolice()
      .filter(cop => cop.motorizedUnitId === roadblock.id)
      .map(cop => ({ id: cop.id, unitId: cop.motorizedUnitId, role: cop.motorizedRole }));
    const blocksAtRoadblock = window.NBD_MOTORIZED_POLICE.blocks(roadblock.x, roadblock.y, 5);

    window.NBD_MOTORIZED_POLICE.damage(roadblock.id, roadblock.maxHealth + 1);
    const disabled = window.NBD_MOTORIZED_POLICE.snapshot().units.find(unit => unit.id === roadblock.id);

    scene.switchLayer(1, focus, "Motorized police regression: rooftop escape.");
    window.NBD_MOTORIZED_POLICE.step(0.1);
    const rooftop = window.NBD_MOTORIZED_POLICE.snapshot();

    scene.switchLayer(0, focus, "Motorized police regression: abandoned suspect car memory.");
    const playerVehicle = scene.vehicleSystem.vehicle("refuge_compact");
    playerVehicle.x = focus.x;
    playerVehicle.y = focus.y;
    playerVehicle.container?.setPosition?.(playerVehicle.x, playerVehicle.y);
    scene.vehicleSystem.currentVehicleId = playerVehicle.id;
    window.NBD_MOTORIZED_POLICE.step(0.1);
    scene.vehicleSystem.currentVehicleId = null;
    window.NBD_MOTORIZED_POLICE.step(0.1);
    const abandonedMemory = window.NBD_MOTORIZED_POLICE.snapshot().suspectMemory;

    return {
      focus,
      levelOneDesired: scene.policeSystem.desiredCount(1),
      levelOnePoliceCount: levelOnePolice.length,
      levelOneSpawned,
      levelTwoInitial,
      totalTargetAtTwo,
      desiredFootAtTwo,
      levelTwoAfterTravel,
      aggressionAfterLevelTwo,
      pursuit,
      pursuitSeparation,
      levelTwoOfficerCounts,
      levelThreeInitial,
      totalTargetAtThree,
      desiredFootAtThree,
      levelThreeAfterTravel,
      aggressionAfterLevelThree,
      roadblock,
      roadblockOfficers,
      blocksAtRoadblock,
      disabled,
      rooftop,
      abandonedMemory,
      totalPolice: scene.policeSystem.allPolice().length
    };
  });

  expect(result.levelOneDesired).toBe(4);
  expect(result.levelOnePoliceCount).toBeGreaterThanOrEqual(4);
  expect(result.levelOneSpawned).toHaveLength(2);
  expect(result.levelOneSpawned.every(cop => cop.targetKind === "heat")).toBe(true);
  expect(result.levelOneSpawned.every(cop => cop.distance >= 220 && cop.distance <= 1_100)).toBe(true);

  expect(result.levelTwoInitial.desiredUnits).toBe(2);
  expect(result.levelTwoInitial.reservedOfficers).toBe(4);
  expect(result.levelTwoInitial.units.every(unit => unit.role === "pursuit")).toBe(true);
  expect(result.totalTargetAtTwo).toBe(8);
  expect(result.desiredFootAtTwo).toBe(4);
  expect(result.pursuit.role).toBe("pursuit");
  expect(result.pursuit.visible).toBe(true);
  expect(
    result.pursuit.officersDismounted,
    JSON.stringify({ focus: result.focus, pursuit: result.pursuit, separation: result.pursuitSeparation }, null, 2)
  ).toBe(true);
  expect(result.levelTwoOfficerCounts).toHaveLength(2);
  expect(result.levelTwoOfficerCounts.every(unit => unit.role === "pursuit")).toBe(true);
  expect(result.levelTwoOfficerCounts.every(unit => unit.officers === 2)).toBe(true);
  expect(result.aggressionAfterLevelTwo).not.toBeNull();
  expect(result.aggressionAfterLevelTwo.boostedMoves).toBeGreaterThan(0);
  expect(result.aggressionAfterLevelTwo.lastMove.appliedSpeed).toBeGreaterThan(
    result.aggressionAfterLevelTwo.lastMove.requestedSpeed
  );

  expect(result.levelThreeInitial.desiredUnits).toBe(3);
  expect(result.levelThreeInitial.units.filter(unit => unit.role === "pursuit")).toHaveLength(2);
  expect(result.levelThreeInitial.units.filter(unit => unit.role === "roadblock")).toHaveLength(1);
  expect(result.totalTargetAtThree).toBe(12);
  expect(result.desiredFootAtThree).toBe(result.totalTargetAtThree - result.levelThreeInitial.reservedOfficers);
  expect(result.roadblock.arrived).toBe(true);
  expect(result.roadblock.status).toBe("officers-deployed");
  expect(result.roadblock.officersDismounted).toBe(true);
  expect(result.roadblockOfficers).toHaveLength(2);
  expect(result.roadblockOfficers.every(officer => officer.role === "roadblock")).toBe(true);
  expect(Math.abs(Math.cos(result.roadblock.angle))).toBeLessThan(0.12);
  expect(result.blocksAtRoadblock).toBe(true);
  expect(result.aggressionAfterLevelThree.boostedMoves).toBeGreaterThanOrEqual(
    result.aggressionAfterLevelTwo.boostedMoves
  );

  expect(result.disabled.disabled).toBe(true);
  expect(result.disabled.status).toBe("disabled");
  expect(result.disabled.officerIds).toHaveLength(2);
  expect(result.rooftop.activeUnits).toBe(3);
  expect(result.rooftop.units.every(unit => unit.visible === false)).toBe(true);
  expect(result.abandonedMemory.vehicleId).toBe("refuge_compact");
  expect(result.totalPolice).toBeGreaterThanOrEqual(12);
  expect(pageErrors).toEqual([]);
});
