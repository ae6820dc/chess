import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test.use({serviceWorkers:'block'});
const path='/credit-chess/stockfish/';
async function setup(page){
 await page.goto(path+'desktop.html');await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100.000');
 await page.evaluate(async()=>{const s=await import('./storage.js'),c=await import('./core.js'),d=await s.read(),p=d.profiles[0];p.prefs.responseDelay=10;await s.savePrefs(p.id,p.prefs);const g=c.newGame(p,p.prefs,'arena',[]);g.arena={remaining:1000000,speed:2000,depth:1,rank:'0',pending:false};await s.saveGame(g);});await page.reload();await expect(page.locator('#arena-stop')).toBeVisible();
}
for(const paused of [false,true])test('STOP permanently ends '+(paused?'paused':'calculating/delayed')+' arena',async({page})=>{
 await setup(page);if(paused){await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');}
 await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
 const read=()=>page.evaluate(async()=>(await import('./storage.js')).read());const stopped=await read();expect(stopped.games[0].result).toBe('*');expect(stopped.arenaSeries[0].completed).toBe(0);expect(stopped.arenaSeries[0].status).toBe('stopped');
 await page.waitForTimeout(1200);expect((await read()).games[0].moves).toEqual(stopped.games[0].moves);await page.reload();await expect(page.locator('#arena-stop')).toBeHidden();await expect(page.locator('#arena-pause')).toBeHidden();
 await page.locator('[data-tab=arena]').click();await expect(page.locator('#arena-history')).toContainText('0 completed');await page.locator('#arena-form button').click();await expect(page.locator('#arena-stop')).toBeVisible();await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');expect((await read()).arenaSeries).toHaveLength(2);
 const backup=await page.evaluate(async()=>{const s=await import('./storage.js');return s.validateBackup(await s.readBackup());});expect(backup.arenaSeries).toHaveLength(2);
});

test('completed scores, configuration and replay survive STOP, new series, reload and backup',async({page})=>{
 await setup(page);await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
 await page.evaluate(async()=>{
  const s=await import('./storage.js'),c=await import('./core.js'),d=await s.read(),p=d.profiles[0];
  for(const [i,result] of ['1-0','0-1','1/2-1/2'].entries()){
   const g=c.newGame(p,{...p.prefs,difficulty:'2800'},'arena',['e2e4'],Date.now()+i);g.arena={seriesId:'retained',remaining:10-i,speed:20,depth:1,rank:String(i),pending:true};c.finish(g,result,'Fixture completed game');await s.saveGame(g);
  }
  const g=c.newGame(p,p.prefs,'arena',[],Date.now()+4);g.clock.paused=true;g.arena={seriesId:'retained',remaining:7,speed:20,depth:1,rank:'3',pending:false};await s.saveGame(g);
 });
 await page.reload();await expect(page.locator('#game-status')).toHaveText('Arena paused');await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
 await page.locator('[data-tab=arena]').click();const row=page.locator('#arena-history p').filter({hasText:'3 completed'});await expect(row).toContainText('Points 1.5–1.5');await expect(row).toContainText('Elo 2800');await row.getByRole('button',{name:'Review games'}).click();await expect(page.locator('#archive-list .archive-item')).toHaveCount(4);
 await page.getByRole('button',{name:'Replay',exact:true}).nth(1).click();await expect(page.locator('#replay-status')).toContainText('Ply 0/1');await page.locator('#replay-close').click();
 await page.reload();const result=await page.evaluate(async()=>{const s=await import('./storage.js'),d=await s.readBackup();s.validateBackup(d);return d.arenaSeries.find(r=>r.id==='retained');});expect(result.completed).toBe(3);expect(result.draws).toBe(1);expect(result.white).toBe(1);expect(result.black).toBe(1);
});

test('STOP while next opening is loading cancels the series without losing the completed game',async({page})=>{
 await setup(page);await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
 await page.evaluate(async()=>{const s=await import('./storage.js'),c=await import('./core.js'),p=(await s.read()).profiles[0],g=c.newGame(p,p.prefs,'arena',[]);g.arena={remaining:3,speed:20,depth:1,rank:'0',pending:true};c.finish(g,'1-0','Completed before next game');await s.saveGame(g);});
 await page.route('**/opening-worker.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{};'}));
 await page.reload();await expect(page.locator('#arena-stop')).toBeVisible();await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
 const data=await page.evaluate(async()=>(await import('./storage.js')).read());expect(data.games).toHaveLength(2);expect(data.games[1].arena.pending).toBe(false);expect(data.arenaSeries.at(-1).completed).toBe(1);expect(data.arenaSeries.at(-1).status).toBe('stopped');
 await page.reload();await expect(page.locator('#arena-stop')).toBeHidden();
});

test('legacy chunked Arena history upgrades without losing games or scores',async({page})=>{
 await setup(page);await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
 await page.evaluate(async()=>{
  const s=await import('./storage.js'),c=await import('./core.js'),p=(await s.read()).profiles[0];
  await s.mutate(d=>{d.games=[];delete d.arenaSeries;delete d.arenaHistoryVersion;for(let i=0;i<230;i++){const g=c.newGame(p,p.prefs,'arena',[],Date.now()+i);g.arena={remaining:300-i,speed:20,depth:2,rank:String(i),pending:false};c.finish(g,i%2?'0-1':'1-0','Legacy result');g.settled=true;g.endingBalance=p.balance;d.games.push(g);}});
 });
 await page.reload();await expect(page.locator('#balance')).toHaveText('100.000');
 const result=await page.evaluate(async()=>{const s=await import('./storage.js'),d=await s.readBackup();s.validateBackup(d);return {games:d.games.length,series:d.arenaSeries,ids:new Set(d.games.map(g=>g.arena.seriesId)).size};});
 expect(result.games).toBe(230);expect(result.ids).toBe(1);expect(result.series).toHaveLength(1);expect(result.series[0].completed).toBe(230);expect(result.series[0].whitePoints).toBe(115);
 await page.reload();const rows=await page.evaluate(async()=>(await (await import('./storage.js')).read()).arenaSeries);expect(rows[0].completed).toBe(230);
});

test('failed STOP write stays halted and can be retried durably',async({page})=>{
 await setup(page);await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;let fail=true;IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readwrite'&&fail){fail=false;throw new DOMException('Injected quota failure','QuotaExceededError');}return original.apply(this,args);};});
 await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('STOP could not be saved');await expect(page.locator('#retry-save')).toBeVisible();await page.locator('#retry-save').click();await expect(page.locator('#notice')).toContainText('Arena stopped');await page.reload();await expect(page.locator('#arena-stop')).toBeHidden();
 const d=await page.evaluate(async()=>(await import('./storage.js')).read());expect(d.arenaSeries[0].completed).toBe(0);expect(d.arenaSeries[0].status).toBe('stopped');
});

for(const [entry,width,height] of [['desktop.html',1440,900],['tablet.html',820,1180],['tablet.html',320,568]])test('STOP stays beside PAUSE at '+width+'px',async({page})=>{
 await page.setViewportSize({width,height});await setup(page);if(entry==='tablet.html'){await page.goto(path+entry);await expect(page.locator('#arena-stop')).toBeVisible();}
 await page.locator('#arena-stop').scrollIntoViewIfNeeded();const pause=await page.locator('#arena-pause').boundingBox(),stop=await page.locator('#arena-stop').boundingBox();expect(Math.abs(pause.y-stop.y)).toBeLessThan(2);expect(stop.x).toBeGreaterThanOrEqual(pause.x+pause.width);expect(stop.x+stop.width).toBeLessThanOrEqual(width);
 await page.locator('#arena-stop').click();await expect(page.locator('#arena-history')).toContainText('stopped');await expect(page.locator('#arena-history p').first()).toBeInViewport();await page.screenshot({path:`test-results/arena-stop-${width}.png`,fullPage:true});
});

test('STOP preserves a completed result even when its preceding autosave failed',async({page})=>{
 await setup(page);await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');
 await page.evaluate(async()=>{await (await import('./storage.js')).mutate(d=>{d.games[0].clock.w=0;d.games[0].clock.paused=false;});});
 await page.addInitScript(()=>{const original=IDBDatabase.prototype.transaction;window.failArenaSave=true;IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readwrite'&&window.failArenaSave){throw new DOMException('Injected quota failure','QuotaExceededError');}return original.apply(this,args);};});
 await page.reload();await expect(page.locator('#notice')).toContainText('Game could not be saved');await page.evaluate(()=>{window.failArenaSave=false;});await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
 const d=await page.evaluate(async()=>(await import('./storage.js')).read());expect(d.arenaSeries[0].completed).toBe(1);expect(d.arenaSeries[0].black).toBe(1);expect(d.arenaSeries[0].status).toBe('stopped');expect(d.games[0].result).toBe('0-1');await page.evaluate(async()=>{const s=await import('./storage.js');s.validateBackup(await s.readBackup());});
});


test('stopped scores survive closing and restarting the browser',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'arena-restart-'));
 const launch=()=>chromium.launchPersistentContext(directory,{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
 let context;
 try{
  context=await launch();let page=context.pages()[0]||await context.newPage();await setup(page);await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
  const saved=await page.evaluate(async()=>(await (await import('./storage.js')).read()).arenaSeries);
  await page.goto('about:blank');await context.close();context=await launch();page=context.pages()[0]||await context.newPage();await page.goto(path+'desktop.html');await expect(page.locator('#balance')).toHaveText('100.000');await expect(page.locator('#arena-stop')).toBeHidden();await expect(page.locator('#arena-pause')).toBeHidden();
  expect(await page.evaluate(async()=>(await (await import('./storage.js')).read()).arenaSeries)).toEqual(saved);
 }finally{await context?.close();await rm(directory,{recursive:true,force:true});}
});
