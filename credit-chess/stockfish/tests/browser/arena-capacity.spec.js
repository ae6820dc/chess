import {test,expect} from '@playwright/test';
const root='/credit-chess/stockfish/';
async function create(page,entry){
 await page.goto(root+entry);await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100000');
}
for(const [entry,width] of [['desktop.html',1440],['tablet.html',820],['desktop.html',412]])for(const count of [8902,100000,1000000])test(`${entry} at ${width}px configures ${count} sequential games without preallocation`,async({page})=>{
 await page.setViewportSize({width,height:1000});await create(page,entry);
 await page.locator('[data-tab=openings]').click();await page.locator('#opening-depth').selectOption('3');
 // Make engine searches pending: this tests configuration, not a huge match run.
 await page.evaluate(async()=>{const {StockfishAdapter}=await import('./engine.js');StockfishAdapter.prototype.move=()=>new Promise(()=>{});});
 await page.locator('[data-tab=arena]').click();await page.locator('#arena-count').fill(String(count));
 expect(await page.locator('#arena-count').evaluate(e=>e.checkValidity())).toBe(true);
 await page.locator('#arena-form button').click();await expect(page.locator('#arena-pause')).toBeVisible();
 await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');
 const saved=await page.evaluate(async()=>await (await import('./storage.js')).read());
 expect(saved.games).toHaveLength(1);expect(saved.games[0].arena.remaining).toBe(count);expect(saved.games[0].arena.depth).toBe(3);expect(saved.profiles[0].balance).toBe('100000');
 await page.reload();await expect(page.locator('#game-status')).toHaveText('Arena paused');
 expect(await page.evaluate(async()=>(await (await import('./storage.js')).read()).games[0].arena.remaining)).toBe(count);
 await page.locator('[data-tab=arena]').click();
 for(const invalid of ['0','1000001','1.5']){await page.locator('#arena-count').fill(invalid);expect(await page.locator('#arena-count').evaluate(e=>e.checkValidity())).toBe(false);}
});
test('chunked history preserves results, backups, exact recovery and bounded pages',async({page})=>{
 await create(page,'desktop.html');
 const result=await page.evaluate(async()=>{
  const s=await import('./storage.js'),c=await import('./core.js'),p=(await s.read()).profiles[0];
  const seed=async(start,count)=>s.mutate(data=>{
   for(let i=start;i<start+count;i++){
    const g=c.newGame(p,p.prefs,'arena',[],i+1);g.arena={remaining:1000000-i,speed:200,depth:3,rank:String(i%8902),pending:false};
    c.finish(g,'1/2-1/2','Capacity fixture',i+2);g.settled=true;g.endingBalance=p.balance;data.games.push(g);
   }
  });
  await s.mutate((data,store)=>store.put(structuredClone(data),'recovery'));
  await seed(0,301);const before=await s.read();
  await s.restoreRecovery();if((await s.readBackup()).games.length!==0)throw Error('Recovery retained an obsolete manifest');
  await s.restoreRecovery();if((await s.readBackup()).games.length!==301)throw Error('Recovery lost archived results');
  await s.mutate((data,store)=>store.put(structuredClone(data),'recovery'));
  await seed(301,200);const after=await s.read(),backup=await s.readBackup();s.validateBackup(backup);
  const encrypted=await s.encryptBackup(backup,'capacity-test-password');
  const decoded=await s.decryptBackup(encrypted,'capacity-test-password');if(decoded.games.length!==501)throw Error('Encrypted backup lost archived results');
  const seen=[];let cursor=null;do{const page=await s.archivePage(p.id,cursor);if(page.games.length>50)throw Error('Unbounded page');seen.push(...page.games.map(g=>g.id));cursor=page.next;}while(cursor);
  // Both records and the reference list must restore; immutable chunks must not
  // leak post-recovery games into the restored archive.
  await s.restoreRecovery();const restored=await s.readBackup();
  await s.restoreRecovery();const swapped=await s.readBackup();
  const original=IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add=function(value,key){if(typeof key==='string'&&key.startsWith('history:'))throw new DOMException('Injected quota','QuotaExceededError');return original.call(this,value,key);};
  let failed=false;try{await seed(501,200);}catch{failed=true;}finally{IDBObjectStore.prototype.add=original;}
  const retained=await s.readBackup();if(!failed||retained.games.length!==501)throw Error('Archive write was not atomic');
  return {live:after.games.length,chunks:after.historyChunks.length,before:before.games.length,total:backup.games.length,seen:seen.length,unique:new Set(seen).size,restored:restored.games.length,swapped:swapped.games.length,balance:after.profiles[0].balance};
 });
 expect(result.live).toBeLessThanOrEqual(200);expect(result.chunks).toBeGreaterThan(0);expect(result.total).toBe(501);expect(result.seen).toBe(501);expect(result.unique).toBe(501);expect(result.restored).toBe(301);expect(result.swapped).toBe(501);expect(result.balance).toBe('100000');
 await page.locator('[data-tab=archive]').click();await expect(page.locator('.archive-item')).toHaveCount(50);await page.getByRole('button',{name:'Next results',exact:true}).click();await expect(page.getByRole('button',{name:'Previous results',exact:true})).toBeVisible();
});
for(const [rank,advance] of [['99',true],['8901',false]])test(`large series ${advance?'advances past old limit':'stops at atlas end'} from rank ${rank}`,async({page})=>{
 await create(page,'desktop.html');
 await page.evaluate(async rank=>{
  const s=await import('./storage.js'),c=await import('./core.js'),p=(await s.read()).profiles[0];
  const g=c.newGame(p,p.prefs,'arena');g.arena={remaining:1000000,speed:2000,depth:3,rank,pending:true};
  c.finish(g,'1/2-1/2','Series continuation fixture');g.settled=true;g.endingBalance=p.balance;await s.saveGame(g);
 },rank);
 await page.reload();
 if(advance){
  await expect(page.locator('#arena-pause')).toBeVisible();await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');
 }else await expect(page.locator('#notice')).toContainText('Arena series stopped');
 const data=await page.evaluate(async()=>await (await import('./storage.js')).read());
 expect(data.games).toHaveLength(advance?2:1);expect(data.games[0].arena.pending).toBe(false);
 if(advance){expect(data.games[1].arena.rank).toBe('100');expect(data.games[1].arena.remaining).toBe(999999);}
 expect(data.profiles[0].balance).toBe('100000');
});
