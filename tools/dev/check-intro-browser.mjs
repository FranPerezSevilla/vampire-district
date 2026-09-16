import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
mkdirSync('test-results/intro', {recursive:true});
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage({viewport:{width:1280,height:720}});
 if(process.argv.includes('--isolated')) await page.route('**/phaser/src/app-bootstrap.js', route=>route.fulfill({contentType:'text/javascript',body:`
 import {titleScreenAudioGate as gate} from './ui/TitleScreenAudioGate.js';
 import {titleScreenController as title} from './ui/TitleScreenController.js';
 import {createMenuThemePlayback} from './audio/MenuThemePlayback.js';
 window.NBD_MAIN_MENU_THEME=createMenuThemePlayback(document.getElementById('viceblood-main-menu-theme'));
 gate.waitForStart().then(()=>title.present());
 `}));
 page.on('pageerror', e => console.log('PAGE ERROR', e.message));
 page.on('console', m => { if(m.type()==='error') console.log('CONSOLE',m.text()); });
 page.on('response', r => { if(r.status()===404) console.log('MISSING',r.url()); });
 await page.goto('http://127.0.0.1:4173/');
 await page.waitForFunction(() => window.NBD_TITLE_AUDIO_GATE_STATE === 'waiting' || document.querySelector('#viceblood-title-screen')?.dataset.state==='failure', null, {timeout:90000});
 if(await page.evaluate(()=>document.querySelector('#viceblood-title-screen').dataset.state==='failure')) throw new Error(await page.locator('[data-title-boot-message]').textContent());
 await page.keyboard.press('Enter');
 await page.waitForFunction(() => {
  const v=document.getElementById('viceblood-intro-video');
  return !document.getElementById('viceblood-intro').hidden && v.currentTime>.1 && !v.paused;
 });
 assert.equal(await page.evaluate(()=>document.getElementById('viceblood-main-menu-theme').paused),true);
 assert.equal(await page.evaluate(()=>document.elementFromPoint(innerWidth/2,innerHeight/2)?.id),'viceblood-intro-video','the playing film must be in front of the title cover');
 const framing=await page.evaluate(()=>{const r=document.getElementById('viceblood-intro-video').getBoundingClientRect();return {ratio:r.width/r.height,top:r.top,bottom:innerHeight-r.bottom};});
 assert.ok(Math.abs(framing.ratio-21/9)<.01);
 assert.ok(framing.top>80 && Math.abs(framing.top-framing.bottom)<1,'cinematic frame has equal black letterbox bands');
 await page.screenshot({path:'test-results/intro/playing.png'});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.getElementById('viceblood-intro').hidden && document.getElementById('viceblood-title-screen').dataset.state==='menu');
 await page.waitForFunction(()=>!document.getElementById('viceblood-main-menu-theme').paused);
 assert.equal(await page.evaluate(()=>document.getElementById('viceblood-main-menu-theme').loop),true);
 await page.locator('[data-title-action="credits"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-title-drawer-body]').textContent.includes('Andres Rodriguez'));
 await page.waitForFunction(()=>Math.abs(document.querySelector('[data-title-drawer]').getBoundingClientRect().left)<1);
 await page.screenshot({path:'test-results/intro/credits.png'});
 await page.reload();
 await page.waitForFunction(()=>window.NBD_TITLE_AUDIO_GATE_STATE==='waiting',null,{timeout:90000});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.getElementById('viceblood-intro-video').currentTime>.1);
 await page.evaluate(()=>{document.getElementById('viceblood-intro-video').playbackRate=16;});
 await page.waitForFunction(()=>document.getElementById('viceblood-intro').hidden);
 await page.waitForFunction(()=>!document.getElementById('viceblood-main-menu-theme').paused);
 console.log('PASS: real playback, Escape, menu loop, credits, natural ending');
} finally { await browser.close(); }
