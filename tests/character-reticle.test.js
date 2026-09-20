import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatSystem} from '../phaser/src/combat/CombatSystem.js';

test('reticle uses cursor world coordinates and keeps a constant screen size at different zooms',()=>{
 const combat=Object.create(CombatSystem.prototype),circles=[],widths=[];
 const g={lineStyle(w){widths.push(w);return this;},strokeCircle(x,y,r){circles.push([x,y,r]);return this;},beginPath(){},moveTo(){},lineTo(){},strokePath(){}};
 combat.graphics=g;combat.scene={cameras:{main:{zoom:1}},registry:{get:()=>false}};
 const frame={aimWorld:{x:241,y:175},reticleAlpha:.8};
 combat.drawAimIndicator(frame);
 assert.ok(circles.every(([x,y])=>x===241&&y===175));const radius=circles[0][2];
 circles.length=0;combat.scene.cameras.main.zoom=4;combat.drawAimIndicator(frame);
 assert.equal(circles[0][2]*4,radius);assert.ok(widths.length>0);
 combat.scene.registry.get=()=>true;circles.length=0;combat.drawAimIndicator(frame);
 assert.ok(circles[0][2]*4>radius);
});
