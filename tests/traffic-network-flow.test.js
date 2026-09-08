import test from "node:test";
import assert from "node:assert/strict";
import { createTrafficNetworkRuntime } from "./helpers/traffic-network-runtime.js";
import { orientedVehicleContact } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";

test("32 native cars sustain city-wide circulation through short links for three minutes", async () => {
  const network = await createTrafficNetworkRuntime();
  try {
    network.step(3600);
    assert.equal(network.records.size, 32);
    assert.equal(network.metrics().contacts, 0, "normal traffic must anticipate queues, not crash into them");
    assert.equal(network.metrics().overlaps, 0);
    for (const [tokenId, record] of network.records) {
      assert.ok(record.maxStop < 15, `${tokenId} stopped for ${record.maxStop.toFixed(1)}s`);
      assert.ok(record.hops >= 30, `${tokenId} stopped completing junctions`);
      assert.ok(record.lanes.size >= 25, `${tokenId} repeatedly circled a small neighbourhood`);
      assert.equal(record.identityChanges, 0, `${tokenId} was replaced to escape a blockage`);
    }
    assert.equal(network.route.snapshot().movementAuthority, "shared-vehicle-kinematics");
    for (const agent of network.route.runtime().agents()) {
      assert.ok(agent.completedJourneys >= 1, `${agent.tokenId} must reach its destination`);
      assert.equal(new Set(agent.journeyLaneIds).size, agent.journeyLaneIds.length);
    }
  } finally {
    network.destroy();
  }
});

test("native gunfire and a side impact provoke a bounded reaction, then the same driver recovers", async () => {
  const network = await createTrafficNetworkRuntime({ roadCount: 4 });
  try {
    network.step(200);
    const topology = network.materializer.lanes.localTopology;
    const agent = network.route.runtime().agents().find(candidate => {
      const slot = network.materializer.assignments.get(candidate.tokenId);
      return slot && candidate.stage === "lane" && topology.lanes[candidate.currentLaneId]
        && candidate.pose.speed > 50 && candidate.stageProgress < 0.7
        && [...network.materializer.assignments.values()].every(other => other === slot || Math.hypot(other.x - slot.x, other.y - slot.y) > 120);
    });
    assert.ok(agent, "a clear approach is required for the isolated side impact");
    const slot = network.materializer.assignments.get(agent.tokenId);
    network.scene.player = { x: slot.x + 40, y: slot.y + 40 };
    network.scene.events.emit("combat:projectile-fired", { source: "player" });
    assert.ok(network.route.snapshot().routeBehavior.vehicles.find(item => item.tokenId === agent.tokenId).panicSeconds > 0);
    network.scene.player = { x: 1540, y: 1515 };

    const normal = { x: -Math.sin(slot.angle), y: Math.cos(slot.angle) };
    const separation = (slot.archetype.height + 16) * 0.41 - 2;
    const vehicle = { id: "side-impact", x: slot.x - normal.x * separation, y: slot.y - normal.y * separation,
      angle: slot.angle, speed: 90, archetype: { width: 34, height: 16, mass: 1 } };
    const contact = orientedVehicleContact(vehicle, slot);
    assert.ok(contact);
    assert.equal(network.physical.pushContact(vehicle, vehicle, { slot, contact }), true);
    assert.ok(Math.hypot(slot.physicalOffsetX, slot.physicalOffsetY) > 0.35);
    const before = network.route.runtime().agents().find(item => item.tokenId === agent.tokenId);
    const impactPose = { x: slot.x, y: slot.y, angle: slot.angle };
    network.step();
    const held = network.route.runtime().agents().find(item => item.tokenId === agent.tokenId);
    assert.equal(held.routeHop, before.routeHop);
    assert.equal(held.pose.x, impactPose.x);
    assert.equal(held.pose.y, impactPose.y);
    assert.equal(held.pose.angle, impactPose.angle);
    assert.equal(held.adoptedImpacts, before.adoptedImpacts + 1);
    assert.equal(slot.physicalOffsetX, 0, "the impact becomes actual position, not an offset to erase later");
    const position = { x: slot.x, y: slot.y };
    network.step(100);
    assert.equal(network.materializer.assignments.get(agent.tokenId), slot);
    assert.ok(Math.hypot(slot.physicalOffsetX, slot.physicalOffsetY) <= 0.35);
    assert.ok(Math.hypot(slot.x - position.x, slot.y - position.y) > 30, "the driver must resume after the impact clears");
  } finally {
    network.destroy();
  }
});
