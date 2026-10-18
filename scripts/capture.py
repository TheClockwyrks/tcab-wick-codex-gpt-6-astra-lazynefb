"""Capture original engine frames. Run with `npm run dev` serving port 5173.
The transient page owns an engine for the capture, never the game's public page.
"""
import pathlib, subprocess
root=pathlib.Path(__file__).resolve().parent.parent
page=root/'.capture.html'
module=root/'.capture.ts'
page.write_text('<html><body style="margin:0;background:#0b151d"><canvas id="capture" style="width:1280px;height:720px"></canvas><script type="module" src="./.capture.ts"></script></body></html>')
module.write_text('''
import {createEngine, ConstantClock} from '@clockwyrks/simple-2d';
import {game, BACKGROUND} from './src/game';
const engine=createEngine({canvas:document.querySelector('canvas')!,width:1280,height:720,game,background:BACKGROUND,clock:new ConstantClock(1000/60)});
await engine.initialize();
Object.assign(window,{captureEngine:engine});
''')
try:
 subprocess.run(['node','--input-type=module','-'],cwd=root,input=r'''
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.on('pageerror',error=>{throw error});
await page.goto('http://localhost:5173/.capture.html');
await page.waitForFunction(()=>window.captureEngine);
await page.evaluate(async()=>{await window.captureEngine.advance(1)});
await page.screenshot({path:'showcase/title.png'});
await page.evaluate(async()=>{
 const e=window.captureEngine,d=e.debug;
 const apply=(method,...args)=>e.apply(s=>d[method](s,...args));
 apply('setScreen','playing');apply('setTick',24840);apply('setLevel',24);apply('setKills',1247);apply('setXp',86);
 for(const [i,id] of ['pyre','corona','chandelier','ember','oil-splash','spark'].entries())apply('setWeapon',i,id,['pyre','corona','chandelier'].includes(id)?1:6);
 for(const [i,id] of ['wick','glass','tinder','brass','lure','soot'].entries())apply('setPassive',i,id,id==='brass'?3:4);
 apply('setProgression',false);
 for(let i=0;i<110;i++){
  const a=i*2.39996,r=160+(i%7)*52;
  apply('spawnEnemy',['moth','bat','beetle','hound','shade','crow','spider'][i%7],Math.cos(a)*r*1.14,Math.sin(a)*r*.65);
 }
 apply('spawnEnemy','mothwing',-330,-120);apply('spawnEnemy','owl',390,-130);
 for(let i=0;i<34;i++){const a=i*1.76,r=70+i*7;apply('spawnGem',i%5?'small':'medium',Math.cos(a)*r,Math.sin(a)*r*.6);}
 apply('spawnPickup','chest',-205,112);apply('spawnPickup','bread',287,71);
 for(const p of [[135,45],[-180,-50],[110,-185]])apply('spawnPuddle','blaze',...p);
 await e.advance(30);
});
await page.screenshot({path:'showcase/night.png'});
const recording=await page.evaluate(async()=>{
 const e=window.captureEngine;
 e.startRecording();
 const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
 key('keydown','KeyD');await e.advance(60);key('keyup','KeyD');
 key('keydown','KeyW');await e.advance(60);key('keyup','KeyW');
 key('keydown','KeyA');await e.advance(60);key('keyup','KeyA');
 return e.stopRecording();
});
writeFileSync('showcase/night.json.gz',gzipSync(JSON.stringify(recording)));
await page.evaluate(async()=>{const e=window.captureEngine;e.apply(s=>e.debug.reset(s));e.apply(s=>e.debug.setScreen(s,'almanac'));await e.advance(1)});
await page.screenshot({path:'showcase/almanac.png'});
await browser.close();
''',text=True,check=True)
finally:
 page.unlink(missing_ok=True);module.unlink(missing_ok=True)
