import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const root='/credit-chess/stockfish/';
async function history(page){const b=page.locator('#history-toggle');if(await b.isVisible()&&await b.getAttribute('aria-expanded')!=='true')await b.click();}
async function setup(page,entry='tablet.html'){
 await page.route('**/engine.js',route=>route.fulfill({contentType:'text/javascript',body:`export class StockfishAdapter {constructor(){this.ready=Promise.resolve({min:1320});} move({moves}){(window.searches??=[]).push(moves);return new Promise(resolve=>window.reply=resolve);}close(){delete window.reply;}}`}));
 await page.goto(root+entry);await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100000');
 await page.evaluate(async()=>{const s=await import('./storage.js'),c=await import('./core.js'),p=(await s.read()).profiles[0];await s.saveGame(c.newGame(p,p.prefs,'analysis',['e2e4']));});
 await page.reload();await expect(page.locator('#game-status')).toContainText('Black to move');await history(page);await page.locator('#premove-panel').evaluate(e=>e.open=true);
}
async function move(page,from,to){await page.locator(`#board [data-square=${from}]`).click();await page.locator(`#board [data-square=${to}]`).click();}
async function snapshot(page){return page.evaluate(async()=> (await (await import('./storage.js')).read()).games[0]);}
test('click queue, projection, undo, restore, one automatic move and illegal cancellation',async({page})=>{
 await setup(page);await move(page,'g1','f3');await move(page,'f1','c4');await expect(page.locator('#premove-count')).toHaveText('2');expect((await snapshot(page)).moves).toEqual(['e2e4']);expect(await page.evaluate(()=>window.searches)).toEqual([['e2e4']]);
 await page.locator('#premove-view').click();await expect(page.locator('#board [data-square=g1] .piece')).toHaveCount(1);await page.locator('#premove-view').click();await expect(page.locator('#board [data-square=f3] .piece')).toHaveCount(1);
 await page.locator('#premove-undo').click();await expect(page.locator('#premove-count')).toHaveText('1');await page.reload();await expect(page.locator('#premove-count')).toHaveText('1');
 await page.evaluate(()=>window.reply('e7e5'));await expect.poll(async()=> (await snapshot(page)).moves).toEqual(['e2e4','e7e5','g1f3']);await expect(page.locator('#premove-count')).toHaveText('0');
 expect(await page.locator('#board').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);expect(await page.evaluate(()=>window.searches.at(-1))).toEqual(['e2e4','e7e5','g1f3']);
 // Plan a conditional diagonal capture; the opponent does not supply a victim.
 await move(page,'d2','e3');await expect(page.locator('#premove-count')).toHaveText('1');await page.evaluate(()=>window.reply('b8c6'));await expect(page.locator('#notice')).toContainText('no longer legal');await expect(page.locator('#premove-count')).toHaveText('0');expect((await snapshot(page)).moves).toHaveLength(4);
});
for(const count of [10,100,1000])test(`restore ${count} premoves, virtual list and account isolation`,async({page})=>{
 await setup(page);
 await page.evaluate(async count=>{const s=await import('./storage.js');await s.mutate(data=>{data.games[0].premoves=Array.from({length:count},(_,i)=>i%2?'f3g1':'g1f3');data.games[0].revision++;});},count);
 await page.reload();await expect(page.locator('#premove-count')).toHaveText(String(count));await history(page);await page.locator('#premove-panel').evaluate(e=>e.open=true);expect(await page.locator('.premove-row').count()).toBeLessThanOrEqual(18);
 await page.locator('#premove-list').evaluate(e=>e.scrollTop=e.scrollHeight);await expect(page.locator('.premove-row').last()).toContainText(`${count}.`);
 const first=await page.locator('#profile-select').inputValue();await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#premove-count')).toHaveText('0');await page.locator('#profile-select').selectOption(first);await expect(page.locator('#premove-count')).toHaveText(String(count));
 await page.locator('[data-tab=play]').click();await history(page);await page.locator('#premove-panel').evaluate(e=>e.open=true);await page.locator('#premove-clear').click();await expect(page.locator('#premove-count')).toHaveText('0');expect((await snapshot(page)).premoves).toEqual([]);
});
for(const touch of [false,true])test(`${touch?'touch':'mouse'} drag queues consecutive intentions`,async({page})=>{
 await setup(page,touch?'tablet.html':'desktop.html');if(!touch)await page.setViewportSize({width:1366,height:768});
 const cdp=await page.context().newCDPSession(page);
 for(const [from,to] of [['g1','f3'],['f3','g5']]){
 const a=await page.locator(`#board [data-square=${from}]`).boundingBox(),b=await page.locator(`#board [data-square=${to}]`).boundingBox(),x=a.x+a.width/2,y=a.y+a.height/2,tx=b.x+b.width/2,ty=b.y+b.height/2;
 if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty}]});await expect(page.locator('.drag-piece')).toHaveCount(1);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(tx,ty,{steps:4});await page.mouse.up();}
 await expect.poll(async()=> (await snapshot(page)).premoves.length).toBe(from==='g1'?1:2);
 }
 expect((await snapshot(page)).moves).toEqual(['e2e4']);expect(await page.evaluate(()=>scrollY)).toBe(0);
});
