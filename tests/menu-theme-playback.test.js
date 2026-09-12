import test from 'node:test';
import assert from 'node:assert/strict';
import {createMenuThemePlayback} from '../phaser/src/audio/MenuThemePlayback.js';
import {TitleScreenAudioGate} from '../phaser/src/ui/TitleScreenAudioGate.js';

function harness() {
  let now=0, sequence=0;
  const frames=new Map(),timers=new Map();
  const win={requestAnimationFrame(fn){frames.set(++sequence,fn);return sequence;},cancelAnimationFrame(id){frames.delete(id);},
    setTimeout(fn,delay){timers.set(++sequence,{fn,at:now+delay});return sequence;},clearTimeout(id){timers.delete(id);}};
  const media={paused:true,volume:.28,currentTime:0,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
  const playback=createMenuThemePlayback(media,{windowRef:win,clock:{now:()=>now}});
  return {media,playback,win,frames,timers,advance(ms,render=true){now+=ms;
    if(render){const copy=[...frames.values()];frames.clear();for(const fn of copy)fn(now);}
    for(const [id,entry] of [...timers])if(entry.at<=now){timers.delete(id);entry.fn();}
  }};
}
test('theme fades smoothly and ends with the shared media paused',async()=>{
  const h=harness();await h.playback.start();h.playback.fadeOut(400);h.advance(200);assert.equal(h.media.volume,.14);
  h.advance(200);assert.equal(h.media.paused,true);assert.equal(h.media.currentTime,0);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
});
test('title music stops even when animation frames never run',async()=>{
  const h=harness();await h.playback.start();h.playback.fadeOut(400);h.advance(451,false);assert.equal(h.media.paused,true);assert.equal(h.frames.size,0);
});
test('handoff stop cancels the fade immediately and a stale callback cannot affect a later start',async()=>{
  const h=harness();await h.playback.start();h.playback.fadeOut();const stale=[...h.frames.values()][0];h.playback.stop();
  assert.equal(h.media.paused,true);await h.playback.start();stale(10000);assert.equal(h.media.paused,false);assert.equal(h.media.volume,.28);
});
test('late play resolution cannot restart the menu theme after New Night',async()=>{
  const h=harness();let resolve;h.media.play=()=>new Promise(done=>{resolve=()=>{h.media.paused=false;done();};});
  const start=h.playback.start();h.playback.stop();resolve();assert.equal(await start,false);assert.equal(h.media.paused,true);
});
test('audio gate stop preserves its final state against late unlock completion',async()=>{
  const h=harness();let resolve;h.win.NBD_MAIN_MENU_THEME={start:()=>new Promise(done=>{resolve=done;}),stop:h.playback.stop};
  const gate=new TitleScreenAudioGate({documentRef:null,windowRef:h.win});gate.waitPromise=Promise.resolve();gate.unlock();gate.stop();resolve(true);
  await Promise.resolve();assert.equal(h.win.NBD_TITLE_AUDIO_GATE_STATE,'stopped');
});
