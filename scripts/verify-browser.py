"""Smoke-test the production bundle at / and /wick/ with local Chromium."""
import http.server, pathlib, subprocess, threading
root=pathlib.Path(__file__).resolve().parent.parent
class Site(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root/'dist'),**kwargs)
 def translate_path(self,path):
  if path.startswith('/wick/'):path=path[5:]
  return super().translate_path(path)
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',4179),Site)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 subprocess.run(['node','--input-type=module','-'],cwd=root,input=r'''
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
for(const mount of ['/','/wick/']){
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[],assets=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);if(/\.(png|wav)$/.test(r.url()))assets.push(r.url())});
 await page.goto(`http://127.0.0.1:4179${mount}`);await page.waitForTimeout(700);
 assert.equal(assets.length,139);
 assert(assets.every(url=>url.startsWith(`http://127.0.0.1:4179${mount}assets/`)));
 const snapshot=()=>page.locator('canvas').evaluate(c=>c.toDataURL());
 const title=await snapshot();
 await page.mouse.click(300,465);await page.waitForTimeout(150);const almanac=await snapshot();assert.notEqual(title,almanac);
 await page.keyboard.press('Escape');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await page.waitForTimeout(1000);
 const playing=await snapshot();assert.notEqual(playing,title);
 await page.keyboard.down('KeyD');await page.waitForTimeout(350);await page.keyboard.up('KeyD');
 await page.keyboard.press('KeyP');await page.waitForTimeout(100);const paused=await snapshot();await page.waitForTimeout(180);assert.equal(await snapshot(),paused);
 await page.keyboard.press('KeyP');await page.keyboard.press('KeyM');await page.waitForTimeout(100);
 await page.screenshot({path:`test-results/${mount==='/'?'root':'subpath'}.png`});
 assert.deepEqual(errors,[]);await page.close();
}
const mobile=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await mobile.newPage();await page.goto('http://127.0.0.1:4179/wick/');await page.waitForTimeout(700);
// The stage letterboxes horizontally at this aspect ratio. Tap the first menu row.
const scale=390/720,offset=(844-1280*scale)/2;
await page.touchscreen.tap(offset+300*scale,400*scale);await page.waitForTimeout(400);
await page.screenshot({path:'test-results/touch.png'});
await browser.close();console.log('Production verified: root, sub-path, keyboard, pointer, pause, mute, and touch.');
''',text=True,check=True)
finally:server.shutdown()
