#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./gradlew --no-daemon assembleCreditChessDebug assembleCreditChess19Debug lintCreditChessDebug lintCreditChess19Debug
mkdir -p ../android-distributions
cp "app/build/outputs/apk/creditChess/debug/app-creditChess-debug.apk" "../android-distributions/Credit-Chess-18.apk"
cp "app/build/outputs/apk/creditChess19/debug/app-creditChess19-debug.apk" "../android-distributions/Credit-Chess-19.apk"
python3 verify-apks.py
