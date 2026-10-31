"""Build the existing offline Credit Chess 18 host with Android SDK tools only."""
from pathlib import Path
import os,subprocess,shutil,json,zipfile,hashlib
root=Path(__file__).resolve().parent.parent
project=root/'android-credit-chess'
out=root/'android-credit-chess-refresh/build'
out.mkdir(parents=True,exist_ok=True)
sdk=Path(os.environ['ANDROID_HOME']);bt=sdk/'build-tools/36.0.0';android=sdk/'platforms/android-36/android.jar'
def run(*args):subprocess.run([str(x) for x in args],check=True)
run('python3',project/'prepare-assets.py')
res=out/'res'
if res.exists():shutil.rmtree(res)
shutil.copytree(project/'app/build/generated/resources/main',res)
shutil.copytree(project/'app/build/generated/resources/creditChess',res,dirs_exist_ok=True)
(res/'values/app-name.xml').write_text('<resources><string name="app_name">Credit Chess 18</string></resources>')
manifest=(project/'app/src/main/AndroidManifest.xml').read_text().replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android">','<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="io.github.ae6820dc.studio">').replace('android:name=".MainActivity"','android:name="io.github.ae6820dc.studio.MainActivity"')
(out/'AndroidManifest.xml').write_text(manifest)
assets=project/'app/build/generated/offline/creditChess'
run(bt/'aapt2','compile','--dir',res,'-o',out/'resources.zip')
run(bt/'aapt2','link','-I',android,'--manifest',out/'AndroidManifest.xml','--rename-manifest-package','io.github.ae6820dc.creditchess','--min-sdk-version','26','--target-sdk-version','36','--version-code','3','--version-name','1.1','-A',assets,'-o',out/'unsigned.apk',out/'resources.zip')
classes=out/'classes';dex=out/'dex';classes.mkdir(exist_ok=True);dex.mkdir(exist_ok=True)
run('javac','-source','8','-target','8','-classpath',android,'-d',classes,project/'app/src/main/java/io/github/ae6820dc/studio/MainActivity.java')
run(bt/'d8','--min-api','26','--lib',android,'--output',dex,*classes.rglob('*.class'))
def sign(unsigned,aligned,apk):
 run(bt/'zipalign','-f','-p','4',unsigned,aligned)
 run(bt/'apksigner','sign','--ks',project/'signing/studio-debug.jks','--ks-key-alias','unicode-test','--ks-pass','pass:android','--key-pass','pass:android','--out',apk,aligned)
 run(bt/'apksigner','verify','--verbose',apk)
with zipfile.ZipFile(out/'unsigned.apk','a') as z:z.write(dex/'classes.dex','classes.dex')
apk=out/'Credit-Chess-18.apk';sign(out/'unsigned.apk',out/'aligned.apk',apk)
tm=out/'test-manifest.xml'
tm.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="io.github.ae6820dc.creditchess.test"><application android:label="Credit Chess offline tests"/><instrumentation android:name="io.github.ae6820dc.studio.SmokeInstrumentation" android:targetPackage="io.github.ae6820dc.creditchess"/></manifest>')
run(bt/'aapt2','link','-I',android,'--manifest',tm,'--min-sdk-version','26','--target-sdk-version','36','-o',out/'test-unsigned.apk')
tc=out/'test-classes';td=out/'test-dex';tc.mkdir(exist_ok=True);td.mkdir(exist_ok=True)
run('javac','-source','8','-target','8','-classpath',str(android)+os.pathsep+str(classes),'-d',tc,project/'app/src/androidTest/java/io/github/ae6820dc/studio/SmokeInstrumentation.java')
run(bt/'d8','--min-api','26','--lib',android,'--classpath',classes,'--output',td,*tc.rglob('*.class'))
with zipfile.ZipFile(out/'test-unsigned.apk','a') as z:z.write(td/'classes.dex','classes.dex')
sign(out/'test-unsigned.apk',out/'test-aligned.apk',out/'tests.apk')
with zipfile.ZipFile(apk) as z:
 digests=json.loads(z.read('assets/source-checksums.json'))
 for path,digest in digests.items():
  data=z.read('assets/site/'+path+('.bin' if path.endswith('.gz') else ''))
  assert data==(root/path).read_bytes(),path
  assert hashlib.sha256(data).hexdigest()==digest,path
 assert z.read('assets/site/credit-chess/stockfish/vendor/stockfish-18-lite-single.wasm')[:4]==b'\0asm'
cert=subprocess.check_output([str(bt/'apksigner'),'verify','--print-certs',str(apk)],text=True)
oldcert=subprocess.check_output([str(bt/'apksigner'),'verify','--print-certs',str(root/'android-distributions/Credit-Chess-18.apk')],text=True)
def digest(s):return next(x for x in s.splitlines() if 'certificate SHA-256 digest:' in x)
assert digest(cert)==digest(oldcert),'Update signer mismatch'
print('PASS: signed Android 8–16 APK; all current source files and WASM byte-identical; same update signer')
