#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./gradlew --no-daemon assembleCreditChessDebug lintCreditChessDebug
mkdir -p ../android-distributions
cp "app/build/outputs/apk/creditChess/debug/app-creditChess-debug.apk" "../android-distributions/credit-chess.apk"
python3 verify-apks.py
