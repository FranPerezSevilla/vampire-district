import test from 'node:test';
import assert from 'node:assert/strict';

import { createTrafficMultiAgentRouteRuntime } from '../phaser/src/streaming/TrafficMultiAgentRouteRuntimePolicy.js';
import { trafficJunctionApproach } from '../phaser/src/streaming/TrafficJunctionFlowPolicy.js';

function topology() {
  return {
    nodes: { j1: { id: 'j1', x: 100, y: 0, trimDistance: 20, maximumRoadWidth: 40 } },
    laneIds: ['west-in','north-in','east-out','south-out'],
    lanes: {
      'west-in': { id:'west-in', sourceRoadEdgeId:'road-west', districtId:'district-west', direction:'forward', points:[{x:0,y:0},{x:80,y:0}] },
      'north-in': { id:'north-in', sourceRoadEdgeId:'road-north', districtId:'district-north', direction:'forward', points:[{x:100,y:-100},{x:100,y:-20}] },
      'east-out': { id:'east-out', sourceRoadEdgeId:'road-east', districtId:'district-east', direction:'forward', points:[{x:120,y:0},{x:220,y:0}] },
      'south-out': { id:'south-out', sourceRoadEdgeId:'road-south', districtId:'district-south', direction:'forward', points:[{x:100,y:20},{x:100,y:120}] }
    },
    transitionIds:['west-east','north-south'],
    transitions:{
      'west-east':{id:'west-east',nodeId:'j1',incomingLaneId:'west-in',outgoingLaneId:'east-out',preferred:true,requiresConnector:true},
      'north-south':{id:'north-south',nodeId:'j1',incomingLaneId:'north-in',outgoingLaneId:'south-out',preferred:true,requiresConnector:true}
    },
    junctionConnectors:{
      connectorIds:['c-we','c-ns'],
      connectors:{
        'c-we':{id:'c-we',transitionId:'west-east',nodeId:'j1',activationSafe:true,rejectionReasons:[],points:[{x:80,y:0},{x:100,y:0},{x:120,y:0}],length:40},
        'c-ns':{id:'c-ns',transitionId:'north-south',nodeId:'j1',activationSafe:true,rejectionReasons:[],points:[{x:100,y:-20},{x:100,y:0},{x:100,y:20}],length:40}
      },
      directHandoffTransitionIds:[]
    }
  };
}


function macroGraph() {
  return {
    nodeIds: ["district-west", "district-north", "district-east", "district-south"],
    nodes: {
      "district-west": { id: "district-west", center: { x: 9000, y: 9000 } },
      "district-north": { id: "district-north", center: { x: 9100, y: 9100 } },
      "district-east": { id: "district-east", center: { x: 9200, y: 9200 } },
      "district-south": { id: "district-south", center: { x: 9300, y: 9300 } }
    },
    edgeIds: ["west", "north"],
    edges: {
      west: { id: "west", a: "district-west", b: "district-east", sourceRoadEdgeIds: ["road-west"] },
      north: { id: "north", a: "district-north", b: "district-south", sourceRoadEdgeIds: ["road-north"] }
    }
  };
}

function materializer(topologyValue) {
  const pool = [];
  return {
    lanes:{localTopology:topologyValue},
    pool,
    assignments:new Map(pool.map(slot=>[slot.tokenId,slot])),
    scene:{
      vehicleSystem:{vehicles:[],isDriving:()=>false},
      player:{x:100,y:0}
    }
  };
}

function runtimeFixture() {
  const localTopology = topology();
  const trafficFlows = new Map([
    ['west',{edgeId:'west',phases:[0.99],tokenCount:1}],
    ['north',{edgeId:'north',phases:[0.99],tokenCount:1}]
  ]);
  const materialized = materializer(localTopology);
  const runtime = createTrafficMultiAgentRouteRuntime({
    trafficFlows,
    macroGraph:macroGraph(),
    topology:localTopology,
    speed:100,
    reservationStaleAfterSeconds:5,
    materializer:materialized
  });
  return {runtime, materialized};
}

function agent(runtime, id) { return runtime.agents().find(item=>item.tokenId===id); }

test('runtime stops every approach before the conflict area and admits only after the player clears it', () => {
  const {runtime, materialized} = runtimeFixture();
  const initial = runtime.agents();
  assert.ok(initial.every(item=>item.stageProgress < 0.8), 'seeded cars are moved to body-safe stop lines before first materialization');

  let state = runtime.step(0.1);
  assert.equal(state.routeReservationCount, 0);
  assert.equal(state.blockedAgentCount, 2);
  assert.ok(state.blocked.every(item=>item.reason==='junction-yield'));
  assert.ok(runtime.agents().every(item=>item.stage==='lane'));

  materialized.scene.player = {x:1000,y:1000};
  state = runtime.step(0.05);
  assert.equal(state.routeReservationCount, 1);
  assert.equal(state.junctionFlowActive, true);
  assert.equal(runtime.agents().filter(item=>item.stage==='connector').length, 0, 'grant may precede physical entry by a short approach');

  state = runtime.step(0.2);
  assert.equal(runtime.agents().filter(item=>item.stage==='connector').length, 1);
  assert.equal(state.routeReservationCount, 1);
  assert.equal(runtime.agents().filter(item=>item.stage==='lane' && item.currentLaneId.endsWith('-in')).length, 1);

  runtime.destroy();
});

test('reservation is not transferred at connector exit; it remains until full outgoing clearance', () => {
  const {runtime, materialized} = runtimeFixture();
  materialized.scene.player = {x:1000,y:1000};

  runtime.step(0.05);
  runtime.step(0.2);
  let owner = runtime.snapshot().routeReservations[0].tokenId;
  let other = owner === 'west#0' ? 'north#0' : 'west#0';
  assert.equal(agent(runtime, owner).stage, 'connector');

  let state = runtime.step(0.36);
  assert.equal(agent(runtime, owner).stage, 'lane');
  assert.ok(['east-out','south-out'].includes(agent(runtime, owner).currentLaneId));
  assert.equal(state.routeReservations[0].tokenId, owner, 'ownership survives the centre crossing the connector end');
  assert.equal(agent(runtime, other).stage, 'lane');

  state = runtime.step(0.2);
  assert.equal(state.routeReservations[0].tokenId, owner, '20 world units into the exit lane is not full-body clearance');

  state = runtime.step(0.2);
  assert.ok(state.junctionClearanceReleases >= 1);
  assert.ok(state.routeReservationCount <= 1);
  assert.equal(runtime.agents().filter(item=>item.stage==='connector').length <= 1, true);

  runtime.destroy();
});

import { installTrafficMultiAgentRouteRuntimePolicy } from '../phaser/src/streaming/TrafficMultiAgentRouteRuntimePolicy.js';

function installedPolicyFixture() {
  const localTopology = topology();
  const trafficFlows = new Map([
    ['west',{edgeId:'west',phases:[0.1],tokenCount:1}]
  ]);
  const slot = {
    slotIndex:0,
    tokenId:null,
    x:0,
    y:0,
    angle:0,
    radius:14,
    archetype:{width:28,height:14},
    container:{active:true}
  };
  const materialized = {
    lanes:{localTopology},
    macro:{graph:macroGraph(),trafficFlows},
    pool:[slot],
    assignments:new Map(),
    scene:{
      vehicleSystem:{vehicles:[],isDriving:()=>false},
      player:{x:1000,y:1000},
      trafficLocalBehaviorSystem:{applyDecision(target){return target;}},
      trafficSteeringPresentationSystem:{applyPresentation(target){return target;}}
    },
    trafficTokens(){return[];},
    updateSlot(target, token){
      target.tokenId=token.tokenId;
      target.x=token.x;
      target.y=token.y;
      target.angle=token.angle;
      target.routeActive=token.routeActive;
      target.routeStage=token.routeStage;
      target.routeLaneId=token.routeLaneId;
      target.routeHop=token.routeHop;
      target.routeStageProgress=token.routeStageProgress;
      this.assignments.set(token.tokenId,target);
      return target;
    },
    reconcile(){
      for(const token of this.trafficTokens()) this.updateSlot(slot,token);
      return true;
    }
  };
  return {materialized, slot};
}

test('physical contact hold pauses compiler-route progression instead of letting the route base tunnel through a pile', () => {
  const {materialized, slot} = installedPolicyFixture();
  const policy = installTrafficMultiAgentRouteRuntimePolicy(materialized, {speed:100, defaultEnabled:false});
  policy.start();
  const before = policy.runtime().agents()[0].stageProgress;
  slot.physicalHoldSeconds = 0.5;
  policy.step(0.05);
  const during = policy.runtime().agents()[0].stageProgress;
  assert.equal(during, before);

  slot.physicalHoldSeconds = 0;
  policy.step(0.05);
  const after = policy.runtime().agents()[0].stageProgress;
  assert.ok(after > during);
  policy.destroy();
});


test('dense multi-approach traffic queues upstream and never admits two conflicting connector occupants', () => {
  const localTopology = topology();
  const trafficFlows = new Map([
    ['west', { edgeId: 'west', phases: [0.99, 0.97], tokenCount: 2 }],
    ['north', { edgeId: 'north', phases: [0.99, 0.97], tokenCount: 2 }]
  ]);
  const materialized = materializer(localTopology);
  const runtime = createTrafficMultiAgentRouteRuntime({
    trafficFlows,
    macroGraph: macroGraph(),
    topology: localTopology,
    speed: 100,
    reservationStaleAfterSeconds: 5,
    materializer: materialized
  });

  for (let index = 0; index < 20; index++) {
    const state = runtime.step(0.05);
    assert.equal(state.routeReservationCount, 0);
    assert.equal(runtime.agents().some(item => item.stage === 'connector'), false);
    for (const current of runtime.agents()) {
      const approach = trafficJunctionApproach(localTopology, current);
      if (approach) assert.ok(current.stageProgress <= approach.stopProgress + 0.000001);
    }
  }

  materialized.scene.player = { x: 1000, y: 1000 };
  let maxConnectorOccupants = 0;
  let maxReservations = 0;
  let totalTransitions = 0;
  for (let index = 0; index < 300; index++) {
    const state = runtime.step(0.05);
    const connectorOccupants = runtime.agents().filter(item => item.stage === 'connector').length;
    maxConnectorOccupants = Math.max(maxConnectorOccupants, connectorOccupants);
    maxReservations = Math.max(maxReservations, state.routeReservationCount);
    totalTransitions = Math.max(totalTransitions, state.totalStageTransitions);
    assert.ok(connectorOccupants <= 1, `conflicting connector occupancy at step ${index}`);
    assert.ok(state.routeReservationCount <= 1, `multiple junction reservations at step ${index}`);
    for (const blocked of state.blocked.filter(item => item.reason === 'junction-yield')) {
      const current = runtime.agents().find(item => item.tokenId === blocked.tokenId);
      const approach = trafficJunctionApproach(localTopology, current);
      if (approach) assert.ok(current.stageProgress <= approach.stopProgress + 0.000001);
    }
  }

  assert.equal(maxConnectorOccupants, 1);
  assert.equal(maxReservations, 1);
  assert.ok(totalTransitions >= 8, 'all four cars should traverse lane->connector->outgoing lane');
  assert.ok(runtime.snapshot().junctionClearanceReleases >= 4);
  runtime.destroy();
});
