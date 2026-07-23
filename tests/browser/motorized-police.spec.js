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

test("wanted levels deploy cruisers, reserve officers, form a partial roadblock and continue on foot", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForMotorizedPolice(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 1688, y: 338 }, "Motorized police regression: Foundry interception.");
    await window.NBD_CITY_STREAM.forceFocus(1688, 338);

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

    scene.exposureSystem.forceLevel(2, "Motorized police level-two test.");
    window.NBD_MOTORIZED_POLICE.reconcile();
    const levelTwoInitial = window.NBD_MOTORIZED_POLICE.snapshot();
    const totalTargetAtTwo = scene.policeSystem.desiredCount(2);
    const desiredFootAtTwo = scene.policeSystem.footDesiredCount(2);
    const levelTwoAfterTravel = window.NBD_MOTORIZED_POLICE.step(12);
    const pursuit = levelTwoAfterTravel.units[0];
    const pursuitOfficers = scene.policeSystem.allPolice()
      .filter(cop => cop.motorizedUnitId === pursuit.id)
      .map(cop => ({ id: cop.id, chasingPlayer: cop.chasingPlayer, unitId: cop.motorizedUnitId }));

    scene.exposureSystem.forceLevel(3, "Motorized police level-three test.");
    window.NBD_MOTORIZED_POLICE.reconcile();
    const levelThreeInitial = window.NBD_MOTORIZED_POLICE.snapshot();
    const totalTargetAtThree = scene.policeSystem.desiredCount(3);
    const desiredFootAtThree = scene.policeSystem.footDesiredCount(3);
    const levelThreeAfterTravel = window.NBD_MOTORIZED_POLICE.step(14);
    const roadblock = levelThreeAfterTravel.units.find(unit => unit.role === "roadblock");
    const roadblockOfficers = scene.policeSystem.allPolice()
      .filter(cop => cop.motorizedUnitId === roadblock.id)
      .map(cop => ({ id: cop.id, unitId: cop.motorizedUnitId, role: cop.motorizedRole }));
    const blocksAtRoadblock = window.NBD_MOTORIZED_POLICE.blocks(roadblock.x, roadblock.y, 5);

    window.NBD_MOTORIZED_POLICE.damage(roadblock.id, roadblock.maxHealth + 1);
    const disabled = window.NBD_MOTORIZED_POLICE.snapshot().units.find(unit => unit.id === roadblock.id);

    scene.switchLayer(1, { x: 1688, y: 338 }, "Motorized police regression: rooftop escape.");
    window.NBD_MOTORIZED_POLICE.step(0.1);
    const rooftop = window.NBD_MOTORIZED_POLICE.snapshot();

    scene.switchLayer(0, { x: 1688, y: 338 }, "Motorized police regression: abandoned suspect car memory.");
    const playerVehicle = scene.vehicleSystem.vehicle("refuge_compact");
    playerVehicle.x = 1688;
    playerVehicle.y = 338;
    playerVehicle.container?.setPosition?.(playerVehicle.x, playerVehicle.y);
    scene.vehicleSystem.currentVehicleId = playerVehicle.id;
    window.NBD_MOTORIZED_POLICE.step(0.1);
    scene.vehicleSystem.currentVehicleId = null;
    window.NBD_MOTORIZED_POLICE.step(0.1);
    const abandonedMemory = window.NBD_MOTORIZED_POLICE.snapshot().suspectMemory;

    return {
      levelTwoInitial,
      totalTargetAtTwo,
      desiredFootAtTwo,
      levelTwoAfterTravel,
      pursuit,
      pursuitOfficers,
      levelThreeInitial,
      totalTargetAtThree,
      desiredFootAtThree,
      levelThreeAfterTravel,
      roadblock,
      roadblockOfficers,
      blocksAtRoadblock,
      disabled,
      rooftop,
      abandonedMemory,
      totalPolice: scene.policeSystem.allPolice().length
    };
  });

  expect(result.levelTwoInitial.desiredUnits).toBe(1);
  expect(result.levelTwoInitial.reservedOfficers).toBe(2);
  expect(result.totalTargetAtTwo).toBe(5);
  expect(result.desiredFootAtTwo).toBe(3);
  expect(result.pursuit.role).toBe("pursuit");
  expect(result.pursuit.visible).toBe(true);
  expect(result.pursuit.officersDismounted).toBe(true);
  expect(result.pursuitOfficers).toHaveLength(2);
  expect(result.pursuitOfficers.every(officer => officer.unitId === result.pursuit.id)).toBe(true);

  expect(result.levelThreeInitial.desiredUnits).toBe(2);
  expect(result.levelThreeInitial.units.some(unit => unit.role === "roadblock")).toBe(true);
  expect(result.totalTargetAtThree).toBe(7);
  expect(result.desiredFootAtThree).toBe(5);
  expect(result.roadblock.arrived).toBe(true);
  expect(result.roadblock.status).toBe("officers-deployed");
  expect(result.roadblock.officersDismounted).toBe(true);
  expect(result.roadblockOfficers).toHaveLength(2);
  expect(result.roadblockOfficers.every(officer => officer.role === "roadblock")).toBe(true);
  expect(Math.abs(Math.abs(result.roadblock.angle) - Math.PI / 2)).toBeLessThan(0.12);
  expect(result.blocksAtRoadblock).toBe(true);

  expect(result.disabled.disabled).toBe(true);
  expect(result.disabled.status).toBe("disabled");
  expect(result.disabled.officerIds).toHaveLength(2);
  expect(result.rooftop.activeUnits).toBe(2);
  expect(result.rooftop.units.every(unit => unit.visible === false)).toBe(true);
  expect(result.abandonedMemory.vehicleId).toBe("refuge_compact");
  expect(result.totalPolice).toBeGreaterThanOrEqual(6);
  expect(pageErrors).toEqual([]);
});
