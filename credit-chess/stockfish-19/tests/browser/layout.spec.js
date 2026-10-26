import {test, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';

const viewports = [
  {name:'desktop-1920x1080',width:1920,height:1080,mobile:false},
  {name:'laptop-1366x768',width:1366,height:768,mobile:false},
  {name:'portrait-412x915',width:412,height:915,mobile:true},
  {name:'landscape-915x412',width:915,height:412,mobile:true},
];
const path = '/credit-chess/stockfish-19/';
async function create(page) {
  await page.goto(path+'desktop.html');
  await page.locator('[data-tab=settings]').click();await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');await page.locator('#pin-form button[value=generate]').click();await expect(page.locator('#balance')).toHaveText('100.000');await page.locator('[data-tab=play]').click();
  await expect(page.locator('#club')).toBeVisible();
}
async function start(page) {
  await page.locator('#mode').selectOption('analysis');
  await page.locator('#new-game-form button[type=submit]').click();
  await expect(page.locator('#game-status')).toContainText('White to move');
  await expect.poll(async()=> (await page.locator('#board').boundingBox())?.width || 0).toBeGreaterThan(100);
}
async function noDocumentScroll(page) {
  const d = await page.evaluate(()=>({
    scrollHeight:document.documentElement.scrollHeight,
    clientHeight:document.documentElement.clientHeight,
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
    scrollTop:document.documentElement.scrollTop,
    bodyTop:document.body.scrollTop,
    windowTop:scrollY,
    rootOverflow:getComputedStyle(document.documentElement).overflowY,
  }));
  expect(d.scrollHeight).toBeLessThanOrEqual(d.clientHeight+1);
  expect(d.scrollWidth).toBeLessThanOrEqual(d.clientWidth+1);
  expect(d.scrollTop).toBe(0); expect(d.bodyTop).toBe(0); expect(d.windowTop).toBe(0);
  // Zero scrolling comes from bounded layout, not hiding the root scrollbar.
  expect(['hidden','clip']).not.toContain(d.rootOverflow);
  return d;
}
async function inside(page,selector,{hitTest=true}={}) {
  const el=page.locator(selector);await expect(el).toBeVisible();
  const rect=await el.boundingBox(),viewport=page.viewportSize();
  expect(rect.width).toBeGreaterThan(0);expect(rect.height).toBeGreaterThan(0);
  expect(rect.x).toBeGreaterThanOrEqual(-1);expect(rect.y).toBeGreaterThanOrEqual(-1);
  expect(rect.x+rect.width).toBeLessThanOrEqual(viewport.width+1);
  expect(rect.y+rect.height).toBeLessThanOrEqual(viewport.height+1);
  if(hitTest)await expect.poll(()=>el.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit);}),{message:selector+' must be reachable'}).toBe(true);
  return rect;
}
async function playGeometry(page) {
  const board=await inside(page,'#board');expect(Math.abs(board.width-board.height)).toBeLessThanOrEqual(1);
  await expect(page.locator('#board .square')).toHaveCount(64);
  for(const id of ['top-name','bottom-name','top-clock','bottom-clock','game-status','resign','claim','undo'])await inside(page,'#'+id);
  for(const square of ['a1','a8','h1','h8'])await inside(page,`#board [data-square=${square}]`);
  return {board,document:await noDocumentScroll(page)};
}
async function pane(page,name) {
  const toggle=page.locator(name==='match'?'#match-toggle':'#history-toggle');
  if(await toggle.isVisible() && await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
}

for(const viewport of viewports) {
  test.describe(viewport.name,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.mobile,hasTouch:viewport.mobile});
    test('bounded Play, actual engine, internal history and all tabs remain reachable',async({page})=>{
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await create(page);await noDocumentScroll(page);await start(page);
      const measurement=await playGeometry(page);
      await mkdir('test-results/layout',{recursive:true});
      await page.screenshot({path:`test-results/layout/${viewport.name}.png`});
      await writeFile(`test-results/layout/${viewport.name}.json`,JSON.stringify(measurement,null,2));
      console.log(viewport.name,JSON.stringify(measurement));

      // The optional manual area remains reachable without scrolling the page.
      await page.locator('#manual-move summary').click();
      await inside(page,'#from');await inside(page,'#to');await inside(page,'#move-form button');
      await page.locator('#from').fill('e2');await page.locator('#to').fill('e4');await page.locator('#move-form button').click();
      await expect(page.locator('#moves li')).toHaveCount(2,{timeout:25000});
      await page.locator('#manual-move summary').click();await playGeometry(page);
      await expect(page.locator('#undo')).toBeEnabled();

      // Actual pointer drag, followed by another real worker response.
      const from=await page.locator('#board [data-square=g1]').boundingBox(),to=await page.locator('#board [data-square=f3]').boundingBox();
      await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
      await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await page.mouse.up();
      await expect(page.locator('#moves li')).toHaveCount(4,{timeout:25000});
      await page.locator('#undo').click();await expect(page.locator('#moves li')).toHaveCount(2);
      await pane(page,'history');
      // Presentation-only stress data; the real engine/history was tested above.
      await page.locator('#moves').evaluate(el=>{for(let i=0;i<240;i++){const li=document.createElement('li');li.textContent=i%2?'Nc6':'Nf3';el.append(li);}el.scrollTop=0;});
      const history=page.locator('#moves');expect(await history.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
      await history.focus();await page.keyboard.press('End');
      await expect.poll(()=>history.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
      await playGeometry(page);
      await pane(page,'match');await page.locator('#use-opening').scrollIntoViewIfNeeded();
      await inside(page,'#new-game-form button[type=submit]');await noDocumentScroll(page);

      // Seed archive fixtures through the existing durable store; no engine is mocked.
      await page.evaluate(async()=>{
        const {mutate}=await import('./storage.js');
        await mutate(data=>{const current=data.games[0];for(let i=0;i<30;i++)data.games.push({...structuredClone(current),id:crypto.randomUUID(),status:'finished',result:'1/2-1/2',reason:'Archive layout fixture',settled:true,finished:Date.now(),endingBalance:'100000',clock:{...current.clock,paused:true}});});
      });
      for(const name of ['openings','arena','archive','settings']) {
        await page.locator(`[data-tab=${name}]`).click();await noDocumentScroll(page);
        const content=page.locator('#tab-'+name);
        await content.focus();await page.keyboard.press('End');
        await noDocumentScroll(page);
        if(name==='settings') {
          await page.locator('#recover').scrollIntoViewIfNeeded();await inside(page,'#recover');
          expect(await content.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
          await page.locator('#theme').selectOption('midnight');await expect(page.locator('body')).toHaveAttribute('data-theme','midnight');
          await page.locator('#export-json').scrollIntoViewIfNeeded();const download=page.waitForEvent('download');await page.locator('#export-json').click();expect((await download).suggestedFilename()).toContain('backup');
        }
        if(name==='archive') {
          const last=page.locator('.archive-item').last();await last.getByRole('button',{name:'Replay',exact:true}).click();
          const replay=await inside(page,'#replay-board');expect(Math.abs(replay.width-replay.height)).toBeLessThanOrEqual(1);
          for(const id of ['replay-prev','replay-next','replay-close'])await inside(page,'#'+id);
          await page.locator('#replay-next').click();await expect(page.locator('#replay-status')).toContainText('Ply 1/');
          await page.keyboard.press('Escape');await expect(page.locator('#replay')).not.toBeVisible();await noDocumentScroll(page);
          expect(await content.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
        }
        if(name==='openings') {
          await page.locator('#opening-rank').fill('399');await page.locator('#opening-jump').click();await expect(page.locator('#opening-status')).toContainText('of 400');await noDocumentScroll(page);
        }
        if(name==='arena') {await page.locator('#arena-form button').scrollIntoViewIfNeeded();await inside(page,'#arena-form button');}
      }
      await page.locator('[data-tab=play]').click();await playGeometry(page);
      await page.locator('#resign').click();await expect(page.locator('#game-status')).toContainText('Player resigned');
      await page.locator('[data-tab=arena]').click();await page.locator('#arena-count').fill('1');await page.locator('#arena-speed').fill('20');await page.locator('#arena-form button').click();
      await expect(page.locator('#arena-pause')).toBeVisible();await inside(page,'#arena-pause');
      await page.locator('#arena-pause').click();await expect(page.locator('#game-status')).toHaveText('Arena paused');await playGeometry(page);
      expect(errors).toEqual([]);
    });
  });
}

test('orientation changes, long notifications and keyboard focus preserve the shell',async({page})=>{
  await create(page);await start(page);
  for(const viewport of [{width:915,height:412},{width:412,height:915},{width:1366,height:768},{width:1920,height:1080},{width:412,height:915}]) {
    await page.setViewportSize(viewport);await expect.poll(async()=>{
      const r=await page.locator('#board').boundingBox();return r.height<=viewport.height&&Math.abs(r.height-r.width)<=1;
    }).toBe(true);await playGeometry(page);
  }
  await page.locator('#notice').evaluate(el=>{el.textContent='A long recoverable storage message. '.repeat(50);});
  await page.locator('#notice').focus();await page.keyboard.press('End');
  await playGeometry(page);
  await page.locator('#manual-move summary').click();await page.locator('#from').focus();await inside(page,'#from');await noDocumentScroll(page);
  // A smaller visual viewport approximates the keyboard/browser-bar resize path.
  await page.setViewportSize({width:412,height:600});await inside(page,'#from');await inside(page,'#move-form button');await playGeometry(page);
});


test('small portrait and large balances remain accessible without document scrolling',async({page})=>{
  await page.setViewportSize({width:320,height:568});await create(page);await start(page);await playGeometry(page);
  await page.evaluate(async()=>{const {mutate}=await import('./storage.js');await mutate(data=>{data.profiles[0].balance='9'.repeat(200);});});
  await page.reload();await expect(page.locator('#club')).toBeVisible();await playGeometry(page);
  await page.locator('#balance').focus();await page.keyboard.press('End');await noDocumentScroll(page);
  expect(await page.locator('#balance').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
  await page.locator('#match-toggle').click();await page.locator('#new-game-form button[type=submit]').scrollIntoViewIfNeeded();await inside(page,'#new-game-form button[type=submit]');await noDocumentScroll(page);
});
