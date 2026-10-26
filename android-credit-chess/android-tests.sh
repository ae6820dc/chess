#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ADB="${ANDROID_HOME:?Set ANDROID_HOME}/platform-tools/adb"
case "$("$ADB" get-serialno)" in
  emulator-*) ;;
  *) echo 'Use a dedicated emulator; tests change its application state.'; exit 1 ;;
esac
"$ADB" shell cmd connectivity airplane-mode enable
python3 - <<'PY'
import json,os,subprocess,time
from pathlib import Path
adb=str(Path(os.environ['ANDROID_HOME'])/'platform-tools/adb')
specs=json.loads(Path('project.json').read_text())
def install(path):subprocess.run([adb,'install','-r',str(path)],check=True)
def run(spec,phase):
 runner=spec['package']+'.test/io.github.ae6820dc.studio.SmokeInstrumentation'
 subprocess.run([adb,'shell','settings','put','system','accelerometer_rotation','0'],check=True)
 subprocess.run([adb,'shell','settings','put','system','user_rotation','1' if phase=='verify' else '0'],check=True)
 result=subprocess.run([adb,'shell','am','instrument','-w','-e','phase',phase,runner],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=1800)
 print(result.stdout,flush=True)
 if result.returncode or 'PASS ' not in result.stdout or 'FAIL' in result.stdout:
  results=Path('../android-test-results');results.mkdir(exist_ok=True)
  with (results/'failure.png').open('wb') as out:subprocess.run([adb,'exec-out','screencap','-p'],stdout=out)
  with (results/'logcat.txt').open('w') as out:subprocess.run([adb,'logcat','-d','-t','1000'],stdout=out)
  raise SystemExit('Android smoke failed: '+spec['package']+' '+phase)
# Seed actual previous APK, including IndexedDB profiles, saved games and Arena.
install(Path('../android-distributions/credit-chess.apk'))
for flavor in specs:install(next(Path(f'app/build/outputs/apk/androidTest/{flavor}/debug').glob('*.apk')))
run(specs['creditChess'],'seed')
# No uninstall or data clearing: upgrade the old package in place.
for flavor,spec in specs.items():install(next(Path(f'app/build/outputs/apk/{flavor}/debug').glob('*.apk')))
run(specs['creditChess'],'verify')
run(specs['creditChess19'],'seed')
# Both processes coexist; separate tasks and launcher activities remain available.
for spec in specs.values():
 out=subprocess.check_output([adb,'shell','cmd','package','resolve-activity','--brief',spec['package']],text=True)
 assert 'MainActivity' in out,out
 subprocess.run([adb,'shell','am','start','-W','-n',spec['package']+'/io.github.ae6820dc.studio.MainActivity'],check=True)
for spec in specs.values():
 assert subprocess.check_output([adb,'shell','pidof',spec['package']],text=True).strip()
 print('Launcher resolved and process alive: '+spec['package'],flush=True)
for spec in specs.values():run(spec,'verify')
# Capture the actual Android launcher for visual review of both numbered icons.
results=Path('../android-test-results');results.mkdir(exist_ok=True)
subprocess.run([adb,'shell','settings','put','system','user_rotation','0'],check=True)
subprocess.run([adb,'shell','input','keyevent','KEYCODE_HOME'],check=True)
time.sleep(2)
subprocess.run([adb,'shell','input','swipe','540','1700','540','300','500'],check=True)
time.sleep(2)
with (results/'launcher.png').open('wb') as out:subprocess.run([adb,'exec-out','screencap','-p'],stdout=out,check=True)
subprocess.run([adb,'shell','uiautomator','dump','/sdcard/launcher.xml'],check=True)
subprocess.run([adb,'pull','/sdcard/launcher.xml',str(results/'launcher.xml')],check=True)

print('All packages tested offline; separate process invocations verified persisted state.')
PY
