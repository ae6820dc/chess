"""Install and launch both editions together; first run tests/pwa/server.py."""
from playwright.sync_api import sync_playwright
import tempfile, os
with sync_playwright() as p, tempfile.TemporaryDirectory() as d:
 c=p.chromium.launch_persistent_context(d,executable_path=os.environ.get('PWA_BROWSER_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 b=c.browser.new_browser_cdp_session();page=c.new_page()
 for v in [18,19]:
  url='http://127.0.0.1:4174/chess/credit-chess/stockfish'+('-19' if v==19 else '')+'/tablet.html'
  page.goto(url);page.wait_for_function('navigator.serviceWorker.controller!==null')
  manifest=page.evaluate("async()=>{const u=document.querySelector('link[rel=manifest]').href;return await(await fetch(u)).json()}")
  identity='http://127.0.0.1:4174'+manifest['id']
  print('install',v,b.send('PWA.install',{'manifestId':identity,'installUrlOrBundleUrl':url}),flush=True)
  print('launch',v,b.send('PWA.launch',{'manifestId':identity}),flush=True)
 for v in [18,19]:
  identity='http://127.0.0.1:4174/chess/credit-chess/stockfish'+('-19' if v==19 else '')+'/tablet-app-v3'
  assert b.send('PWA.launch',{'manifestId':identity})['targetId']
 print('PASS: both editions remain installed and launch independently',flush=True)
 c.close()
