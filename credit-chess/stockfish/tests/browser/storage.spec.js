import {test,expect} from '@playwright/test';
const path='/credit-chess/stockfish/';
async function seed(page,invalid=false){
 await page.goto(path+'proof.html');
 return page.evaluate(async invalid=>{
  const {DEFAULTS,newGame}=await import('./core.js');
  const profile={id:'legacy',name:'Legacy Player',auth:{salt:btoa('s'.repeat(16)),hash:btoa('h'.repeat(32)),iterations:310000},balance:'9876543210123456789',prefs:{...DEFAULTS,openingRank:'19',animationDuration:800},created:123};
  const game=newGame(profile,profile.prefs,'arena',[]);game.arena={remaining:3,speed:200,depth:1,rank:'19',pending:false};
  const snapshot={schemaVersion:1,profiles:[profile],games:[game],lastProfile:profile.id};
  const rows={snapshot:invalid?{...snapshot,schemaVersion:999}:snapshot,recovery:snapshot,extension:{keep:['all',123]}};
  await new Promise((resolve,reject)=>{const r=indexedDB.open('stockfish-credit-chess',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>{const d=r.result,t=d.transaction('data','readwrite');for(const [k,v] of Object.entries(rows))t.objectStore('data').put(v,k);t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>reject(t.error);};});
  return rows;
 },invalid);
}
async function dump(page,name){return page.evaluate(name=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>{const d=r.result,t=d.transaction('data'),s=t.objectStore('data'),out={};s.openCursor().onsuccess=e=>{const c=e.target.result;if(c){out[c.key]=c.value;c.continue();}};t.oncomplete=()=>{d.close();resolve(out);};t.onerror=()=>reject(t.error);};}),name);}
test('fixed IDs, atomic legacy migration, recovery records and shared persistence across interfaces',async({page})=>{
 const rows=await seed(page);
 await page.goto(path);await expect(page.locator('#profile-select')).toContainText('Legacy Player');
 const ids=await page.evaluate(async()=>{const s=await import('./storage.js');return {program:s.PROGRAM_ID,key:s.STORAGE_KEY};});
 expect(ids.program).toMatch(/^[0-9a-f]{32}$/);expect(ids.key).toMatch(/^[0-9a-f]{16}$/);
 await expect(page.locator('#program-id')).toHaveText('Program ID: '+ids.program);
 expect(await dump(page,ids.key)).toEqual(rows);expect(await dump(page,'stockfish-credit-chess')).toEqual(rows);
 await page.evaluate(async()=>{await (await import('./storage.js')).mutate(d=>{d.profiles[0].balance='42';});});
 await page.goto(path+'tablet.html');await expect(page.locator('#program-id')).toHaveText('Program ID: '+ids.program);
 expect(await page.evaluate(async()=>(await (await import('./storage.js')).read()).profiles[0].balance)).toBe('42');
 await page.reload();expect((await dump(page,ids.key)).snapshot.profiles[0].balance).toBe('42');
 expect(await dump(page,'stockfish-credit-chess')).toEqual(rows);
});
for(const mode of ['invalid','abort','quota'])test(`migration ${mode} fails closed, retains legacy and supports retry`,async({page})=>{
 const rows=await seed(page,mode==='invalid');
 const result=await page.evaluate(async mode=>{
  const s=await import('./storage.js');const original=IDBObjectStore.prototype.add;
  if(mode!=='invalid')IDBObjectStore.prototype.add=function(...args){if(this.name==='data'&&mode==='quota')throw new DOMException('Injected quota','QuotaExceededError');if(this.name==='metadata'&&mode==='abort')this.transaction.abort();return original.apply(this,args);};
  let error;try{await s.read();}catch(e){error=e.message;}
  IDBObjectStore.prototype.add=original;
  return {error,key:s.STORAGE_KEY};
 },mode);
 expect(result.error).toContain('existing data was retained');expect(await dump(page,'stockfish-credit-chess')).toEqual(rows);expect(await dump(page,result.key)).toEqual({});
 if(mode==='invalid')await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('stockfish-credit-chess',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('data','readwrite'),s=t.objectStore('data'),get=s.get('snapshot');get.onsuccess=()=>s.put({...get.result,schemaVersion:1},'snapshot');t.oncomplete=()=>{d.close();resolve();};};}));
 expect(await page.evaluate(async()=>(await (await import('./storage.js')).read()).profiles[0].name)).toBe('Legacy Player');
});
test('unmarked destination data is never overwritten',async({page})=>{
 const rows=await seed(page);
 const key=await page.evaluate(async()=>{
  const {STORAGE_KEY}=await import('./storage.js');
  await new Promise(resolve=>{const r=indexedDB.open(STORAGE_KEY,1);r.onupgradeneeded=()=>{r.result.createObjectStore('data');r.result.createObjectStore('metadata');};r.onsuccess=()=>{const d=r.result,t=d.transaction('data','readwrite');t.objectStore('data').put({important:true},'unknown');t.oncomplete=()=>{d.close();resolve();};};});
  return STORAGE_KEY;
 });
 await expect(page.evaluate(async()=>await (await import('./storage.js')).read())).rejects.toThrow('refusing to overwrite');
 expect(await dump(page,key)).toEqual({unknown:{important:true}});expect(await dump(page,'stockfish-credit-chess')).toEqual(rows);
});
