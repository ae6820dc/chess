# Credit Chess 19 standalone APK
Offline Android application for credit-chess/stockfish-19/index.html and its Desktop/Tablet layouts. The current original assets and colors are bundled unchanged, including Stockfish 19 Lite WASM and source/licenses.
Label Credit Chess 19. Package io.github.ae6820dc.creditchess19; versionCode 2. Same package, signing certificate and isolated origin as the earlier Credit Chess 19 APK. Independent of Credit Chess 18.
No native toolbar; launches original Desktop/Tablet chooser directly. Settings file import/export is retained.
The existing packager maps the original stockfish-19 files under the host's stockfish asset path; every packaged file is compared with its original source bytes.
Build: python3 android-credit-chess19-single/build-sdk.py with JDK and ANDROID_HOME (SDK 36).
Android 16 offline verification checks engine identity and moves, profiles, Arena Pause/Stop, JSON backups and state after restart.
Output: android-distributions/Credit-Chess-19-latest.apk. Earlier APK files are preserved.
