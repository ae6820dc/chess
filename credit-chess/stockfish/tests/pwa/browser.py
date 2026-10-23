"""Real desktop Chromium installs via CDP. Requires headed Chrome (use xvfb-run).
This does not emulate Android WebAPK installation or Android link handling.
"""
from playwright.sync_api import sync_playwright, expect
from urllib.parse import urljoin
from pathlib import Path
import atexit, json, os, tempfile, time
BASE='http://127.0.0.1:4174'
CHESS='/chess/credit-chess/stockfish/'
ROOT=Path(__file__).resolve().parents[4]
OTHER=Path(os.environ.get('PWA_9062_ROOT',ROOT.parent/'9062'))
entries=[f'/9062/unicode/{v}/sample{n}.html' for v in (7,8,9) for n in (1,2,3)]
entries += [f'/9062/calculator/{folder.name}/sample{n}.html' for folder in sorted((OTHER/'calculator').iterdir()) if (folder/'manifest1.webmanifest').exists() for n in (1,2)]
entries += [CHESS+'tablet.html']
results={'environment':'desktop Chrome, native CDP PWA install/launch; NOT Android','installed':[],'offline':[],'viewports':[]}
atexit.register(lambda: Path('pwa-results.json').write_text(json.dumps(results,indent=2)))
def ready(page):
 page.wait_for_function("navigator.serviceWorker.controller !== null",timeout=60000)
 page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
def launch(cdp,identity,start):
 result=cdp.send('PWA.launch',{'manifestId':identity})
 deadline=time.monotonic()+20
 while time.monotonic()<deadline:
  info=cdp.send('Target.getTargetInfo',{'targetId':result['targetId']})['targetInfo']
  if info['url']==start:
   # Keep installation, close the test launch window (Chess intentionally
   # permits only one writer tab for clock/credit integrity).
   found=False
   for candidate in context.pages:
    session=context.new_cdp_session(candidate)
    target=session.send('Target.getTargetInfo')['targetInfo']['targetId']
    session.detach()
    if target==result['targetId']:
     expect(candidate.locator('body')).to_be_visible()
     mode=candidate.evaluate("({fullscreen:matchMedia('(display-mode: fullscreen)').matches,standalone:matchMedia('(display-mode: standalone)').matches})")
     assert mode['fullscreen'] or mode['standalone'],mode
     results.setdefault('launch_modes',{})[identity]=mode
     found=True;break
   assert found,'App launch target not visible to browser automation'
   cdp.send('Target.closeTarget',{'targetId':result['targetId']})
   return result['targetId']
  time.sleep(.1)
 raise AssertionError(f'Wrong launch: {identity}: {info}')
with sync_playwright() as p:
 with tempfile.TemporaryDirectory() as profile:
  context=p.chromium.launch_persistent_context(profile,executable_path=os.environ.get('PWA_BROWSER_PATH','/usr/bin/google-chrome'),headless=False,args=['--no-sandbox','--no-first-run'],viewport={'width':1024,'height':768})
  context.set_default_timeout(30000)
  cdp=context.browser.new_browser_cdp_session()
  page=context.new_page()
  page.goto(BASE+CHESS+'tablet.html');ready(page)
  page.evaluate("localStorage.setItem('pwa-preservation-sentinel','keep')")
  page.locator('[data-tab=settings]').click();page.locator('#generate-user').click();page.locator('#pin').fill('1111');page.locator('#pin-form button[value=generate]').click()
  expect(page.locator('#balance')).to_have_text('100.000')
  snapshot=page.evaluate("async()=>await(await import('./storage.js')).read()")
  for entry in ('desktop.html','tablet.html'):
   for width,height in ((360,800),(412,915),(768,1024),(1024,768)):
    page.set_viewport_size({'width':width,'height':height});page.goto(BASE+CHESS+entry)
    expect(page.locator('#club')).to_be_visible();expect(page.locator('#board .square')).to_have_count(64)
    expect(page.locator('#balance')).to_have_text('100.000')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    results['viewports'].append([entry,width,height])
  apps=[]
  for entry in entries:
   page.goto(BASE+entry);ready(page)
   data=page.evaluate("""async()=>{const href=document.querySelector('link[rel=manifest]').href;
    const m=await(await fetch(href,{cache:'no-store'})).json();const start=new URL(m.start_url,href).href;
    return {manifest:href,id:new URL(m.id,new URL(start).origin+'/').href,start,scope:new URL(m.scope,href).href};}""")
   # Chromium's own manifest parser must accept the intended ID, URL and scope.
   parsed=context.new_cdp_session(page).send('Page.getAppManifest')
   assert not [e for e in parsed.get('errors',[]) if e.get('critical')],parsed
   if parsed.get('parsed'):
    assert parsed['parsed']['scope']==data['scope'],parsed
   assert not any(data['id']==a['id'] or data['start'].startswith(a['scope']) or a['start'].startswith(data['scope']) for a in apps)
   cdp.send('PWA.install',{'manifestId':data['id'],'installUrlOrBundleUrl':BASE+entry})
   launch(cdp,data['id'],data['start'])
   apps.append(data);results['installed'].append(data);print('INSTALLED',data['id'],flush=True)
  # All remain installed together; re-launch every app after the LAST install.
  for app in apps:launch(cdp,app['id'],app['start'])
  page.goto(BASE+CHESS+'tablet.html');ready(page)
  assert page.evaluate("localStorage.getItem('pwa-preservation-sentinel')")=='keep'
  assert page.evaluate("async()=>await(await import('./storage.js')).read()") == snapshot
  # All network disabled: fresh navigations, old Chess query launch, and real WASM UCI.
  context.set_offline(True)
  for entry in entries+[CHESS+'desktop.html',CHESS+'tablet.html?standalone=2']:
   page.goto(BASE+entry)
   assert page.locator('body').inner_text().strip()
   if '/stockfish/' in entry:expect(page.locator('#balance')).to_have_text('100.000')
   results['offline'].append(entry)
  page.goto(BASE+CHESS+'tablet.html')
  moves=page.evaluate("""async()=>{const {StockfishAdapter}=await import('./engine.js');const {Chess}=await import('./vendor/chess.js');
   const a=new StockfishAdapter(),chess=new Chess();try{await a.ready;const moves=[];for(let i=0;i<4;i++){
    const move=await a.move({moves,difficulty:'1320',milliseconds:50});
    if(!chess.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]}))throw Error('Illegal move');moves.push(move);
   }return moves;}finally{a.close();}}""")
  assert len(moves)==4;results['offline_wasm_moves']=moves
  assert page.evaluate("async()=>await(await import('./storage.js')).read()") == snapshot
  context.close()
 Path('pwa-results.json').write_text(json.dumps(results,indent=2))
 print(json.dumps(results,indent=2))
