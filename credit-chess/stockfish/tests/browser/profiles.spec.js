import {test,expect} from '@playwright/test';
const root='/credit-chess/stockfish/';
const snapshot=page=>page.evaluate(async()=> (await import('./storage.js')).read());
async function generate(page,pin='1111',cancel=false){
 await page.locator('#generate-user').click();await page.locator('#pin').fill(pin);
 await page.locator(`#pin-form button[value=${cancel?'cancel':'generate'}]`).click();
}
for(const entry of ['desktop.html','tablet.html'])test(`${entry}: empty visit, PIN, switching, durable selection and backups`,async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(root+entry);
 await expect(page.locator('#club')).toBeVisible();await expect(page.locator('#notice')).toContainText('No profile');
 await expect(page.locator('#new-game-form button[type=submit]')).toBeDisabled();
 await page.locator('[data-tab=archive]').click();await expect(page.locator('#archive-list')).toContainText('Settings');
 await page.locator('[data-tab=settings]').click();const before=await snapshot(page);
 await generate(page,'1111',true);expect(await snapshot(page)).toEqual(before);
 await generate(page,'wrong');await expect(page.locator('#notice')).toContainText('Incorrect');expect(await snapshot(page)).toEqual(before);
 await generate(page);await expect(page.locator('#balance')).toHaveText('100000');const first=(await snapshot(page)).profiles[0];expect(first.name).toMatch(/^[0-9A-F]{8}$/);expect(first.auth).toBeUndefined();
 const accepted=await snapshot(page);await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.keyboard.press('Escape');await expect(page.locator('#creation-pin')).not.toBeVisible();expect(await snapshot(page)).toEqual(accepted);
 await page.locator('#theme').selectOption('midnight');
 await page.locator('[data-tab=play]').click();if(await page.locator('#match-toggle').isVisible()&&await page.locator('#match-toggle').getAttribute('aria-expanded')!=='true')await page.locator('#match-toggle').click();await page.locator('#new-game-form button[type=submit]').click();await page.locator('#resign').click();await expect(page.locator('#balance')).toHaveText('99900');
 await page.locator('[data-tab=settings]').click();await generate(page);await expect(page.locator('#balance')).toHaveText('100000');
 const data=await snapshot(page);expect(data.profiles).toHaveLength(2);expect(data.profiles[1].name).not.toBe(first.name);
 await page.locator('#profile-select').selectOption(first.id);await expect(page.locator('#balance')).toHaveText('99900');await expect(page.locator('body')).toHaveAttribute('data-theme','midnight');
 await page.goto(root+(entry==='desktop.html'?'tablet.html':'desktop.html'));await expect(page.locator('#balance')).toHaveText('99900');await expect(page.locator('#game-status')).toContainText('Player resigned');
 await page.reload();await expect(page.locator('#balance')).toHaveText('99900');
 // A fresh tab after closing the original must use IndexedDB, not tab session storage.
 await page.close();page=await context.newPage();await page.goto(root+entry);await expect(page.locator('#balance')).toHaveText('99900');
 await page.locator('[data-tab=settings]').click();const download=page.waitForEvent('download');await page.locator('#export-json').click();const file=await download;const path=await file.path();
 const saved=await snapshot(page);await page.evaluate(async()=>{const s=await import('./storage.js');await s.mutate(d=>Object.assign(d,s.empty()));});await page.reload();await page.locator('[data-tab=settings]').click();await page.locator('#import-file').setInputFiles(path);await expect(page.locator('#notice')).toContainText('Imported 2 profiles and 1 games');
 await page.locator('#profile-select').selectOption(first.id);await expect(page.locator('#balance')).toHaveText('99900');expect((await snapshot(page)).games).toEqual(saved.games);expect(errors).toEqual([]);
});
test('collision retries, format validation and name conflicts preserve existing generated records',async({page})=>{
 await page.goto(root+'desktop.html');await expect(page.locator('#club')).toBeVisible();
 const result=await page.evaluate(async()=>{
  const s=await import('./storage.js'),original=crypto.getRandomValues.bind(crypto);let calls=0;
  crypto.getRandomValues=array=>{array.fill(calls++<2?0:255);return array;};
  let a,b;try{a=await s.createProfile('1111');b=await s.createProfile('1111');}finally{crypto.getRandomValues=original;}
  const data=await s.read();let invalid=false;try{s.validateBackup({...data,profiles:[{...a,name:'invalid'}]});}catch{invalid=true;}
  const collision=await s.importBackup({...data,profiles:[{...a,id:'new-id'}],games:[]});
  return {names:[a.name,b.name],calls,invalid,collision,count:(await s.read()).profiles.length};
 });expect(result).toEqual({names:['00000000','FFFFFFFF'],calls:3,invalid:true,collision:{addedProfiles:0,addedGames:0,conflicts:1},count:2});
});
