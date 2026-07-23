import { campaign } from "../campaign/preload.js";
import { VehicleMaintenanceUiSystem } from "./VehicleMaintenanceUiSystem.js";

function attachVehicleMaintenance() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  if (!scene?.vehicleSystem
    || !scene?.inputSystem
    || !scene?.campaignCheckpointSystem
    || !uiScene?.dom?.root
    || !campaign?.vehicleMaintenance) {
    window.setTimeout(attachVehicleMaintenance, 16);
    return;
  }
  if (scene.vehicleMaintenanceUiSystem) return;

  const maintenance = new VehicleMaintenanceUiSystem(
    scene,
    uiScene,
    campaign,
    campaign.vehicleMaintenance
  );
  scene.vehicleMaintenanceUiSystem = maintenance;
  const api = Object.freeze({
    snapshot: () => maintenance.snapshot(),
    open: () => maintenance.open(),
    close: () => maintenance.close(),
    repair: vehicleId => maintenance.perform("repair", vehicleId),
    recover: vehicleId => maintenance.perform("recover", vehicleId)
  });
  window.NBD_VEHICLE_MAINTENANCE = api;
  window.NBD_VEHICLE_MAINTENANCE_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:vehicle-maintenance-ready", {
    detail: maintenance.snapshot()
  }));

  scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, () => {
    maintenance.destroy();
    scene.vehicleMaintenanceUiSystem = null;
    if (window.NBD_VEHICLE_MAINTENANCE === api) delete window.NBD_VEHICLE_MAINTENANCE;
    window.NBD_VEHICLE_MAINTENANCE_READY = false;
  });
}

window.NBD_VEHICLE_MAINTENANCE_READY = false;
attachVehicleMaintenance();
