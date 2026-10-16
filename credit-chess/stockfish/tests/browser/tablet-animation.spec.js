import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const root='/credit-chess/stockfish/';
async function create(page,entry='tablet.html') {
  await page.goto(root+entry);
  await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100000');await page.locator('[data-tab=play]').click();
  await expect(page.locator('#club')).toBeVisible();
}
async function start(page) {
  const toggle=page.locator('#match-toggle');
  if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await page.locator('#mode').selectOption('analysis');
  await page.locator('#new-game-form button').click();
  await expect(page.locator('#game-status')).toContainText('White to move');
}
const sizes=[[360,800],[412,915],[600,960],[768,1024],[915,412],[1024,768],[1366,768],[1920,1080]];
for(const [width,height] of sizes) test(`tablet ${width}x${height}: geometry, touch, real engine, drawers and tabs`,async({page})=>{
  await page.setViewportSize({width,height});await create(page);await start(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const board=await page.locator('#board').boundingBox();
  expect(Math.abs(board.width-board.height)).toBeLessThan(1);
  expect(board.width).toBeGreaterThan(Math.min(width-30,height-230)*.85);
  for(const id of ['board','top-clock','bottom-clock','top-name','bottom-name','game-status','resign','undo','claim']) {
    const b=await page.locator('#'+id).boundingBox();expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(height+1);
  }
  const overflow=()=>page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight}));
  expect(await overflow()).toEqual({x:0,y:0});
  await mkdir('test-results/issue-3',{recursive:true});
  await page.screenshot({path:`test-results/issue-3/tablet-${width}x${height}.png`});
  await writeFile(`test-results/issue-3/tablet-${width}x${height}.json`,JSON.stringify(board));
  console.log(`tablet ${width}x${height} board ${board.width}x${board.height}`);
  await page.locator('#board [data-square=e2]').tap();await page.locator('#board [data-square=e4]').tap();
  await expect.poll(()=>page.locator('#board').evaluate(e=>e.getAnimations({subtree:true}).length)).toBeGreaterThan(0);
  await page.evaluate(()=>{window.observed=[];const b=document.getElementById('board');window.watch=setInterval(()=>{for(const a of b.getAnimations({subtree:true}))window.observed.push(a.effect.getTiming().duration);},10);});
  await expect(page.locator('#moves li')).toHaveCount(2,{timeout:25000});
  const durations=await page.evaluate(()=>{clearInterval(window.watch);return window.observed;});
  const currentDurations=await page.locator('#board').evaluate(e=>e.getAnimations({subtree:true}).map(a=>a.effect.getTiming().duration));
  expect([...durations,...currentDurations]).toContain(600);
  await page.waitForTimeout(650);
  const toggle=page.locator('#history-toggle');if(await toggle.isVisible())await toggle.click();
  await expect(page.locator('#moves')).toBeVisible();
  if(await page.locator('#panel-close').isVisible())await page.locator('#panel-close').click();
  for(const name of ['settings','openings','arena','archive']) {
    await page.locator(`[data-tab=${name}]`).click();expect(await overflow()).toEqual({x:0,y:0});
    await expect(page.locator('#tab-'+name)).toBeVisible();
  }
  await page.locator('#archive-list button').filter({hasText:'Replay'}).first().click();
  await page.locator('#replay-next').click();
  expect(await page.locator('#replay-board').evaluate(e=>e.getAnimations({subtree:true}).length)).toBeGreaterThan(0);
  await page.locator('#replay-prev').click();await page.locator('#replay-next').click();
  await page.setViewportSize({width:height,height:width});await page.waitForTimeout(100);
  expect(await page.locator('#replay-board').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);
  await page.locator('#replay-close').click();expect(errors).toEqual([]);
});
for(const entry of ['','tablet.html']) test(`${entry||'desktop'}: animation special moves, rapid navigation and reduced motion`,async({page})=>{
  await create(page,entry);
  const results=await page.evaluate(async()=>{
    const {boardView}=await import('./app.js'),{Chess}=await import('./vendor/chess.js');
    const board=document.getElementById('board'),results=[];
    for(const [fen,moves,last,count] of [
      [undefined,['e4','e5','Nf3','Nc6','Bc4','Nf6'],'O-O',2],
      [undefined,['e4','d5'],'exd5',1],
      [undefined,['e4','a6','e5','d5'],'exd6',1],
      ['7k/P7/8/8/8/8/8/7K w - - 0 1',[],'a8=Q',1]
    ]) {
      const c=new Chess(fen);for(const m of moves)c.move(m);boardView(board,c);c.move(last);boardView(board,c);
      const animations=board.getAnimations({subtree:true});results.push({count:animations.length,expected:count,duration:animations[0]?.effect.getTiming().duration,transform:animations[0]?.effect.getKeyframes()[0].transform});
      await Promise.all(animations.map(a=>a.finished));
      results.at(-1).pieces=board.querySelectorAll('.piece').length;
      results.at(-1).expectedPieces=c.board().flat().filter(Boolean).length;
      results.at(-1).aligned=[...board.querySelectorAll('.piece')].every(piece=>{
        const square=piece.parentElement.getBoundingClientRect(),r=piece.getBoundingClientRect();
        return Math.abs(r.x+r.width/2-square.x-square.width/2)<1&&Math.abs(r.y+r.height/2-square.y-square.height/2)<1;
      });
      c.undo();boardView(board,c);c.move(last);boardView(board,c);
      results.at(-1).reverseSafe=board.getAnimations({subtree:true}).length===count;
    }
    return results;
  });
  for(const r of results){expect(r.count).toBe(r.expected);expect(r.duration).toBe(600);expect(r.transform).not.toBe('translate(0px,0px)');expect(r.pieces).toBe(r.expectedPieces);expect(r.aligned).toBe(true);expect(r.reverseSafe).toBe(true);}
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.evaluate(async()=>{const {boardView}=await import('./app.js'),{Chess}=await import('./vendor/chess.js');const c=new Chess(),b=document.getElementById('board');boardView(b,c);c.move('e4');boardView(b,c);return b.getAnimations({subtree:true}).length;})).toBe(0);
});
test('tablet orientation and adjustable durations preserve aligned positions and accessible controls',async({page})=>{
  await create(page);await start(page);
  for(const [width,height] of [[915,412],[412,915],[1024,768],[768,1024],[360,800]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    const b=await page.locator('#board').boundingBox();expect(Math.abs(b.width-b.height)).toBeLessThan(1);
    for(const id of ['top-clock','bottom-clock','resign','game-status']) {
      const r=await page.locator('#'+id).boundingBox();expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(height);
    }
  }
  for(const duration of [250,400,800,1000]) {
    await page.locator('[data-tab=settings]').click();await page.locator('#animation-duration').selectOption(String(duration));
    await expect.poll(()=>page.evaluate(async()=> (await (await import('./storage.js')).read()).profiles[0].prefs.animationDuration)).toBe(duration);
    await page.locator('[data-tab=play]').click();
    const actual=await page.evaluate(async()=>{const {boardView}=await import('./app.js'),{Chess}=await import('./vendor/chess.js'),b=document.getElementById('board'),c=new Chess();boardView(b,c);c.move('e4');boardView(b,c);return b.getAnimations({subtree:true})[0].effect.getTiming().duration;});
    expect(actual).toBe(duration);
  }
});
test('preferences, profile, balance, active game and archive survive entry switching and refresh',async({page})=>{
  await create(page);await start(page);
  await page.locator('[data-tab=settings]').click();await page.locator('#animation-duration').selectOption('1000');await page.locator('#theme').selectOption('midnight');
  await page.goto(root);await expect(page.locator('#club')).toBeVisible();
  await page.locator('[data-tab=settings]').click();await expect(page.locator('#animation-duration')).toHaveValue('1000');await expect(page.locator('body')).toHaveAttribute('data-theme','midnight');await expect(page.locator('#balance')).toHaveText('100000');
  await page.goto(root+'tablet.html');await expect(page.locator('#game-status')).toContainText('White to move');
  await page.locator('[data-tab=archive]').click();await expect(page.locator('.archive-item')).toHaveCount(1);
  await page.locator('[data-tab=settings]').click();await page.locator('#animation-duration').selectOption('0');
  // Preference writes are queued IndexedDB transactions. Wait for durability
  // before unloading the page; selectOption only waits for the change event.
  await expect.poll(()=>page.evaluate(async()=> (await (await import('./storage.js')).read()).profiles[0].prefs.animationDuration)).toBe(0);
  await page.reload();await page.locator('[data-tab=settings]').click();await expect(page.locator('#animation-duration')).toHaveValue('0');
});
for(const entry of ['','tablet.html']) test(`${entry||'desktop'}: real Arena transitions, pause and instant preference`,async({page})=>{
  await create(page,entry);
  await page.evaluate(()=>{
    const animate=Element.prototype.animate;window.transitions=[];
    Element.prototype.animate=function(frames,options){
      if(this.closest('#board'))window.transitions.push({duration:options.duration,frames});
      return animate.call(this,frames,options);
    };
  });
  await page.locator('[data-tab=arena]').click();await page.locator('#arena-count').fill('1');await page.locator('#arena-speed').fill('20');await page.locator('#arena-form button').click();
  await expect.poll(()=>page.evaluate(()=>window.transitions.length)).toBeGreaterThan(1);
  const events=await page.evaluate(()=>window.transitions);
  expect(events.every(e=>e.duration===600&&e.frames[0].transform!==e.frames[1].transform)).toBe(true);
  await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');
  const snapshot=()=>page.evaluate(async()=> (await (await import('./storage.js')).read()).games[0].moves.length);
  const count=await snapshot();await page.waitForTimeout(850);expect(await snapshot()).toBe(count);
  await page.locator('[data-tab=settings]').click();await page.locator('#animation-duration').selectOption('0');
  await page.evaluate(()=>{window.transitions=[];});await page.locator('[data-tab=play]').click();await page.locator('#arena-pause').click();
  await expect.poll(snapshot).toBeGreaterThan(count);expect(await page.evaluate(()=>window.transitions)).toEqual([]);
  await page.locator('#arena-pause').click();
});
