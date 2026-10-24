"""Browser checks against APK-extracted assets at isolated local HTTPS origins.
Not a replacement for Android runtime tests. Requires Playwright and Chromium.
"""
from pathlib import Path
import http.server,json,os,ssl,subprocess,tempfile,threading,urllib.parse,zipfile
from playwright.sync_api import sync_playwright
project=Path(__file__).resolve().parent;repo=project.parent
names={'mathematics':'mathematics-studio','unicode':'unicode-studio','creditChess':'credit-chess'}
with tempfile.TemporaryDirectory() as tmp:
 temp=Path(tmp);mapping={};entries=[]
 for flavor in json.loads((project/'project.json').read_text()):
  directory=temp/flavor;directory.mkdir()
  with zipfile.ZipFile(repo/f'android-distributions/{names[flavor]}.apk') as archive:archive.extractall(directory)
  catalog=json.loads((directory/'assets/catalog.json').read_text())
  for p in catalog:mapping[p['id']+'.appassets.androidplatform.net']=directory/'assets';entries.append((p,directory/'assets'))
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(temp/'key.pem'),'-out',str(temp/'cert.pem'),'-days','1','-subj','/CN=localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 class Handler(http.server.SimpleHTTPRequestHandler):
  extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,'.js':'application/javascript','.wasm':'application/wasm'}
  def translate_path(self,path):
   assets=mapping.get(self.headers.get('Host','').split(':')[0]);path=urllib.parse.unquote(urllib.parse.urlsplit(path).path)
   if assets is None or '..' in path.split('/'):return '/nonexistent'
   return str(assets/'site'/path.lstrip('/'))
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
 ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain(temp/'cert.pem',temp/'key.pem');server.socket=ctx.wrap_socket(server.socket,server_side=True)
 threading.Thread(target=server.serve_forever,daemon=True).start();port=server.server_address[1]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP *.appassets.androidplatform.net 127.0.0.1'])
  context=browser.new_context(ignore_https_errors=True,service_workers='block')
  context.route('**/*',lambda r:r.continue_() if '.appassets.androidplatform.net:' in r.request.url else r.abort())
  context.add_init_script("window.StudioDownloads={save:(name,mime,data)=>window.__download={name,mime,data},error:message=>{throw Error(message)}}")
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  for p,assets in entries:
   origin=f'https://{p["id"]}.appassets.androidplatform.net:{port}'
   page.goto(origin+'/'+p['path']);page.evaluate((assets/'host.js').read_text())
   assert page.evaluate('isSecureContext')
   if p['kind']!='chess':assert p['programId'] in page.locator('body').inner_text()
   assert page.evaluate("localStorage.getItem('studio-test')") is None
   page.evaluate('(id)=>localStorage.setItem("studio-test",id)',p['id'])
   if p['kind']=='calculator':
    page.locator('#calculate').click();page.wait_for_function("!document.querySelector('#calculate').disabled",timeout=30000)
    assert not page.locator('#error').is_visible()
    assert page.locator('#history details').count()==1
    page.evaluate("document.querySelector('#export').click()")
    page.wait_for_function('!!window.__download')
    download=page.evaluate('window.__download')
    import base64
    assert json.loads(base64.b64decode(download['data']))['programId']==p['programId']
   elif p['kind']=='unicode' and p['storageKey']:
    page.locator('#set').select_option('hu');page.locator('#next').click()
    assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).set',p['storageKey'])=='hu'
   elif p['kind']=='unicode':
    page.locator('#page').fill('7');page.locator('#generate').click();page.evaluate('studioSaveForm()')
   else:
    result=page.evaluate("""async()=>{const {StockfishAdapter}=await import('./engine.js');const {Chess}=await import('./vendor/chess.js');const a=new StockfishAdapter();try{const range=await a.ready,game=new Chess(),moves=[];for(let i=0;i<4;i++){const move=await a.move({moves,difficulty:'MAX',milliseconds:50});if(!game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]}))throw Error('Illegal engine move');moves.push(move)}return {range,moves}}finally{a.close()}}""")
    assert len(result['moves'])==4;print('Packaged Stockfish WASM proof:',result,flush=True)
   for width,height in [(320,740),(740,320),(800,1280),(1280,800)]:
    page.set_viewport_size({'width':width,'height':height})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(p['id'],width)
   print(p['id']+': original ID, isolated origin, local resources and responsive geometry PASS',flush=True)
  for p,assets in entries:
   page.goto(f'https://{p["id"]}.appassets.androidplatform.net:{port}/'+p['path']);page.evaluate((assets/'host.js').read_text())
   assert page.evaluate('localStorage.getItem("studio-test")')==p['id']
   if p['kind']=='calculator':assert page.locator('#history details').count()==1
   elif p['kind']=='unicode' and p['storageKey']:assert page.locator('#set').input_value()=='hu'
   elif p['kind']=='unicode':assert page.locator('#page').input_value()=='7'
  assert errors==[],errors
  context.close();browser.close()
 server.shutdown()
 print(f'PASS: {len(entries)} APK-packaged programs; switching/reload state; four phone/tablet viewports; no external requests')
