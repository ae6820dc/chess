"""Audit identities, disjoint app scopes, PNGs and maskable safe circles."""
from pathlib import Path
from urllib.parse import urljoin
import json, math, os, struct
from PIL import Image
ROOT=Path(__file__).resolve().parents[4]
OTHER=Path(os.environ.get('PWA_9062_ROOT',ROOT.parent/'9062'))
origin='https://ae6820dc.github.io'
files=[(ROOT/'credit-chess/stockfish/tablet.webmanifest','/chess/credit-chess/stockfish/tablet.webmanifest')]
files += [(ROOT/'credit-chess/stockfish-19/tablet.webmanifest','/chess/credit-chess/stockfish-19/tablet.webmanifest')]
files += [(p,'/9062/'+str(p.relative_to(OTHER))) for p in OTHER.rglob('*.webmanifest') if p.parts[-3:-1] != ('tests','fixtures')]
apps=[]
for path,url in files:
 m=json.loads(path.read_text());manifest=origin+url
 start=urljoin(manifest,m['start_url']); scope=urljoin(manifest,m['scope']); identity=urljoin(origin+'/',m['id'])
 assert start.startswith(scope),(path,start,scope)
 assert identity.startswith(origin+'/') and '#' not in identity,(path,identity)
 assert m['display'] in ('standalone','fullscreen')
 for purpose in ('any','maskable'):
  for size in (192,512):
   item=next(i for i in m['icons'] if i.get('purpose','any')==purpose and i['sizes']==f'{size}x{size}')
   raw=(path.parent/item['src']).read_bytes()
   assert raw[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',raw[16:24])==(size,size)
   if purpose=='maskable':
    image=Image.open(path.parent/item['src']).convert('RGB');bg=image.getpixel((0,0))
    assert all(pixel==bg or math.hypot((n%size+.5)/size-.5,(n//size+.5)/size-.5)<=.4 for n,pixel in enumerate(image.getdata())),(path,item['src'],'maskable safe circle')
 apps.append({'manifest':manifest,'id':identity,'start_url':start,'scope':scope})
assert len({a['id'] for a in apps})==len(apps),'duplicate application IDs'
assert len({a['start_url'] for a in apps})==len(apps),'duplicate launch URLs'
for a in apps:
 for b in apps:
  if a is not b: assert not a['start_url'].startswith(b['scope']),(a,b)
print(json.dumps(apps,indent=2))
print(f'PASS: {len(apps)} unique identities, launch URLs, disjoint scopes and complete PNG icons')
