# Credit Chess 18 and 19 Android delivery

Built 2026-10-26 from the existing offline Android wrapper. The previous
`android-distributions/credit-chess.apk` is preserved byte for byte (SHA-256
`dca3a2e785a760cee29f466f6d75de76d0216d628cf5aa3997e6b80cc96331c3`).

| Application | Android application ID | versionCode | Actual bundled engine | APK bytes |
| --- | --- | ---: | --- | ---: |
| [Credit Chess 18](https://raw.githubusercontent.com/ae6820dc/chess/main/android-distributions/Credit-Chess-18.apk) | `io.github.ae6820dc.creditchess` | 2 | Stockfish 18 Lite WASM | 6,515,785 |
| [Credit Chess 19](https://raw.githubusercontent.com/ae6820dc/chess/main/android-distributions/Credit-Chess-19.apk) | `io.github.ae6820dc.creditchess19` | 1 | Stockfish 19 Lite WASM | 1,853,329 |

The existing signing identity is retained: certificate SHA-256
`01059a5e2a9f61d6b88aff4f2b47bc4e33195b352ba01872858f71fd358ffb1e`.
These retain the original debug build/signing configuration. No new signing key
was generated. Install 18 over the existing repository APK using the Android
installer or `adb install -r Credit-Chess-18.apk`; do not uninstall first.
The compatible update applies to installations signed with this certificate.

## Architecture and preservation

`MainActivity.java`, `host.js`, the manifest and system-bar theme are unchanged.
Both apps retain the original chooser, Desktop/Tablet entrypoints, WebView
settings, native navigation, document picker/download support, visible system
bars and inset handling. No permissions were added. There is no Internet
permission. Every app bundles its own 34 original source assets, including
HTML, CSS, JS, WASM, workers, icons, dependencies, licenses and source archive.
All packaged source bytes are compared with the repository by `verify-apks.py`.
For 18, every `assets/` entry is also compared byte for byte against the previous
APK, including its catalog, storage origin, Program ID and storage key.
Only the launcher name/icon and Android versionCode change for 18.

19 copies `credit-chess/stockfish-19` unchanged, including its actual Stockfish 19
worker and WASM. Inside its separate APK, the files use the original
`/credit-chess/stockfish/` URL path so the unchanged Android navigation allowlist
works for both editions. Source checksums retain their original repository paths.
This internal alias does not share files or storage between the apps. Its Android ID and offline origin
`https://credit-chess-19.appassets.androidplatform.net` are independent of 18's
unchanged `https://credit-chess.appassets.androidplatform.net`. Android assigns
separate application sandboxes, WebView databases, localStorage, IndexedDB,
profiles, credits, settings, games and caches. Neither APK reads the other app's
assets. The launcher icons retain the original gold knight vector and add a
contrasting white number badge; the numerals were visually reviewed at 48 pixels.

## Build and verification

Implementation commit: `273ca79625e5f6a2c0c97a164dc09edd6da7d6b8`.
Binary delivery commit: `610defff246d95ff6d11d2421ca3563e5a73daad` (18 was first delivered in `ae8b1e9963f20ec2131984d14605ef764a0b4702`).
Native verification improvements: `a51ce85d948fdb6134b4fbdc67b22c6426d68bb8`.
Final 19 packaging: `daa8672f2b5060456e146ca9a17f67a7a7851c0f`.
Checksums are recorded in `android-distributions/checksums.json`.

Both editions passed local Gradle assemble/lint; both native instrumentation
packages compiled. CI also assembles and lints both editions, verifies their
signatures/manifests/assets and adds the APKs alongside the previous APK. The
workflow retains downloadable build artifacts.

The actual CI APKs were fetched back from GitHub and passed `verify-apks.py`.
The APK-extracted browser harness blocks external requests and service workers.
Each real engine initialized its bundled WASM, reported the correct UCI identity
and Elo range 1320–3190, and returned four moves validated with chess.js.
Switch/reload storage checks and four viewport widths (320, 740, 800 and 1280)
passed for both editions. Both original unit suites passed 50/50 tests.

## Full browser regression results

- Stockfish 18: **120/120 passed** (8.2 minutes).
- Stockfish 19: **107/108 passed** on the first run (7.7 minutes). The tablet
  820px / 100,000-game Arena configuration test failed once, then passed when
  rerun individually (1/1, 4.3 seconds). This is reported as a first-run failure
  followed by a successful retry, rather than an entirely clean initial suite.
- Coverage includes actual engine gameplay, rules, clocks, profiles, exact
  credits, encrypted backups, recovery, premoves, response delay, Arena,
  history capacity, pause/stop/restart, touch/drag and responsive layouts.

The application web sources were not modified for this delivery.

## Android 16 runtime verification

Final run: [Credit Chess Android 40295340619](https://github.com/ae6820dc/chess/actions/runs/40295340619): **build and android-runtime both passed**.
Test source: `7b0de5ba839491d4485090775abbd4357c3919f5`.
Five native instrumentation invocations passed **87 assertions** total
(15 + 19 + 15 + 19 + 19). See [native result excerpts](android16-tests.txt).

| Requested check | Executed result |
| --- | --- |
| Install on Android 16 | Both packages installed successfully. |
| Separate launchers | Both launcher activities resolved independently. |
| Numbered icons | 18/19 vector previews visually checked at 48 pixels; actual launcher screenshot and UI hierarchy captured as an artifact. |
| In-place 18 update | Actual previous APK seeded, then updated with `adb install -r`; profiles, balances, preferences and saved game moves matched the durable snapshot. No uninstall/data clearing. |
| Launch without crashing | Both ordinary launches returned `Status: ok`; native WebViews and engine workers ran successfully. |
| Engine identity/offline | Stockfish 18 Lite WASM and Stockfish 19 Lite WASM initialized and moved in airplane mode. |
| Gameplay/Arena | Native real WASM move, saved Arena setup, actual Pause/Stop handlers and backup validation passed for both. Full gameplay/Arena UI covered by browser suites. |
| Independent saved data | Package-specific marker values survived reload/restart independently; each app's profile/game snapshot matched its own saved reference. |
| Simultaneous operation | Both normal app processes were alive simultaneously after separate launches. |
| Original screen/navigation | Unchanged native host/manifest/theme; navigation and both visible system bars plus WebView inset geometry passed in portrait/landscape. |

[Android launcher screenshot/UI-hierarchy artifact](https://github.com/ae6820dc/chess/actions/runs/40295340619/artifacts/12638041876).
The screenshot was captured successfully; its pixels could not be retrieved into
this workspace for a separate visual review. Icon readability review used the
48-pixel vector previews, not a physical Android home screen.

An intermediate run also encountered a system-bar visibility timing failure on
the unchanged previous APK. The final test waits for settled insets before
asserting visibility/geometry; application code was not changed for that.


The first native attempt exposed an unreliable snapshot comparison; the test
reference was moved to synchronously committed Android preferences and compared
without object-key-order sensitivity. The next attempt verified the in-place
18 update, then exposed the original host's hard-coded internal navigation path
when opening 19's board. Packaging 19 under the existing internal path fixes
that while keeping the original native activity untouched.

No physical device or native Android tablet emulator was tested. The browser
suite supplies the tablet layout coverage. Android Arena fixtures use the
original storage/core APIs and invoke the actual Pause/Stop handlers; the
browser suite exercises full gameplay and Arena UI flows.

