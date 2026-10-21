import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const root='/credit-chess/stockfish/';
async function freezeClock(page){await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));}
async function history(page){const b=page.locator('#history-toggle');if(await b.isVisible()&&await b.getAttribute('aria-expanded')!=='true')await b.click();}
async function setup(page,entry='tablet.html'){
 await page.route('**/engine.js',route=>route.fulfill({contentType:'text/javascript',body:`export class StockfishAdapter {constructor(){this.ready=Promise.resolve({min:1320});} move({moves}){(window.searches??=[]).push(moves);return new Promise(resolve=>window.reply=resolve);}close(){delete window.reply;}}`}));
 await page.goto(root+entry);await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100000');
 await page.evaluate(async()=>{const s=await import('./storage.js'),c=await import('./core.js'),p=(await s.read()).profiles[0];await s.savePrefs(p.id,{...p.prefs,responseDelay:2});const g=c.newGame(p,{...p.prefs},'analysis',['e2e4']);g.openingPlies=0;await s.saveGame(g);});
 await page.reload();await expect(page.locator('#game-status')).toContainText('Black to move');await history(page);await page.locator('#premove-panel').evaluate(e=>e.open=true);
}
async function move(page,from,to){await page.locator(`#board [data-square=${from}]`).click();await page.locator(`#board [data-square=${to}]`).click();}
async function snapshot(page){return page.evaluate(async()=> (await (await import('./storage.js')).read()).games[0]);}

test('delay includes search time, charges clock, and executes only one queued premove',async({page})=>{
 await setup(page);
 await freezeClock(page);
 await move(page,'g1','f3');await move(page,'f1','c4');
 const before=await snapshot(page);
 await page.evaluate(()=>window.reply('e7e5'));
 await expect(page.locator('#engine-status')).toContainText('delayed');
 await page.clock.runFor(900);
 expect((await snapshot(page)).moves).toEqual(['e2e4']);
 await page.clock.runFor(1200);
 await expect.poll(async()=> (await snapshot(page)).moves.length).toBe(3);
 const after=await snapshot(page);
 expect(after.premoves).toEqual(['f1c4']);
 expect(after.clock.b).toBeLessThan(before.clock.b+5000-900);
 // Search longer than the delay: no second delay after its result.
 await page.clock.runFor(2500);
 await page.evaluate(()=>window.reply('b8c6'));
 await expect.poll(async()=> (await snapshot(page)).moves.length).toBe(5);
});
for(const action of ['undo','resign','switch','reset'])test('pending reply cancelled on '+action,async({page})=>{
 await setup(page);await freezeClock(page);
 await page.evaluate(()=>{window.oldReply=window.reply;window.reply('e7e5');});
 await expect(page.locator('#engine-status')).toContainText('delayed');
 if(action==='undo'||action==='resign')await page.locator('#'+action).click();
 if(action==='undo')await expect.poll(async()=> (await snapshot(page)).moves.length).toBe(0);
 if(action==='switch'){
  await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();
  await expect(page.locator('#game-status')).toContainText('Choose');
 }
 if(action==='reset'){
  page.on('dialog',d=>d.accept());
  await page.locator('#new-game-form').evaluate(e=>e.requestSubmit());
 }
 await page.clock.runFor(3000);
 await page.evaluate(()=>window.oldReply('e7e5'));
 expect((await snapshot(page)).moves).toEqual(action==='undo'?[]:['e2e4']);
});
test('timeout during delay terminates without accepting move',async({page})=>{
 await setup(page);await freezeClock(page);
 await page.evaluate(async()=>{const s=await import('./storage.js');await s.mutate(d=>{d.games[0].clock.b=500;d.games[0].clock.since=Date.now();});});
 await page.reload();await page.waitForFunction(()=>typeof window.reply==='function');
 await page.evaluate(()=>window.reply('e7e5'));
 await page.clock.runFor(2600);
 await expect.poll(async()=> (await snapshot(page)).status).toBe('finished');
 expect((await snapshot(page)).moves).toEqual(['e2e4']);
});
test('custom preference persists and validates backup limits',async({page})=>{
 await setup(page);await page.locator('[data-tab=settings]').click();
 await page.locator('#response-delay').selectOption('custom');
 await page.locator('#response-delay-custom').fill('300');await page.locator('#response-delay-custom').dispatchEvent('change');
 await expect.poll(()=>page.evaluate(async()=> (await (await import('./storage.js')).read()).profiles[0].prefs.responseDelay)).toBe(300);
 await page.reload();await page.locator('[data-tab=settings]').click();
 await expect(page.locator('#response-delay-custom')).toHaveValue('300');
 await page.locator('#response-delay-custom').fill('301');await page.locator('#response-delay-custom').dispatchEvent('change');
 await expect(page.locator('#notice')).toContainText('0–300');
 expect(await page.evaluate(async()=>{
  const s=await import('./storage.js'),data=await s.read();s.validateBackup(data);
  delete data.profiles[0].prefs.responseDelay;s.validateBackup(data);
  data.profiles[0].prefs.responseDelay=301;
  try{s.validateBackup(data);return false;}catch{return true;}
 })).toBe(true);
});
for(const delay of [0,1,2,5,10,20,30,60,300])test('response deadline '+delay+' seconds',async({page})=>{
 await setup(page);
 await page.evaluate(async delay=>{const s=await import('./storage.js'),p=(await s.read()).profiles[0];await s.savePrefs(p.id,{...p.prefs,responseDelay:delay});await s.mutate(d=>{d.games[0].clock.since=Date.now();});},delay);
 await page.reload();await freezeClock(page);
 const g=await snapshot(page),left=Math.max(0,g.clock.since+delay*1000-await page.evaluate(()=>Date.now()));
 await page.evaluate(()=>window.reply('e7e5'));
 if(left>200){
  await expect(page.locator('#engine-status')).toContainText('delayed');
  await page.clock.runFor(left-100);
  expect((await snapshot(page)).moves).toEqual(['e2e4']);
  await page.clock.runFor(200);
 }
 await expect.poll(async()=> (await snapshot(page)).moves.length).toBe(2);
});

async function arenaSetup(page,entry='tablet.html'){
 await setup(page,entry);
 await page.evaluate(async()=>{
  const s=await import('./storage.js');
  const p=(await s.read()).profiles[0];await s.savePrefs(p.id,{...p.prefs,animationDuration:0});
  await s.mutate(d=>{const g=d.games[0];g.mode='arena';g.moves=[];g.clock.since=Date.now();g.arena={remaining:1,speed:20};});
 });
 await page.reload();await expect(page.locator('#game-status')).toContainText('White to move');
 await freezeClock(page);

}
for(const [entry,width,height] of [['tablet.html',412,915],['desktop.html',1440,900],['tablet.html',820,1180]])test(`both arena engines delay every consecutive move: ${entry} ${width}`,async({page})=>{
 await page.setViewportSize({width,height});
 await arenaSetup(page,entry);
 const moves=['e2e4','e7e5','g1f3','b8c6'];
 for(let i=0;i<moves.length;i++){
  const g=await snapshot(page);
  await page.evaluate(m=>window.reply(m),moves[i]);
  await expect(page.locator('#engine-status')).toContainText('delayed');
  const left=g.clock.since+2000-await page.evaluate(()=>Date.now());
  await page.clock.runFor(left-1);
  expect((await snapshot(page)).moves).toEqual(moves.slice(0,i));
  await page.clock.runFor(2);
  await expect.poll(async()=> (await snapshot(page)).moves).toEqual(moves.slice(0,i+1));
 }
 // A slow calculation consumes the delay, rather than starting another wait.
 await page.clock.runFor(2500);
 await page.evaluate(()=>window.reply('f1c4'));
 await expect.poll(async()=> (await snapshot(page)).moves.length).toBe(5);
});
test('arena pause cancels waiting and calculating replies; resume starts a fresh deadline',async({page})=>{
 await arenaSetup(page);
 await page.evaluate(()=>{window.staleReply=window.reply;window.reply('e2e4');});
 await expect(page.locator('#engine-status')).toContainText('delayed');
 await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');
 await page.clock.runFor(3000);expect((await snapshot(page)).moves).toEqual([]);
 await page.locator('#arena-pause').click();
 await page.waitForFunction(()=>typeof window.reply==='function');
 await page.evaluate(()=>{window.staleReply('e2e4');window.reply('e2e4');});
 await expect(page.locator('#engine-status')).toContainText('delayed');
 await page.clock.runFor(1900);expect((await snapshot(page)).moves).toEqual([]);
 await page.clock.runFor(101);await expect.poll(async()=> (await snapshot(page)).moves).toEqual(['e2e4']);
 // Cancel Black while it is still calculating, then try delivering its stale result.
 await page.evaluate(()=>{window.staleReply=window.reply;});
 await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');
 await page.evaluate(()=>window.staleReply('e7e5'));
 await page.clock.runFor(3000);expect((await snapshot(page)).moves).toEqual(['e2e4']);
 await page.locator('#arena-pause').click();await page.waitForFunction(()=>typeof window.reply==='function');await page.evaluate(()=>window.reply('e7e5'));
 await expect(page.locator('#engine-status')).toContainText('delayed');
 await page.clock.runFor(1900);expect((await snapshot(page)).moves).toEqual(['e2e4']);
 await page.clock.runFor(101);await expect.poll(async()=> (await snapshot(page)).moves).toEqual(['e2e4','e7e5']);
});
for(const action of ['restart','switch'])test('arena pending move cancelled on '+action,async({page})=>{
 await arenaSetup(page);
 await page.evaluate(()=>{window.staleReply=window.reply;window.reply('e2e4');});
 await expect(page.locator('#engine-status')).toContainText('delayed');
 if(action==='restart'){
  page.on('dialog',d=>d.accept());
  await page.locator('#new-game-form').evaluate(e=>e.requestSubmit());
  await expect(page.locator('#game-status')).toContainText('White to move');
  await expect.poll(async()=> (await snapshot(page)).status).toBe('finished');
 }else{
  await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();
  await expect(page.locator('#game-status')).toContainText('Choose');
 }
 await page.evaluate(()=>window.staleReply('e2e4'));
 await page.clock.runFor(3000);
 expect((await snapshot(page)).moves).toEqual([]);
});

for(const phase of ['calculation','delay','animation','paused'])test('STOP rejects stale Arena replies during '+phase,async({page})=>{
 await arenaSetup(page);await page.evaluate(()=>{window.staleReply=window.reply;});
 if(phase==='delay'){await page.evaluate(()=>window.reply('e2e4'));await expect(page.locator('#engine-status')).toContainText('delayed');}
 if(phase==='animation'){
  await page.evaluate(()=>{document.querySelector('#board').animate([{opacity:1},{opacity:.9}],{duration:10000});window.reply('e2e4');});await page.clock.runFor(2100);
 }
 if(phase==='paused')await page.locator('#arena-pause').click();
 await page.locator('#arena-stop').click();await expect(page.locator('#notice')).toContainText('Arena stopped');
 await page.evaluate(()=>window.staleReply('e2e4'));await page.clock.runFor(12000);
 const g=await snapshot(page);expect(g.moves).toEqual([]);expect(g.result).toBe('*');expect(g.arena.stopped).toBe(true);
 await page.reload();await expect(page.locator('#arena-pause')).toBeHidden();await expect(page.locator('#arena-stop')).toBeHidden();
});
