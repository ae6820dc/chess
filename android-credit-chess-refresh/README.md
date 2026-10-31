# Credit Chess 18 refreshed Android APK
Builds the current credit-chess/stockfish/index.html chooser, Desktop and Tablet, and bundled Stockfish 18 WASM offline. Original web files and colors are unchanged.
Uses the existing native host, file import/export, isolated HTTPS asset origin and stable signing key. Package io.github.ae6820dc.creditchess; versionCode 3; name Credit Chess 18.
Build: python3 android-credit-chess-refresh/build-sdk.py with JDK and ANDROID_HOME (platform/build-tools 36).
Android 16 checks: real engine move, IndexedDB profiles, Arena Pause/Stop, JSON backups and persisted state after process restart.
Distribution: android-distributions/Credit-Chess-18-latest.apk. Previous APK files are preserved.
