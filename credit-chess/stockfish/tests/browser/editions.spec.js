import {test,expect} from '@playwright/test';
const root=v=>`/credit-chess/stockfish${v===19?'-19':''}/`;
test('editions retain independent profiles, balances, preferences, workers and offline caches',async({page,context})=>{
 const p18=page,p19=await context.newPage();const pages=[p18,p19];const requests=[];
 p19.on('request',r=>requests.push(r.url()));
 for(const [i,p] of pages.entries()){
  const v=i?19:18;await p.goto(root(v)+'desktop.html');await expect(p.locator('#club')).toBeVisible();
  await p.evaluate(async v=>{const s=await import('./storage.js');const p=await s.createProfile('1111');await s.mutate(d=>{d.profiles[0].balance=String(v*1000);d.profiles[0].prefs.theme=v===18?'gold':'midnight';});localStorage.setItem(`sf${v}:sentinel`,String(v));sessionStorage.setItem(`sf${v}:sentinel`,String(v));},v);
  await p.reload();await expect(p.locator('#balance')).toHaveText(i?'19.000':'18.000');
  await expect(p.locator('.brand')).toContainText(`STOCKFISH ${v}`);
 }
 const snapshots=await Promise.all(pages.map(p=>p.evaluate(async()=>{const s=await import('./storage.js');return {data:await s.read(),id:s.PROGRAM_ID,key:s.STORAGE_KEY};})));
 expect(snapshots[0].key).toBe('bbebe43a0b38a335');expect(snapshots[1].key).toBe('sf19-credit-chess-v1');expect(snapshots[0].id).not.toBe(snapshots[1].id);
 expect(snapshots[0].data.profiles).toHaveLength(1);expect(snapshots[1].data.profiles).toHaveLength(1);expect(snapshots[0].data.profiles[0].id).not.toBe(snapshots[1].data.profiles[0].id);
 expect(requests.some(u=>new URL(u).pathname.startsWith(root(18)))).toBe(false);
 for(const [i,p] of pages.entries()){
  await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await p.evaluate(async()=>{await navigator.serviceWorker.ready;});
  const m=await p.evaluate(async()=>{const r=await fetch('./tablet.webmanifest');return r.json();});
  expect(m.name).toBe(`Stockfish ${i?19:18} Credit Chess`);expect(m.id).toContain(root(i?19:18));
  const manifest=(await (await context.newCDPSession(p)).send('Page.getAppManifest'));expect(manifest.errors).toEqual([]);
 }
 const state=await page.evaluate(async()=>({scopes:(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname),caches:await caches.keys(),databases:(await indexedDB.databases()).map(d=>d.name)}));
 for(const v of [18,19]){expect(state.scopes).toContain(root(v));expect(state.caches.some(k=>k.endsWith(root(v)))).toBe(true);}
 expect(state.databases).not.toContain('stockfish-19-credit-chess');
 await context.setOffline(true);
 for(const [i,p] of pages.entries()){
  await p.reload();await expect(p.locator('#balance')).toHaveText(i?'19.000':'18.000');
  const identity=await p.evaluate(async()=>{const {StockfishAdapter}=await import('./engine.js');const a=new StockfishAdapter();try{await a.ready;return a.engineName;}finally{a.close();}});expect(identity).toMatch(new RegExp(`^Stockfish ${i?19:18}\\b`));
 }
});
for(const v of [18,19])test(`Stockfish ${v}: two real workers complete a legal chess game`,async({page})=>{
 test.setTimeout(120000);await page.goto(root(v)+'proof.html');
 const result=await page.evaluate(async()=>{
  const {StockfishAdapter}=await import('./engine.js');const {Chess}=await import('./vendor/chess.js');const a=new StockfishAdapter(),b=new StockfishAdapter();
  try{await Promise.all([a.ready,b.ready]);const c=new Chess(),moves=[];
   while(!c.isGameOver()&&moves.length<1200){const uci=await (moves.length%2?b:a).move({moves,difficulty:'MAX',milliseconds:5});c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});moves.push(uci);}
   return {names:[a.engineName,b.engineName],over:c.isGameOver(),plies:moves.length,pgn:c.pgn(),range:a.eloRange};
  }finally{a.close();b.close();}
 });
 expect(result.over).toBe(true);expect(result.plies).toBeGreaterThan(10);for(const n of result.names)expect(n).toMatch(new RegExp(`^Stockfish ${v}\\b`));console.log(JSON.stringify({version:v,...result}));
});
for(const v of [18,19])for(const entry of ['desktop.html','tablet.html'])test(`SF${v} ${entry} header remains visible at phone, tablet and desktop sizes`,async({page})=>{
 await page.goto(root(v)+entry);await expect(page.locator('#club')).toBeVisible();
 for(const width of [320,412,768,1280]){await page.setViewportSize({width,height:915});const b=page.locator('.brand');await expect(b).toContainText(`STOCKFISH ${v}`);const box=await b.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(await b.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}
});
