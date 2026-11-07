"""Reproducible offline APK; native engine compiled from pinned official SF19 source."""
from pathlib import Path
import os, sys, subprocess, shutil, json, zipfile, tarfile, hashlib, re
here=Path(__file__).resolve().parent
repo=here.parent
out=here/'build';out.mkdir(exist_ok=True)
sdk=Path(os.environ.get('ANDROID_HOME','/tmp/android-sdk'))
bt=sdk/'build-tools/36.0.0';android=sdk/'platforms/android-36/android.jar'
ndk=sdk/'ndk/27.2.12479018/toolchains/llvm/prebuilt/linux-x86_64/bin'
env=os.environ.copy();env['PATH']=str(ndk)+os.pathsep+env['PATH']
package='io.github.ae6820dc.creditchess.sf19native'
program_id='8b9057d3e62c4af1';storage_key='e761b4c3092af85d'
def run(*args,**kwargs):subprocess.run([str(a) for a in args],check=True,**kwargs)
def download(url,path):
 if not path.exists():run('curl','-fL','--retry','3',url,'-o',path)
archive=out/'stockfish19.tar.gz'
download('https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-android-arm64-universal.tar.gz',archive)
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='ebb24051aa4a222b4daaf049b882ecf1163d370c128fe02316602643f4d5e426','Stockfish release checksum mismatch'
if not (out/'stockfish/src').exists():
 with tarfile.open(archive) as t:t.extractall(out,filter='data')
source=out/'stockfish'
net='nn-1a298aa575a0.nnue'
download('https://tests.stockfishchess.org/api/nn/'+net,source/'src'/net)
assert hashlib.sha256((source/'src'/net).read_bytes()).hexdigest().startswith('1a298aa575a0'),'NNUE checksum mismatch'
# Use Stockfish's own incbin helper for the universal NNUE object to avoid a
# 376 MiB C++ string literal. The exact network bytes and engine are unchanged.
embed=source/'src/universal/nnue_embed.cpp'
license_header=embed.read_text().split('*/',1)[0]+'*/\n'
embed.write_text(license_header+'// Android APK build: memory-efficient embedding.\n#define INCBIN_SILENCE_BITCODE_WARNING\n#include "../incbin/incbin.h"\n#include "../evaluate.h"\nINCBIN(EmbeddedNNUE, EvalFileDefaultName);\n')
net_script=source/'scripts/net.sh'
net_script.write_text(net_script.read_text().replace('if [ "$1" = "0" ]; then','if false; then'))
abi='x86_64' if '--test-x86' in sys.argv else 'arm64-v8a'
arch='x86-64' if abi=='x86_64' else 'arm64-universal'
native=out/abi/'libstockfish.so';native.parent.mkdir(exist_ok=True)
if not native.exists():
 run('make','clean',cwd=source/'src',env=env)
 run('make','-j2','build','COMP=ndk','ARCH='+arch,'EXTRALDFLAGS=-Wl,-z,max-page-size=16384',cwd=source/'src',env=env)
 run(ndk/'llvm-strip',source/'src/stockfish')
 shutil.copyfile(source/'src/stockfish',native)
assert native.stat().st_size>(source/'src'/net).stat().st_size,'Native binary is missing embedded NNUE'
# Offline web assets: copy the referenced application; replace only the Android engine and labels.
assets=out/'assets';shutil.rmtree(assets,ignore_errors=True)
site=assets/'site/credit-chess/stockfish';site.mkdir(parents=True)
base=repo/'credit-chess/stockfish'
for f in base.rglob('*'):
 if not f.is_file() or any(x in f.relative_to(base).parts for x in ('tests','docs','node_modules','icons')):continue
 if f.suffix not in {'.html','.js','.css','.svg','.png','.webmanifest','.txt'}:continue
 if f.name.startswith('stockfish-') or f.name in ('playwright.config.js','sw.js'):continue
 target=site/f.relative_to(base);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
 if f.suffix in {'.html','.js','.webmanifest'}:
  s=target.read_text().replace('Stockfish 18','Stockfish 19').replace('STOCKFISH 18','STOCKFISH 19')
  s=s.replace('47f4d94492933a3b0a3f406e6e4ce412',program_id).replace('bbebe43a0b38a335',storage_key)
  s=s.replace('MAX · unrestricted lite engine','MAX · full native engine')
  s=s.replace('Stockfish 19 lite · real WASM engine · all assets bundled','Stockfish 19 · native NNUE · offline')
  s=s.replace('Two independent, single-threaded engine workers, each with a 16 MB hash budget.','Two independent native Stockfish 19 processes, each with 64 MB hash and up to 4 CPU threads.')
  s=s.replace('<a href="README.md">Capabilities, tests & limitations</a>','')
  s=s.replace('<a href="vendor/stockfish-source.tar.gz">Stockfish source</a>','')
  s=s.replace('max="2000" value="200"','max="60000" value="3000"')
  target.write_text(s)
shutil.copyfile(here/'engine.js',site/'engine.js')
# Full strength by default, independently adjustable actual search budget (response delay stays separate).
p=site/'core.js';s=p.read_text().replace("difficulty:'1320'","difficulty:'MAX'").replace("responseDelay:0,","responseDelay:0,thinkTime:3000,");p.write_text(s)
for name in ('desktop.html','tablet.html'):
 p=site/name;s=p.read_text().replace('<label>Stockfish response delay', '<label>Engine think time · milliseconds<input id="think-time" type="number" min="100" max="60000" step="100" value="3000"></label><p class="muted">Actual calculation time per move. MAX uses the full native Stockfish 19 engine.</p><label>Stockfish response delay');p.write_text(s)
p=site/'app.js';s=p.read_text().replace("const delay=prefs.responseDelay??0;", "$('think-time').value=prefs.thinkTime??3000;\n const delay=prefs.responseDelay??0;")
s=s.replace("game.arena.speed:600", "game.arena.speed:(prefs.thinkTime??3000)")
s=s.replace("if('serviceWorker' in navigator)","if(false)")
s=s.replace("game.arena.speed", "game.arena.speed")
s=s.replace("speed>2000", "speed>60000").replace('20–2000','20–60000')
s += "\n$('think-time').onchange=()=>enqueue(async()=>{const value=Number($('think-time').value);if(!Number.isInteger(value)||value<100||value>60000)throw Error('Think time must be 100–60000 ms');prefs.thinkTime=value;await savePrefs(profile.id,prefs);});\n"
p.write_text(s)
# Update validators where Arena limit was formerly 2 seconds.
for p in [site/'storage.js',site/'arena.js']:
 s=p.read_text().replace('speed>2000','speed>60000').replace('speed > 2000','speed > 60000');p.write_text(s)
p=site/'storage.js';s=p.read_text().replace("if(f.responseDelay!==undefined", "if(f.thinkTime!==undefined&&(!Number.isInteger(f.thinkTime)||f.thinkTime<100||f.thinkTime>60000))throw Error('Invalid engine think time');\n  if(f.responseDelay!==undefined");p.write_text(s)
shutil.copyfile(source/'Copying.txt',site/'vendor/STOCKFISH-LICENSE.txt')
shutil.copyfile(repo/'android-credit-chess/host.js',assets/'host.js')
(assets/'catalog.json').write_text(json.dumps([dict(id='credit-chess-sf19-native',kind='chess',group='Credit Chess',name='Stockfish 19 Native',path='credit-chess/stockfish/index.html',programId=program_id,storageKey=storage_key)]))
res=out/'res';shutil.rmtree(res,ignore_errors=True);(res/'values').mkdir(parents=True);(res/'drawable').mkdir()
shutil.copyfile(repo/'android-credit-chess/app/src/main/res/values/styles.xml',res/'values/styles.xml')
shutil.copyfile(repo/'android-credit-chess/app/src/creditChess19/res/drawable/ic_launcher.xml',res/'drawable/ic_launcher.xml')
(res/'values/name.xml').write_text('<resources><string name="app_name">Credit Chess · Stockfish 19</string></resources>')
manifest=(repo/'android-credit-chess/app/src/main/AndroidManifest.xml').read_text().replace('<manifest ', '<manifest package="'+package+'" ').replace('android:name=".MainActivity"','android:name="io.github.ae6820dc.studio.MainActivity"').replace('<application ','<application android:extractNativeLibs="true" ')
(out/'AndroidManifest.xml').write_text(manifest)
run(bt/'aapt2','compile','--dir',res,'-o',out/'resources.zip')
run(bt/'aapt2','link','-I',android,'--manifest',out/'AndroidManifest.xml','--min-sdk-version','29','--target-sdk-version','36','--version-code','1','--version-name','19.0-native','-A',assets,'-o',out/'unsigned.apk',out/'resources.zip')
classes=out/'classes';dex=out/'dex';classes.mkdir(exist_ok=True);dex.mkdir(exist_ok=True)
run('javac','-source','8','-target','8','-classpath',android,'-d',classes,here/'MainActivity.java',here/'NativeEngine.java')
run(bt/'d8','--min-api','29','--lib',android,'--output',dex,*classes.rglob('*.class'))
with zipfile.ZipFile(out/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:
 z.write(dex/'classes.dex','classes.dex');z.write(native,'lib/'+abi+'/libstockfish.so')
def sign(src,dest):
 aligned=out/'aligned.apk';run(bt/'zipalign','-f','-p','4',src,aligned)
 run(bt/'apksigner','sign','--ks',repo/'android-credit-chess/signing/studio-debug.jks','--ks-key-alias','unicode-test','--ks-pass','pass:android','--key-pass','pass:android','--out',dest,aligned)
 run(bt/'apksigner','verify','--verbose',dest)
apk=out/('Credit-Chess-Stockfish-19'+('-x86-test' if abi=='x86_64' else '')+'.apk');sign(out/'unsigned.apk',apk)
if abi=='x86_64':
 tm=out/'test-manifest.xml';tm.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="'+package+'.test"><application android:label="Native Stockfish tests"/><instrumentation android:name="io.github.ae6820dc.studio.SmokeInstrumentation" android:targetPackage="'+package+'"/></manifest>')
 run(bt/'aapt2','link','-I',android,'--manifest',tm,'--min-sdk-version','29','--target-sdk-version','36','-o',out/'test-unsigned.apk')
 tc=out/'test-classes';td=out/'test-dex';tc.mkdir(exist_ok=True);td.mkdir(exist_ok=True)
 run('javac','-source','8','-target','8','-classpath',str(android)+os.pathsep+str(classes),'-d',tc,here/'SmokeInstrumentation.java')
 run(bt/'d8','--min-api','29','--lib',android,'--classpath',classes,'--output',td,*tc.rglob('*.class'))
 with zipfile.ZipFile(out/'test-unsigned.apk','a') as z:z.write(td/'classes.dex','classes.dex')
 sign(out/'test-unsigned.apk',out/'tests.apk')
else:
 # Matching GPL source, network and complete app source beside the binary.
 with tarfile.open(out/'Credit-Chess-Stockfish-19-source.tar.gz','w:gz') as t:
  for f in source.rglob('*'):
   if f.is_file() and not any(x in f.relative_to(source).parts for x in ('temp_builds',)) and f.suffix not in {'.o','.d','.bc','.ll','.s'} and f.name not in {'stockfish','stockfish-android-arm64-universal'}:t.add(f,arcname='stockfish/'+str(f.relative_to(source)))
  for f in here.iterdir():
   if f.is_file():t.add(f,arcname='app/'+f.name)
  for f in assets.rglob('*'):
   if f.is_file():t.add(f,arcname='packaged-assets/'+str(f.relative_to(assets)))
 (out/'Credit-Chess-Stockfish-19.apk.sha256').write_text(hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+apk.name+'\n')
print('PASS: signed offline native Stockfish 19 APK:',apk)
