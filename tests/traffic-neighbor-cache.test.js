import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficDriverWorld} from '../phaser/src/streaming/TrafficDriverWorld.js';
import {TrafficLocalBehaviorSystem, nearestPointOnPolyline} from '../phaser/src/streaming/TrafficLocalBehaviorSystem.js';

test('cached regions retain exact live membership and first-blocker order through stream changes',()=>{
  const bodies=Array.from({length:90},(_,i)=>({id:`car-${i}`,tokenId:`car-${i}`,x:i%10*95,y:Math.floor(i/10)*95,container:{active:true}}));
  const materializer={assignments:new Map(bodies.slice(0,64).map(b=>[b.tokenId,b])),scene:{vehicleSystem:{vehicles:bodies.slice(64),isDriving:()=>false},player:{x:450,y:430}}};
  const world=createTrafficDriverWorld({lanes:{}},materializer),driver={tokenId:'car-30',pose:{x:450,y:430}};
  for(let frame=0;frame<80;frame++){
    // Include movements within a cell, across cells, active-state flips, slot
    // removal/reinsertion, source reordering and duplicate source membership.
    for(let i=0;i<bodies.length;i++){bodies[i].x+=(i%3-1)*5;bodies[i].y+=(i%4-2)*2;}
    bodies[20].container.active=frame%3!==0;
    if(frame===10)materializer.assignments.delete('car-12');
    if(frame===15)materializer.assignments.set('car-12',bodies[12]);
    if(frame===22)materializer.scene.vehicleSystem.vehicles.reverse();
    if(frame===23)materializer.scene.vehicleSystem.vehicles.push(bodies[4]);
    materializer.scene.player.x+=7;
    materializer.scene.vehicleSystem.isDriving=()=>frame>=40&&frame<60;
    world.prepare();
    bodies[6].x+=130;world.update(bodies[6]);
    for(const radius of [50,240,300]) for(let query=0;query<3;query++){
      driver.pose.x+=3;
      const scene=materializer.scene;
      const ordered=[...new Set([...materializer.assignments.values(),...scene.vehicleSystem.vehicles])];
      if(!scene.vehicleSystem.isDriving())ordered.push({id:'player',...scene.player});
      const expected=ordered.filter(b=>b.tokenId!==driver.tokenId&&b.container?.active!==false&&(b.x-driver.pose.x)**2+(b.y-driver.pose.y)**2<radius**2);
      assert.deepEqual(world.obstacles(driver,radius).map(b=>[b.id,b.x,b.y]),expected.map(b=>[b.id,b.x,b.y]));
    }
  }
});
test('building residency and bounds remain live alongside cached vehicle regions',()=>{
  const car={tokenId:'a',x:10,y:10},building={id:'wall',x:30,y:20,w:40,h:50};let buildings=[building];
  const materializer={assignments:new Map([['a',car]]),scene:{trafficPhysicalConsequencesSystem:{nearbyBuildings:()=>buildings}}};
  const world=createTrafficDriverWorld({lanes:{}},materializer),driver={tokenId:'b',pose:{x:0,y:0}};
  world.prepare();assert.equal(world.obstacles(driver)[1].x,50);
  building.x=40;assert.equal(world.obstacles(driver)[1].x,60);
  buildings=[];assert.deepEqual(world.obstacles(driver),[car]);
  materializer.assignments.clear();world.prepare();assert.deepEqual(world.obstacles(driver),[]);
});

test('shared lane projections keep per-car gaps and immediately observe obstacle movement',()=>{
  const system=Object.assign(Object.create(TrafficLocalBehaviorSystem.prototype),{laneTolerance:38,laneObstacleProjections:new WeakMap()});
  const lane={points:[{x:0,y:0},{x:300,y:0},{x:300,y:200}],length:500};
  const obstacle={x:180,y:12},first={visualTravel:.1},second={visualTravel:.2};
  const query=(state,radius)=>system.directLaneGap(state,lane,obstacle.x,obstacle.y,radius,obstacle);
  const original=(state,radius)=>system.directLaneGap(state,lane,obstacle.x,obstacle.y,radius);
  for(let i=0;i<40;i++){
    obstacle.x+=5;obstacle.y=i%5*4;
    assert.deepEqual(query(first,10),original(first,10));
    assert.deepEqual(query(second,25),original(second,25));
  }
  obstacle.y=300;assert.equal(query(first,10),null);
  system.laneObstacleProjections=null;obstacle.x=100;obstacle.y=0;
  assert.deepEqual(query(first,10),original(first,10));
});
test('projection sharing ends before decisions move vehicles, including failed decision batches',()=>{
  const obstacle={x:50,y:0},lane={points:[{x:0,y:0},{x:200,y:0}],length:200};
  const token={tokenId:'a'},slot={tokenId:'a'},state={visualTravel:0};let fail=false,applied=0;
  const system=Object.assign(Object.create(TrafficLocalBehaviorSystem.prototype),{
    ready:true,scene:{registry:{get:()=>false}},states:new Map(),materializer:{pool:[slot]},laneTolerance:38,
    tokenMap:()=>new Map([['a',token]]),stateFor:()=>state,syncAuthority:s=>s,
    decisionFor(){assert.ok(this.laneObstacleProjections);if(fail)throw new Error('decision failed');return this.directLaneGap(state,lane,obstacle.x,0,0,obstacle);},
    applyDecision(_slot,_state,_token,decision){assert.equal(this.laneObstacleProjections,null);assert.equal(decision.gap,obstacle.x);applied++;},
    processPlayerImpact(){},publish(){}
  });
  system.update();obstacle.x=100;system.update();assert.equal(applied,2);
  fail=true;assert.throws(()=>system.update(),/decision failed/);assert.equal(system.laneObstacleProjections,null);
});

test('compiled lane projections match uncached geometry at corners, tiny segments and exact ties',()=>{
  const shapes=[[],[{x:0,y:0}], [{x:0,y:0},{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
    [{x:0,y:0},{x:.00001,y:0},{x:50,y:50},{x:-30,y:70}]];
  for(const points of shapes){
    const system=Object.assign(Object.create(TrafficLocalBehaviorSystem.prototype),{laneCache:new Map(),junctionProjectionCache:new Map(),
      materializer:{lanes:{edges:{test:{forward:points,reverse:points}}}}});
    system.rebuildLaneCache();const lane=system.laneFor({edgeId:'test',direction:'forward'});
    for(let x=-60;x<=160;x+=10)for(let y=-60;y<=160;y+=10){
      assert.deepEqual(nearestPointOnPolyline(points,x,y,lane?.projectionGeometry),nearestPointOnPolyline(points,x,y));
    }
    if(points.length>=2){
      points[1]={x:77,y:-31};system.rebuildLaneCache();const rebuilt=system.laneFor({edgeId:'test',direction:'forward'});
      assert.notEqual(rebuilt,lane);
      assert.deepEqual(nearestPointOnPolyline(points,12,13,rebuilt.projectionGeometry),nearestPointOnPolyline(points,12,13));
    }
  }
});
