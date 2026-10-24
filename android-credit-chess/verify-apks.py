"""Check actual APK signatures/manifests and all original packaged resource bytes."""
from pathlib import Path
import hashlib,json,os,re,subprocess,zipfile
project=Path(__file__).resolve().parent;repo=project.parent
sdk=Path(os.environ.get('ANDROID_HOME',str(Path.home()/'Android/Sdk')));tools=sdk/'build-tools/36.0.0'
names={'mathematics':'mathematics-studio','unicode':'unicode-studio','creditChess':'credit-chess'}
spec=json.loads((project/'project.json').read_text());report=[]
for flavor,info in spec.items():
 apk=repo/f'android-distributions/{names[flavor]}.apk'
 cert=subprocess.check_output([str(tools/'apksigner'),'verify','--verbose','--print-certs',str(apk)],text=True)
 assert '01059a5e2a9f61d6b88aff4f2b47bc4e33195b352ba01872858f71fd358ffb1e' in cert
 badging=subprocess.check_output([str(tools/'aapt'),'dump','badging',str(apk)],text=True)
 assert f"package: name='{info['package']}' versionCode='1'" in badging
 assert "sdkVersion:'26'" in badging and "targetSdkVersion:'36'" in badging
 assert 'android.permission.INTERNET' not in badging
 resources=subprocess.check_output([str(tools/'aapt'),'dump','--values','resources',str(apk)],text=True)
 assert re.search(r'Key=0x0101020d.*\(boolean\) false',resources)
 with zipfile.ZipFile(apk) as archive:
  assert archive.testzip() is None
  catalog=json.loads(archive.read('assets/catalog.json'))
  digests=json.loads(archive.read('assets/source-checksums.json'))
  for path,digest in digests.items():
   embedded=archive.read('assets/site/'+path+('.bin' if path.endswith('.gz') else ''))
   assert hashlib.sha256(embedded).hexdigest()==digest
   assert embedded==(repo/path).read_bytes(),path
  assert archive.read('assets/host.js')==(project/'host.js').read_bytes()
  assert len({p['id'] for p in catalog})==len(catalog)
  assert len({p['programId'] for p in catalog})==len(catalog)
  for p in catalog:assert len(p['programId'])==32
  if flavor=='creditChess':assert archive.read('assets/site/credit-chess/stockfish/vendor/stockfish-18-lite-single.wasm')[:4]==b'\0asm'
 row=dict(file=str(apk.relative_to(repo)),package=info['package'],versionCode=1,bytes=apk.stat().st_size,sha256=hashlib.sha256(apk.read_bytes()).hexdigest(),programs=len(catalog),originalAssets=len(digests))
 report.append(row);print(json.dumps(row))
(repo/'android-distributions/checksums.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: signed debug APKs; unique IDs; API 26–36; normal system bars; offline configuration; all original assets unchanged')
