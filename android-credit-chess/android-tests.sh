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
import json,os,subprocess
from pathlib import Path
adb=str(Path(os.environ['ANDROID_HOME'])/'platform-tools/adb')
for flavor,spec in json.loads(Path('project.json').read_text()).items():
 for path in [f'app/build/outputs/apk/{flavor}/debug',f'app/build/outputs/apk/androidTest/{flavor}/debug']:
  apk=next(Path(path).glob('*.apk'));subprocess.run([adb,'install','-r',str(apk)],check=True)
 runner=spec['package']+'.test/io.github.ae6820dc.studio.SmokeInstrumentation'
 for phase in ('seed','verify'):
  subprocess.run([adb,'shell','settings','put','system','accelerometer_rotation','0'],check=True)
  subprocess.run([adb,'shell','settings','put','system','user_rotation','1' if phase=='verify' else '0'],check=True)
  result=subprocess.run([adb,'shell','am','instrument','-w','-e','phase',phase,runner],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=1800)
  print(result.stdout,flush=True)
  if result.returncode or 'PASS ' not in result.stdout or 'FAIL' in result.stdout:raise SystemExit('Android smoke failed: '+spec['package']+' '+phase)
print('All packages tested offline; separate process invocations verified persisted state.')
PY
