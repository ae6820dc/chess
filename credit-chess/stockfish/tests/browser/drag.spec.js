import {test,expect} from '@playwright/test';
const root='/credit-chess/stockfish/';
for(const [entry,width,height,type] of [['desktop.html',1366,768,'mouse'],['tablet.html',412,915,'touch'],['tablet.html',768,1024,'pen']]){
 test(`${entry} ${width} ${type}: continuous unrestricted drag, rollback and legal move`,async({page})=>{
  await page.setViewportSize({width,height});await page.goto(root+entry);
  await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100000');await page.locator('[data-tab=play]').click();
  const toggle=page.locator('#match-toggle');if(await toggle.isVisible())await toggle.click();
  await page.locator('#mode').selectOption('analysis');await page.locator('#new-game-form button').click();await expect(page.locator('#game-status')).toContainText('White to move');
  const source=page.locator('#board [data-square=e2]'),r=await source.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
  const cdp=await page.context().newCDPSession(page);
  const pointer=async(name,px,py)=>{
   if(type==='touch')return cdp.send('Input.dispatchTouchEvent',{type:{pointerdown:'touchStart',pointermove:'touchMove',pointerup:'touchEnd',pointercancel:'touchCancel'}[name],touchPoints:name==='pointerup'||name==='pointercancel'?[]:[{x:px,y:py}],});
   return cdp.send('Input.dispatchMouseEvent',{type:{pointerdown:'mousePressed',pointermove:'mouseMoved',pointerup:'mouseReleased'}[name],x:px,y:py,button:'left',buttons:name==='pointerup'?0:1,clickCount:1,pointerType:'pen'});
  };
  const down=async()=>type==='mouse'?(await page.mouse.move(x,y),await page.mouse.down()):pointer('pointerdown',x,y);
  const move=async(a,b)=>type==='mouse'?page.mouse.move(a,b):pointer('pointermove',a,b);
  const up=async(a,b)=>type==='mouse'?page.mouse.up():pointer('pointerup',a,b);
  await down();await move(x+2,y+1);await expect(page.locator('.drag-piece')).toHaveCount(0);await up(x+2,y+1);await expect(source).toHaveClass(/selected/);
  await down();await move(x+5,y+7);const first=await page.locator('.drag-piece').boundingBox();await move(x+6,y+8);const second=await page.locator('.drag-piece').boundingBox();expect(second.x-first.x).toBeCloseTo(1);expect(second.y-first.y).toBeCloseTo(1);
  await move(-20,-20);expect(await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight}))).toEqual({x:0,y:0});await up(-20,-20);
  await expect(page.locator('.drag-piece')).toHaveCount(0);await expect(page.locator('#moves li')).toHaveCount(0);await expect(source.locator('.piece')).toBeVisible();
  await down();await move(x,y-3*r.height);await up(x,y-3*r.height);
  expect(await page.locator('.drag-piece').evaluate(p=>p.getAnimations()[0].effect.getTiming().duration)).toBe(600);
  await expect(page.locator('.drag-piece')).toHaveCount(0);await expect(page.locator('#moves li')).toHaveCount(0);
  // A new gesture can interrupt the return animation safely.
  await down();await move(x,y-3*r.height);await up(x,y-3*r.height);
  await down();await move(x,y-r.height);await expect(page.locator('.drag-piece')).toBeVisible();if(type==='touch')await pointer('pointercancel',x,y-r.height);else await page.locator('#board').evaluate(b=>{if(b.hasPointerCapture(1))b.releasePointerCapture(1);else window.dispatchEvent(new Event('blur'));});await expect(page.locator('.drag-piece')).toHaveCount(0);await expect(page.locator('#moves li')).toHaveCount(0);if(type!=='touch')await up(x,y-r.height);
  await down();await move(x,y-2*r.height);await up(x,y-2*r.height);
  await expect(page.locator('#moves li').first()).toHaveText('e4');await expect(page.locator('#moves li')).toHaveCount(2,{timeout:25000});
  await page.locator('#board [data-square=g1]').click();await expect(page.locator('#board [data-square=g1]')).toHaveClass(/selected/);await page.locator('#board [data-square=f3]').click();await expect(page.locator('#moves li').nth(2)).toHaveText('Nf3');
 });
}
for(const [name,line,from,to,promotion] of [
 ['castling',['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'],'e1','g1'],
 ['capture',['e2e4','d7d5'],'e4','d5'],
 ['en passant',['e2e4','a7a6','e4e5','d7d5'],'e5','d6'],
 ['promotion',['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2'],'b7','a8','n']
])test(`drag uses existing ${name} rules`,async({page})=>{
 await page.goto(root+'desktop.html');await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100000');
 await page.evaluate(async line=>{const s=await import('./storage.js'),c=await import('./core.js'),p=(await s.read()).profiles[0];await s.saveGame(c.newGame(p,p.prefs,'analysis',line));},line);
 await page.reload();await expect(page.locator('#game-status')).toContainText('White to move');
 const a=await page.locator(`#board [data-square=${from}]`).boundingBox(),b=await page.locator(`#board [data-square=${to}]`).boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5});await page.mouse.up();
 if(promotion){await expect(page.locator('#promotion')).toBeVisible();await page.locator(`[data-promotion=${promotion}]`).click();}
 await expect.poll(()=>page.evaluate(async ply=> (await (await import('./storage.js')).read()).games[0].moves[ply],line.length)).toBe(from+to+(promotion||''));
 await expect(page.locator('.drag-piece')).toHaveCount(0);await expect(page.locator('#balance')).toHaveText('100000');
});
