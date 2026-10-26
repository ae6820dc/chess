import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const sizes=[[320,568],[360,800],[412,915],[600,960],[768,1024],[568,320],[640,360],[844,390],[915,412],[1024,768],[1024,1366],[1366,768],[1920,1080],[2560,1440]];
for(const entry of ['desktop.html','tablet.html']) {
  test(`${entry}: maximum board across screen sizes and rotations`,async({page})=>{
    await page.goto('/credit-chess/stockfish-19/'+entry);
    await expect(page.locator('#board .square')).toHaveCount(64);
    await page.locator('[data-tab=settings]').click();
    await page.locator('#generate-user').click();await page.locator('#pin').fill('1111');
    await page.locator('#pin-form button[value=generate]').click();
    await expect(page.locator('#balance')).toHaveText('100.000');
    await page.locator('[data-tab=play]').click();
    const toggle=page.locator('#match-toggle');
    if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
    await page.locator('#mode').selectOption('analysis');
    await page.locator('#new-game-form button').click();
    await expect(page.locator('#game-status')).toContainText('White to move');
    const measurements=[];
    for(const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await expect.poll(()=>page.evaluate(()=>parseFloat(document.documentElement.style.getPropertyValue('--app-height'))),{message:JSON.stringify(await page.evaluate(()=>({innerWidth,innerHeight,visualHeight:visualViewport.height,scale:visualViewport.scale,appHeight:document.documentElement.style.getPropertyValue('--app-height')})))}).toBe(height);
      // Close optional setup panels to measure the playing surface.
      await page.evaluate(async()=>{const {setPane}=await import('./layout.js');setPane('none');});
      await expect.poll(()=>page.locator('#board').evaluate(e=>{
        const r=e.getBoundingClientRect(),s=e.parentElement.getBoundingClientRect();
        return Math.abs(r.width-Math.floor(Math.min(s.width,s.height)))<=1;
      })).toBe(true);
      const m=await page.locator('#board').evaluate(e=>{
        const r=e.getBoundingClientRect(),piece=e.querySelector('.piece'),square=e.querySelector('.square');
        return {x:r.x,y:r.y,size:r.width,pieceSize:parseFloat(getComputedStyle(piece).fontSize),squareSize:square.getBoundingClientRect().width,overflowY:document.documentElement.scrollHeight-innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,bottom:r.bottom};
      });
      expect(m.x).toBeGreaterThanOrEqual(0);expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.bottom).toBeLessThanOrEqual(height);expect(m.x+m.size).toBeLessThanOrEqual(width);
      expect(m.overflow).toBe(0);expect(m.overflowY).toBe(0);
      for(const id of ['top-clock','bottom-clock','game-status','resign','undo','claim']) {
        const r=await page.locator('#'+id).boundingBox();
        expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(height+1);
      }
      // Portrait is width-limited; landscape reserves only the two clock rows.
      expect(m.size).toBeGreaterThanOrEqual(width<height?Math.min(width-12,height-330):Math.min(width-400,height-80));
      expect(m.pieceSize/m.squareSize).toBeGreaterThan(.95);
      expect(m.pieceSize/m.squareSize).toBeLessThan(.97);
      const fits=await page.locator('#board .piece').evaluateAll(els=>els.every(e=>{
        const r=e.getBoundingClientRect(),s=e.parentElement.getBoundingClientRect();
        return r.width<=s.width+1&&r.height<=s.height+1;
      }));expect(fits).toBe(true);
      // Optional tools remain usable even in the shortest landscape rail.
      const history=page.locator('#history-toggle');
      if(await history.isVisible()) {
        await history.click();await expect(page.locator('#moves')).toBeVisible();
        const close=page.locator('#panel-close');
        if(await close.isVisible())await close.click();else await history.click();
      }
      await page.locator('#manual-move summary').click();
      for(const id of ['from','to']) {
        const r=await page.locator('#'+id).boundingBox();
        expect(r.y+r.height).toBeLessThanOrEqual(height+1);
      }
      await page.locator('#manual-move summary').click();
      measurements.push({width,height,...m});
      await mkdir('test-results/issue-6',{recursive:true});
      await page.screenshot({path:`test-results/issue-6/${entry}-${width}x${height}.png`});
    }
    await writeFile(`test-results/issue-6/${entry}.json`,JSON.stringify(measurements,null,2));
    console.log(entry,JSON.stringify(measurements));
  });
}
