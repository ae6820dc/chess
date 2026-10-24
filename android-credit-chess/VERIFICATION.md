# Android debug build verification

Executed 2026-10-24. Local build: Temurin JDK 21.0.8, Gradle 8.13, Android Gradle Plugin 8.13.0, SDK/target 36, minSdk 26, build-tools 36.0.0.

Both repositories retain all original application HTML, JavaScript, CSS, Program IDs, storage keys, indexes and existing APKs. The Android projects, workflows and separate distribution directories are additions. No Factorial Studio code is included or changed.

## Build and packaged assets

All three application assemble and lint tasks passed locally. The table records the delivered CI-built APK (Temurin JDK 21.0.12), downloaded from its committed path and reverified locally. The original assets and host helper script are byte-identical to the locally tested assets; compiler/compression differences account for the different APK hash from the initial local JDK 21.0.8 build. All three native test APKs also compiled. `verify-apks.py` passed ZIP integrity, apksigner v2 signature validation, package IDs, versionCode, API levels, non-fullscreen theme, absence of internet permission, original Program ID catalog uniqueness, and SHA-256/byte comparisons of every source asset with the APK. Signing uses the existing public test certificate SHA-256 `01059a5e2a9f61d6b88aff4f2b47bc4e33195b352ba01872858f71fd358ffb1e`. These are debug builds, not private-key production releases.

| APK | Package | versionCode | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `android-distributions/credit-chess.apk` | `io.github.ae6820dc.creditchess` | 1 | 6515525 | `b7960ee77d10f9386895887e368134edc7bd137e5884ffb299e6053ced26be7a` |

The source catalog and original storage keys are recorded in `android-distributions/programs.json`. Mathematics Studio includes all five families in both editions (10 programs, 116 original resource files). Unicode Studio includes versions 1–9 with all three samples (27 programs). Credit Chess includes 34 original resources, including the actual Stockfish JS/WASM, chess.js, licenses and corresponding-source archive. Gzip assets are stored with an internal `.bin` suffix so AAPT does not decompress them; their original request URLs are mapped to the unchanged bytes.

## Executed browser and engine regression tests

- Original calculator engine suite: 22 algorithm groups passed.
- Studio II mathematical suite: 11 groups passed.
- Original calculator browser suite: 154 checks passed.
- Studio II browser suite: 253 checks passed.
- Credit Chess unit suite: 50 tests passed.
- Credit Chess browser suite: 113 tests passed, including real Stockfish moves, Arena operation/Pause/Stop, accounts, balances, clocks, history, backup/recovery, entry switching and responsive Desktop/Tablet layouts.
- `package-browser-tests.py` passed against the actual APK-extracted assets: 37 Mathematics/Unicode programs and Credit Chess. Each program uses an isolated local HTTPS origin (Desktop/Tablet share the intended Chess origin). Checks include original ID display, local resources, workers for actual calculator calculations, original backup export through the host download shim, isolated state and restored calculation history/Unicode controls after switching and reload, and page widths 320×740, 740×320, 800×1280 and 1280×800 without horizontal overflow.
- Packaged Stockfish WASM initialized at the isolated HTTPS origin, reported Elo range 1320–3190, and returned four moves checked with the real chess.js legal-move implementation. No external resource requests were allowed in that test. Service workers were blocked in this browser harness so every requested runtime file had to come from the extracted APK assets.

These browser tests are not Android device tests. In particular, a locally served HTTPS browser proof does not establish that Android's request interception successfully serves every Web Worker/WASM request; the native instrumentation suite tests that separately.

## Local Android 16 attempt

An API 36 AOSP x86_64 emulator (Emulator 37.2.12, WebView 133.0.6943.137) booted with software CPU emulation and SwiftShader. There is no `/dev/kvm` in this workspace. The three application packages installed successfully and `pm list packages` confirmed that all three coexist, along with the previous Unicode 7.1 APK. The Mathematics Studio instrumentation APK also installed.

The native smoke run did **not** pass. Its output was `INSTRUMENTATION_RESULT: shortMsg=Process crashed.` The crash log records SIGTRAP inside `libwebviewchromium.so` during Mathematics Studio startup. A subsequent ordinary Unicode Studio launch timed out and a screenshot showed Android's “Process system isn't responding” dialog. The cause was not isolated to the emulator or wrapper. No successful Android startup, content rendering, navigation, system-bar/inset geometry, file picker/download roundtrip, application restart persistence, Stockfish WASM operation, Arena operation, or rotation/tablet behavior is claimed from this attempt. No physical device was tested.

The KVM-enabled GitHub Actions job builds and runs the included native instrumentation suite. It tests airplane-mode requests, origin isolation, switching/reload/restart persistence, Program IDs, calculator workers, Stockfish WASM, and system-bar/inset geometry in portrait and landscape. Its result must be inspected before treating Android runtime verification as complete; the presence of that job is not a passing result.

## Migration and installation

The HTML readmes document browser export/import for calculators and Chess using their original validated backup controls. A browser-console export snippet handles Unicode versions 1–9, with explicit confirmation before native import. The native localStorage backup is scoped to one program and never substitutes for Credit Chess's full IndexedDB backup. New package IDs do not read or overwrite old browser/APK data. Existing APK paths are untouched. Compatible future signed updates should use `adb install -r` and a higher versionCode; never uninstall to preserve data.

## Successful KVM-backed Android verification

The later native run succeeded: [Credit Chess Android run 40090456852](https://github.com/ae6820dc/chess/actions/runs/40090456852). Both `build` and `android-runtime` jobs passed on Android 16/API 36. This supersedes the earlier local software-emulator limitation for the checks actually executed below.

- Portrait seed process: 12 checks passed. Fresh landscape verification process: 14 checks passed (26 total).
- The original local HTTPS origin loaded in airplane mode; state survived reload, host switching and a separate instrumentation process.
- The actual original Stockfish Web Worker initialized the packaged WASM, reported Elo range 1320–3190, and returned `e2e4` from the initial position. The native assertion checks move format; the separately reported packaged browser test validates four real engine moves using chess.js.
- Original storage/core APIs created a local profile and an active saved Arena fixture. The original Desktop application's actual Pause and Stop handlers were invoked and their visible status text checked.
- The original full-backup validator accepted profiles/games/stopped Arena data. The stopped Arena series and account survived the fresh process invocation.
- Both Android system bars were visible and actual WebView bounds stayed between them in portrait and landscape.

The injected test's first attempt used a relative dynamic import, which Android evaluated with an `about:blank` script base. The harness now resolves module URLs explicitly against the current document; original application module code, HTTPS origins, Program IDs, storage keys and application data were not changed to address that test issue.

The binary commit is [75c2adab7441994149c71725cfad9fc28918d871](https://github.com/ae6820dc/chess/commit/75c2adab7441994149c71725cfad9fc28918d871). The actual APK was downloaded, checked against its committed SHA-256, verified again with apksigner and byte-for-byte source comparisons, and passed the APK-extracted browser suite again. Subsequent changes to native tests did not change this application binary.

Remaining limits: no physical device, pre-API-36 runtime, native Android tablet emulator, or Android document-provider export/import roundtrip was tested. Arena setup uses original storage APIs and the native controls are invoked programmatically; the full opening-generator/UI navigation, responsive tablet layouts, encryption/import, animation, Elo settings and clocks have the separately reported original browser/unit regression coverage. The successful Mathematics/Unicode Android run is documented in the 9062 repository; its results are independent of this one.
