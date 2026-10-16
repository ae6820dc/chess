import {test,expect} from '@playwright/test';
const path='/credit-chess/stockfish/';
async function create(page){await page.goto(path);await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100000');await page.locator('[data-tab=play]').click();await expect(page.locator('#club')).toBeVisible();await expect(page.locator('#balance')).toHaveText('100000');}
async function clock(page,seconds=30){await page.locator('#base').fill(String(seconds/60));await page.locator('#base').dispatchEvent('change');await page.locator('#increment').fill('0');await page.locator('#increment').dispatchEvent('change');}
async function snapshot(page){return page.evaluate(async()=>await (await import('./storage.js')).read());}
test('mobile real engine gameplay, illegal move rejection, clock, persisted preferences and active game',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await create(page);
 await page.locator('[data-tab=settings]').click();await page.locator('#theme').selectOption('midnight');await page.locator('[data-tab=play]').click();await clock(page,60);await page.locator('#new-game-form button[type=submit]').click();
 await page.locator('#manual-move summary').click();await page.locator('#from').fill('e2');await page.locator('#to').fill('e5');await page.locator('#move-form button').click();await expect(page.locator('#notice')).toContainText('not legal');await expect(page.locator('#moves li')).toHaveCount(0);
 await page.locator('[data-square=e2]').click();await page.locator('[data-square=e4]').click();await expect(page.locator('#moves li')).toHaveCount(2,{timeout:25000});
 const before=await snapshot(page);const game=before.games[0];expect(game.moves[0]).toBe('e2e4');expect(game.clock.b).toBeLessThan(60000);expect(game.pgn).toContain('e4');
 await page.reload();await expect(page.locator('#club')).toBeVisible();await expect(page.locator('#moves li')).toHaveCount(2);await expect(page.locator('body')).toHaveAttribute('data-theme','midnight');
 await page.waitForTimeout(1200);const displayed=await page.locator('#bottom-clock').textContent();expect(displayed).not.toBe('1:00');
 const after=await snapshot(page);expect(after.games[0].moves).toEqual(game.moves);expect(after.profiles[0].prefs.base).toBe(60);expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/mobile-play.png',fullPage:true});
});
test('resignation debits a BigInt-safe stake exactly once and archive replays',async({page})=>{
 await create(page);await page.locator('#stake').fill('999999999999999999999999999999');await page.locator('#stake').dispatchEvent('change');await page.locator('#new-game-form button[type=submit]').click();await page.locator('#resign').click();await expect(page.locator('#game-status')).toContainText('Player resigned');
 const balance=(100000n-999999999999999999999999999999n).toString();await expect(page.locator('#balance')).toHaveText(balance);
 const data=await snapshot(page);expect(data.games[0].settled).toBe(true);await page.evaluate(async g=>{const {saveGame}=await import('./storage.js');await saveGame({...g,settled:false});},data.games[0]);await page.reload();await expect(page.locator('#balance')).toHaveText(balance);await expect(page.locator('#stake')).toHaveValue(data.games[0].stake);
 await page.locator('[data-tab=archive]').click();await page.getByRole('button',{name:'Replay',exact:true}).click();await expect(page.locator('#replay-status')).toContainText('Ply 0/0');
});
test('creation PIN, schema validation, encrypted backup round-trip and recovery',async({page})=>{
 await create(page);const outcome=await page.evaluate(async()=>{
  const s=await import('./storage.js'),data=await s.read();
  let wrong=false,invalid=false;try{await s.createProfile('wrong');}catch{wrong=true;}
  const encrypted=await s.encryptBackup(data,'backup-password-123'),decoded=await s.decryptBackup(encrypted,'backup-password-123');
  try{await s.importBackup({...decoded,schemaVersion:999});}catch{invalid=true;}
  const conflict=await s.importBackup(decoded);const second=await s.createProfile('1111');const before=await s.read();
  const pristine={...before,profiles:[second],games:[]};await s.importBackup(pristine);await s.createProfile('1111');await s.restoreRecovery();
  return {wrong,invalid,equal:JSON.stringify(data)===JSON.stringify(decoded),conflict,count:(await s.read()).profiles.length};
 });expect(outcome).toEqual({wrong:true,invalid:true,equal:true,conflict:{addedProfiles:0,addedGames:0,conflicts:1},count:2});
});
test('clock timeout on idle player persists once after reload',async({page})=>{
 await create(page);await clock(page,2);await page.locator('#new-game-form button[type=submit]').click();await expect(page.locator('#game-status')).toContainText('Time expired',{timeout:10000});await expect(page.locator('#balance')).toHaveText('99900');await page.reload();await expect(page.locator('#balance')).toHaveText('99900');expect((await snapshot(page)).games[0].result).toBe('0-1');
});
test('analysis undo never credits and offline reload restores saved data',async({page,context})=>{
 await create(page);await page.locator('#mode').selectOption('analysis');await page.locator('#new-game-form button[type=submit]').click();await page.locator('[data-square=e2]').click();await page.locator('[data-square=e4]').click();await expect(page.locator('#moves li')).toHaveCount(2);await page.locator('#undo').click();await expect(page.locator('#moves li')).toHaveCount(0);await expect(page.locator('#balance')).toHaveText('100000');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await context.setOffline(true);await page.reload();await expect(page.locator('#club')).toBeVisible();await expect(page.locator('#moves li')).toHaveCount(0);await expect(page.locator('#balance')).toHaveText('100000');await context.setOffline(false);
});
test('exact opening worker cursor persists, arena starts from it with independent engines and pauses',async({page})=>{
 await create(page);await page.locator('[data-tab=openings]').click();await page.locator('#opening-depth').selectOption('3');await page.locator('#opening-rank').fill('8901');await page.locator('#opening-jump').click();await expect(page.locator('#opening-status')).toContainText('8902',{timeout:25000});
 await page.reload();await expect(page.locator('#club')).toBeVisible();await page.locator('[data-tab=openings]').click();await expect(page.locator('#opening-rank')).toHaveValue('8901');
 await page.locator('#opening-depth').selectOption('1');await page.locator('#opening-rank').fill('0');await page.locator('#opening-jump').click();await expect(page.locator('#opening-status')).toContainText('of 20');
 await page.locator('[data-tab=arena]').click();await page.locator('#arena-speed').fill('20');await page.locator('#arena-form button').click();await expect(page.locator('#arena-pause')).toBeVisible();await expect.poll(async()=> (await snapshot(page)).games[0].moves.length).toBeGreaterThan(3);
 await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');const data=await snapshot(page);expect(data.games[0].mode).toBe('arena');expect(data.games[0].moves[0]).toBe('a2a3');expect(data.profiles[0].balance).toBe('100000');const clocks=data.games[0].clock;
 await page.waitForTimeout(400);await page.reload();await expect(page.locator('#game-status')).toHaveText('Arena paused');const restored=await snapshot(page);expect(restored.games[0].clock).toEqual(clocks);await page.locator('#arena-pause').click();await expect.poll(async()=>(await snapshot(page)).games[0].moves.length).toBeGreaterThan(data.games[0].moves.length);
});
test('a second tab cannot write credits concurrently',async({page,context})=>{
 await create(page);const second=await context.newPage();await second.goto(path);await expect(second.locator('#notice')).toContainText('Another chess tab');await expect(second.locator('#club')).toBeHidden();await second.close();
});
test('arena completes a series, archives both games and progresses without rewards',async({page})=>{
 await create(page);await clock(page,1);await page.locator('[data-tab=openings]').click();await page.locator('#opening-depth').selectOption('1');await page.locator('#opening-rank').fill('0');await page.locator('#opening-jump').click();await expect(page.locator('#opening-status')).toContainText('of 20');
 await page.locator('[data-tab=arena]').click();await page.locator('#arena-count').fill('2');await page.locator('#arena-speed').fill('2000');await page.locator('#arena-form button').click();
 await expect.poll(async()=>{const d=await snapshot(page);return d.games.filter(g=>g.status==='finished').length;},{timeout:45000}).toBe(2);
 const data=await snapshot(page);expect(data.games).toHaveLength(2);expect(data.games.map(g=>g.arena.rank)).toEqual(['0','1']);expect(data.games.every(g=>g.settled)).toBe(true);expect(data.games.every(g=>g.arena.pending===false)).toBe(true);expect(data.profiles[0].balance).toBe('100000');
 await page.reload();await expect(page.locator('#balance')).toHaveText('100000');expect((await snapshot(page)).games).toHaveLength(2);
});
test('promotion dialog completes an actual legal underpromotion before real engine reply',async({page})=>{
 await create(page);
 await page.evaluate(async()=>{const s=await import('./storage.js'),c=await import('./core.js'),data=await s.read(),p=data.profiles[0];const g=c.newGame(p,p.prefs,'analysis',['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2']);await s.saveGame(g);});
 await page.reload();await expect(page.locator('#club')).toBeVisible();await page.locator('[data-square=b7]').click();await page.locator('[data-square=a8]').click();await expect(page.locator('#promotion')).toBeVisible();await page.locator('[data-promotion=n]').click();await expect(page.locator('#moves li')).toHaveCount(10,{timeout:25000});const data=await snapshot(page);expect(data.games[0].moves[8]).toBe('b7a8n');expect(data.profiles[0].balance).toBe('100000');
});
test('touch board performs legal en passant and removes the captured pawn',async({page})=>{
 await create(page);await page.evaluate(async()=>{const s=await import('./storage.js'),c=await import('./core.js'),data=await s.read(),p=data.profiles[0];await s.saveGame(c.newGame(p,p.prefs,'analysis',['e2e4','a7a6','e4e5','d7d5']));});await page.reload();await expect(page.locator('#club')).toBeVisible();await page.locator('[data-square=e5]').click();await page.locator('[data-square=d6]').click();await expect(page.locator('#moves li')).toHaveCount(6,{timeout:25000});const data=await snapshot(page);expect(data.games[0].moves[4]).toBe('e5d6');await expect(page.locator('[data-square=d5]')).toHaveAttribute('aria-label','d5 empty');
});
test('failed IndexedDB game write blocks play and offers a durable retry',async({page})=>{
 await create(page);await page.locator('#new-game-form button[type=submit]').click();await expect(page.locator('#game-status')).toContainText('White to move');await expect.poll(async()=>(await snapshot(page)).games.length).toBe(1);
 await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;let fail=true;IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readwrite'&&fail){fail=false;throw new DOMException('Injected quota failure','QuotaExceededError');}return original.apply(this,args);};});
 await page.locator('[data-square=e2]').click();await page.locator('[data-square=e4]').click();await expect(page.locator('#notice')).toContainText('Game could not be saved');await expect(page.locator('#retry-save')).toBeVisible();expect((await snapshot(page)).games[0].moves).toEqual([]);
 await page.locator('#retry-save').click();await expect(page.locator('#retry-save')).toBeHidden();await expect(page.locator('#moves li')).toHaveCount(2,{timeout:25000});expect((await snapshot(page)).games[0].moves[0]).toBe('e2e4');
});
