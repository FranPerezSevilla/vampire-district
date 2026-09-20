import test from 'node:test';
import assert from 'node:assert/strict';
import {buildings,roads,roadSegments,roadJunctions,roadTransitions,sidewalks,crosswalks,pointInCitySurface,pointInsideBuilding,pointOnRoadSurface,pointOnPedestrianSurface,CITY_WORLD} from '../phaser/src/data/district.js';
test('indexed city surface queries preserve exact whole-city and edge results',()=>{
 const points=[];for(let y=0;y<3200;y+=79)for(let x=0;x<4200;x+=83)points.push([x,y]);
 for(const a of [...buildings,...sidewalks,...roadSegments])for(const dx of [0,a.w])for(const dy of [0,a.h])points.push([a.x+dx,a.y+dy]);
 const road=[...roads,...roadSegments,...roadJunctions,...roadTransitions];
 for(const [x,y] of points){
 const inside=buildings.some(a=>pointInCitySurface(x,y,a));const onroad=road.some(a=>pointInCitySurface(x,y,a));
 assert.equal(pointInsideBuilding(x,y),inside);assert.equal(pointOnRoadSurface(x,y),onroad);
 const world=x>=(CITY_WORLD.x||0)&&y>=(CITY_WORLD.y||0)&&x<=(CITY_WORLD.x||0)+(CITY_WORLD.width??CITY_WORLD.w)&&y<=(CITY_WORLD.y||0)+(CITY_WORLD.height??CITY_WORLD.h);
 assert.equal(pointOnPedestrianSurface(x,y),world&&!inside&&(crosswalks.some(a=>pointInCitySurface(x,y,a))||sidewalks.some(a=>pointInCitySurface(x,y,a))||!onroad));
 }
});
