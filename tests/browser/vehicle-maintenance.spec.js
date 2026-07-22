import { expect, test } from "@playwright/test";

async function waitForMaintenance(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_VEHICLES_READY
    && window.NBD_VEHICLE_MAINTENANCE_READY
    && window.NBD_VEHICLE_MAINTENANCE
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.vehicleSystem
  ));
}

test.describe.configure({ timeout: 75_000 });

test("refuge garage repairs once, blocks wanted recovery and tows an owned wreck", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForMaintenance(page);

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const campaign = window.NBD_CAMPAIGN_SYSTEM;
    const api = window.NBD_VEHICLE_MAINTENANCE;
    const vehicle = scene.vehicleSystem.vehicle("refuge_compact");
    scene.vehicleSystem.exitVehicle({ force: true });
    scene.switchLayer(0, { x: 280, y: 326 }, "Vehicle maintenance browser test.");
    scene.exposureSystem.value = 0;
    scene.policeSystem.localHeat = Object.create(null);
    campaign.wallet.credit(600, { source: "browser-test", reason: "maintenance-fixture" });

    vehicle.x = 304;
    vehicle.y = 326;
    vehicle.angle = 0;
    vehicle.travelAngle = 0;
    vehicle.driftAngle = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.speed = 0;
    vehicle.health = vehicle.archetype.maxHealth;
    vehicle.disabled = false;
    vehicle.parked = true;
    vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(0).setAlpha(1);
    vehicle.visual.hood.setFillStyle(vehicle.archetype.trim, 0.38);
    scene.vehicleSystem.persistVehicle(vehicle);
    scene.vehicleSystem.damageVehicle(vehicle.id, 22, { reason: "maintenance-browser-test" });

    const interaction = scene.vehicleMaintenanceUiSystem.collectInteractions()[0];
    const opened = api.open();
    const overlayVisible = Boolean(document.querySelector(".vehicle-maintenance"));
    const before = api.snapshot();
    const quoteBefore = before.vehicles.find(item => item.vehicleId === vehicle.id);
    const balanceBeforeRepair = campaign.wallet.balance();
    const ledgerBeforeRepair = campaign.state.ledger.length;
    const repaired = api.repair(vehicle.id);
    const afterRepair = api.snapshot();
    const campaignAfterRepair = campaign.vehicles.condition(vehicle);
    const liveAfterRepair = window.NBD_VEHICLES.snapshot().vehicles.find(item => item.id === vehicle.id);
    const ledgerAfterRepair = campaign.state.ledger.length;
    const balanceAfterRepair = campaign.wallet.balance();
    const repeatedRepair = api.repair(vehicle.id);
    const afterRepeatedRepair = {
      balance: campaign.wallet.balance(),
      ledger: campaign.state.ledger.length
    };
    api.close();

    vehicle.x = 1400;
    vehicle.y = 760;
    vehicle.angle = 1.2;
    vehicle.travelAngle = 1.2;
    vehicle.parked = true;
    vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);
    scene.vehicleSystem.persistVehicle(vehicle);
    scene.vehicleSystem.damageVehicle(vehicle.id, vehicle.archetype.maxHealth + 1, {
      reason: "maintenance-recovery-test"
    });

    scene.exposureSystem.value = 100;
    const balanceBeforeBlocked = campaign.wallet.balance();
    const blockedRecovery = api.recover(vehicle.id);
    const blockedState = {
      balance: campaign.wallet.balance(),
      health: vehicle.health,
      x: vehicle.x,
      y: vehicle.y
    };

    scene.exposureSystem.value = 0;
    const recovered = api.recover(vehicle.id);
    const liveRecovered = window.NBD_VEHICLES.snapshot().vehicles.find(item => item.id === vehicle.id);
    const campaignRecovered = campaign.vehicles.condition(vehicle);
    const maintenanceAfterRecovery = api.snapshot();
    const lastLedger = campaign.state.ledger.at(-1);

    return {
      interaction: interaction && {
        id: interaction.id,
        type: interaction.type,
        label: interaction.label,
        detail: interaction.detail
      },
      opened,
      overlayVisible,
      quoteBefore,
      balanceBeforeRepair,
      ledgerBeforeRepair,
      repaired,
      afterRepair,
      campaignAfterRepair,
      liveAfterRepair,
      ledgerAfterRepair,
      balanceAfterRepair,
      repeatedRepair,
      afterRepeatedRepair,
      balanceBeforeBlocked,
      blockedRecovery,
      blockedState,
      recovered,
      liveRecovered,
      campaignRecovered,
      maintenanceAfterRecovery,
      lastLedger,
      overlayClosed: !document.querySelector(".vehicle-maintenance")
    };
  });

  expect(result.interaction).toMatchObject({
    id: "open_refuge_vehicle_garage",
    type: "vehicle-maintenance",
    label: "Open refuge garage"
  });
  expect(result.interaction.detail).toContain("repair or recover");
  expect(result.opened).toBe(true);
  expect(result.overlayVisible).toBe(true);
  expect(result.quoteBefore).toMatchObject({
    action: "repair",
    health: 50,
    maxHealth: 72,
    cost: 66,
    available: true
  });
  expect(result.repaired).toMatchObject({
    changed: true,
    code: "VEHICLE_REPAIRED",
    cost: 66,
    healthAfter: 72
  });
  expect(result.balanceAfterRepair).toBe(result.balanceBeforeRepair - 66);
  expect(result.ledgerAfterRepair).toBe(result.ledgerBeforeRepair + 1);
  expect(result.campaignAfterRepair.health).toBe(72);
  expect(result.liveAfterRepair.health).toBe(72);
  expect(result.liveAfterRepair.disabled).toBe(false);
  expect(result.repeatedRepair).toMatchObject({
    changed: false,
    code: "VEHICLE_REPAIR_NOT_NEEDED"
  });
  expect(result.afterRepeatedRepair.balance).toBe(result.balanceAfterRepair);
  expect(result.afterRepeatedRepair.ledger).toBe(result.ledgerAfterRepair);

  expect(result.blockedRecovery).toMatchObject({
    changed: false,
    code: "VEHICLE_MAINTENANCE_BLOCKED"
  });
  expect(result.blockedState.balance).toBe(result.balanceBeforeBlocked);
  expect(result.blockedState.health).toBe(0);
  expect(result.blockedState.x).toBe(1400);
  expect(result.blockedState.y).toBe(760);

  expect(result.recovered).toMatchObject({
    changed: true,
    code: "VEHICLE_RECOVERED",
    cost: 120,
    healthAfter: 26
  });
  expect(result.liveRecovered).toMatchObject({
    health: 26,
    disabled: false,
    parked: true,
    x: 304,
    y: 326
  });
  expect(result.campaignRecovered).toMatchObject({
    health: 26,
    disabled: false,
    parked: true,
    x: 304,
    y: 326,
    angle: 0
  });
  expect(result.maintenanceAfterRecovery.lastOperation).toMatchObject({
    action: "recover",
    vehicleId: "refuge_compact",
    cost: 120
  });
  expect(result.lastLedger).toMatchObject({
    type: "debit",
    source: "vehicle-maintenance",
    reason: "recover",
    amount: 120
  });
  expect(result.overlayClosed).toBe(true);
  expect(pageErrors).toEqual([]);
});
