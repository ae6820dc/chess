# Credit Chess · Stockfish 19 Native

Separate offline Android 10+ ARM64 application: `io.github.ae6820dc.creditchess.sf19native`.
Uses the Credit Chess desktop/tablet interface and a full native Stockfish 19 NNUE engine.
Default strength MAX, default think time 3 seconds, adjustable 0.1–60 seconds.
Two independent processes for Arena, each with 64 MiB hash and up to 4 CPU threads.
No network permission. External navigation is blocked. Exports use the Android file picker.
Program ID `8b9057d3e62c4af1`; storage key `e761b4c3092af85d`.

Build with JDK 21, Android SDK platform 36/build-tools 36.0.0 and NDK 27.2.12479018:

    python3 android-stockfish19-native/build.py

The build pins the Stockfish 19 Android release archive by SHA-256, compiles its source
for ARM64 with 16 KiB page alignment, and embeds the full official NNUE network.
An x86_64 test APK is built with `--test-x86` for Android emulator verification.
No development engine snapshot or lite engine is substituted.

Stockfish is GPLv3. Its license, source and exact NNUE network are included in the
corresponding source archive beside the APK. The app/bridge source and build scripts
are also included. Third-party chess.js retains its original license.
