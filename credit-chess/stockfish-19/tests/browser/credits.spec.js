import {test,expect} from '@playwright/test';
const root='/credit-chess/stockfish-19/';
for(const [entry,width,height] of [['desktop.html',1440,900],['tablet.html',820,1180],['desktop.html',412,915]])test(`credit display, persistence and overflow ${entry} ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto(root+entry);
 await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100.000');
 for(const [raw,display] of [['0','0'],['99800','99.800'],['-1234567','-1.234.567'],['1000000','1.000.000'],['1000000000','1.000.000.000'],['9'.repeat(200),'99.'+Array(66).fill('999').join('.')]]){
  await page.evaluate(async raw=>{const s=await import('./storage.js');await s.mutate(d=>{d.profiles[0].balance=raw;});},raw);
  await page.reload();
  await expect(page.locator('#balance')).toHaveText(display);
  expect(await page.evaluate(async()=>(await (await import('./storage.js')).read()).profiles[0].balance)).toBe(raw);
  expect(await page.locator('#balance').evaluate(e=>e.getBoundingClientRect().right<=innerWidth)).toBe(true);
 }
});
test('result, stake and archive use grouped credits without rewriting saved records',async({page})=>{
 await page.goto(root+'desktop.html');await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100.000');
 await page.evaluate(async()=>{
  const s=await import('./storage.js'),c=await import('./core.js');
  await s.mutate(d=>{const p=d.profiles[0];p.balance='99800';p.prefs.stake='1000000';const g=c.newGame(p,p.prefs,'rated');c.finish(g,'0-1','Player resigned');g.settled=true;g.endingBalance=p.balance;d.games.push(g);});
 });
 await page.reload();await expect(page.locator('#game-status')).toContainText('Balance 99.800');await expect(page.locator('#stake')).toHaveValue('1.000.000');
 const before=await page.evaluate(async()=>await (await import('./storage.js')).read());
 await page.locator('[data-tab=arena]').click();await expect(page.locator('#balance')).toHaveText('99.800');
 await page.locator('[data-tab=archive]').click();await expect(page.locator('#archive-list')).toContainText('stake 1.000.000');await expect(page.locator('#archive-list')).toContainText('balance 99.800');
 await page.reload();const after=await page.evaluate(async()=>await (await import('./storage.js')).read());expect(after.profiles).toEqual(before.profiles);expect(after.games).toEqual(before.games);
});
