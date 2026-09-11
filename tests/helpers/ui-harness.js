import { EventEmitter } from 'node:events';
import { CampaignSystem } from '../../phaser/src/campaign/CampaignSystem.js';
import { VampireRuntime } from '../../phaser/src/vampire/VampireRuntime.js';
import { InteractionSystem } from '../../phaser/src/systems/InteractionSystemCore.js';
import { createEmptyInputFrame } from '../../phaser/src/input/actions.js';
import { buildings, CITY_WORLD } from '../../phaser/src/data/district.js';

// Native scene lifecycle harness; it does not emulate pixels, layout or Phaser's renderer.
export async function uiHarness() {
  globalThis.Phaser ||= { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown', POST_UPDATE: 'postupdate' } }, Math: { Distance: { Between: (x,y,a,b) => Math.hypot(x-a,y-b) } } };
  const { UIScene } = await import('../../phaser/src/scenes/UIScene.js');
  const campaign = new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 1000 });
  const registry = new Map();
  const scene = { campaignSystem: campaign, registry, events: new EventEmitter(), currentLayer: 0,
    player: { x: 1540, y: 1575 }, currentInputFrame: createEmptyInputFrame({ worldEnabled: true }),
    canStandAt: (x, y) => x >= 4 && y >= 4 && x <= CITY_WORLD.width-4 && y <= CITY_WORLD.height-4 && !buildings.some(b=>x>=b.x-4&&x<=b.x+b.w+4&&y>=b.y-4&&y<=b.y+b.h+4),
    npcSystem: { npcs: [], createNpc: def => ({...def}), rebuildSpatialIndex() {} },
    playerDamageSystem: { state: { vitality: 100 }, isDead() { return this.state.vitality <= 0; }, restoreVitality(amount) { this.state.vitality = Math.min(100,this.state.vitality+amount); } },
    powersSystem: { addHunger(amount) { scene.feedingSystem.hunger += amount; } },
    feedingSystem: { hunger: 50, isActive: () => false, relieveHunger(amount) { this.hunger=Math.max(0,this.hunger-amount); } }
  };
  scene.interactionSystem = new InteractionSystem(scene);
  let paused = false, resets = 0;
  scene.inputSystem = { resetWorldEdges() { resets++; }, sceneBlocked: () => Boolean(registry.get('uiPaused') || registry.get('uiKeyboardOwned') || registry.get('taskRevealActive')) };
  const ui = new UIScene();
  ui.registry = registry; ui.time = {now: 1000}; ui.events = new EventEmitter();
  ui.scene = { get: key => key === 'GameScene' ? scene : ui,
    pause() { paused=true; }, resume() { paused=false; }, isPaused: () => paused };
  scene.vampireRuntime = new VampireRuntime(scene);
  scene.vampireRuntime.update(.01,scene.currentInputFrame);
  ui.refresh();
  return {ui, scene, runtime: scene.vampireRuntime, v: campaign.vampire, campaign, registry,
    paused:()=>paused, resets:()=>resets,
    step() { if(paused) return false; scene.currentInputFrame=createEmptyInputFrame({worldEnabled:!scene.inputSystem.sceneBlocked()}); scene.vampireRuntime.update(.01,scene.currentInputFrame); scene.events.emit('postupdate'); return true; },
    destroy() { ui.cancelPendingAction(); scene.vampireRuntime.destroy(); ui.store.destroy(); }
  };
}
export function keyEvent(code, target = null) {
  return {code,target,repeat:false,defaultPrevented:false,stopped:false,
    preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
}
