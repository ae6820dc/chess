import {test,expect} from '@playwright/test';
const root='/credit-chess/stockfish/';
for(const viewport of [{width:320,height:568},{width:768,height:1024},{width:1366,height:768}])test(`manual chooser at ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);await page.goto(root);
 await expect(page.getByRole('heading',{level:1})).toHaveText('One game.Choose your board.');
 await expect(page).toHaveURL(new RegExp(root+'$'));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const [name,entry] of [['Open Desktop','desktop.html'],['Open Tablet','tablet.html']]){
  const link=page.getByRole('link',{name:new RegExp(name)});await expect(link).toHaveAttribute('href',entry);
  await link.focus();await page.keyboard.press('Enter');await expect(page.locator('#club')).toBeVisible();
  await page.locator('.brand').click();await expect(page.getByRole('navigation',{name:'Choose your chess version'})).toBeVisible();
 }
 expect(await page.evaluate(()=>indexedDB.databases().then(d=>d.length))).toBeGreaterThan(0);
});
test('chooser preserves saved state between layouts and all entrypoints work offline',async({page,context})=>{
 await page.goto(root+'desktop.html');await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();
 await page.locator('#theme').selectOption('midnight');await page.locator('[data-tab=play]').click();
 await page.locator('#new-game-form button[type=submit]').click();await page.locator('#resign').click();await expect(page.locator('#game-status')).toContainText('Player resigned');
 const before=await page.evaluate(async()=>await(await import('./storage.js')).read());
 await page.locator('.brand').click();await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);await page.reload();
 await page.getByRole('link',{name:/Open Tablet/}).click();await expect(page.locator('#balance')).toHaveText('99900');await expect(page.locator('body')).toHaveAttribute('data-theme','midnight');
 expect(await page.evaluate(async()=>await(await import('./storage.js')).read())).toEqual(before);
 await page.locator('.brand').click();await page.getByRole('link',{name:/Open Desktop/}).click();await expect(page.locator('#game-status')).toContainText('Player resigned');
 expect(await page.evaluate(async()=>await(await import('./storage.js')).read())).toEqual(before);
});
test('active game survives a trip through the chooser',async({page})=>{
 await page.goto(root+'desktop.html');await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await page.locator('[data-tab=play]').click();
 await page.locator('#mode').selectOption('analysis');await page.locator('#new-game-form button[type=submit]').click();
 await page.locator('[data-square=e2]').click();await page.locator('[data-square=e4]').click();await expect(page.locator('#moves li')).toHaveCount(2);
 const before=await page.evaluate(async()=>(await(await import('./storage.js')).read()).games[0]);
 await page.locator('.brand').click();await page.getByRole('link',{name:/Open Tablet/}).click();await expect(page.locator('#moves li')).toHaveCount(2);
 const after=await page.evaluate(async()=>(await(await import('./storage.js')).read()).games[0]);
 expect(after.id).toBe(before.id);expect(after.status).toBe('active');expect(after.moves).toEqual(before.moves);expect(after.profileId).toBe(before.profileId);
});
