// Keep volumetric street actors between ground presentation and buildings. Rank, rather
// than raw world Y, avoids re-sorting the whole Phaser display list every time
// a car moves while retaining its place in the queue.
const VEHICLE_DEPTH = 46;

function collect(vehicles, ordered) {
  if (!vehicles) return;
  for (const vehicle of vehicles) {
    const container = vehicle.container;
    if (container?.visible && Number.isFinite(container.y)
        && Number.isFinite(container.x) && typeof container.setDepth === 'function') {
      ordered.push(container);
    }
  }
}

function groundOrder(left, right) {
  // Ground contact, not the projected roof or rotated body bounds. X breaks
  // equal-Y ties; stable sort preserves source/slot order at identical anchors.
  return left.y - right.y || left.x - right.x;
}

export function updateVehicleDrawOrder(scene, ordered) {
  ordered.length = 0;
  collect(scene.vehicleSystem?.vehicles, ordered);
  collect(scene.trafficMaterializationSystem?.pool, ordered);
  collect(scene.motorizedPoliceSystem?.slots, ordered);
  for(const prop of scene.streetFurnitureSystem?.dumpsters||[])if(prop.visual?.stack?.willRender(scene.cameras.main)&&prop.visual.container.visible)ordered.push(prop.visual.container);
  for(const prop of scene.buildingParallax?.lamps?.stacks||[])if(prop.willRender(scene.cameras.main))ordered.push(prop);
  // The same pass now handles stacked people walking around volumetric cars.
  // Keep corpses and non-street/traversal presentation in their original bands.
  for (const npc of scene.npcSystem?.npcs || []) {
    if (!npc.characterView?.stack || !npc.container) continue;
    if (scene.currentLayer === 0 && !npc.dead && npc.container.visible) ordered.push(npc.container);
    else if (npc.container.depth !== 42) npc.container.setDepth(42);
  }
  if (scene.playerCharacterView?.stack && scene.player) {
    if (scene.currentLayer === 0 && !scene.transitionSystem?.active && scene.player.visible) ordered.push(scene.player);
    else if (scene.player.depth !== 50) scene.player.setDepth(50);
  }
  ordered.sort(groundOrder);
  for (let index = 0; index < ordered.length; index++) {
    // Bounded to [46,47), independent of city size or local vehicle count.
    const depth = VEHICLE_DEPTH + index / (1024 + index);
    const container = ordered[index];
    if (container.depth !== depth) container.setDepth(depth);
  }
}
