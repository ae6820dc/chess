# Verification — 2026-10-16

## Issue #6: maximum-size responsive boards

`npm test`: **13 passed**. `npm run test:browser`: **42 passed**.
Both entry points pass the existing gameplay, engine, storage, profile, backup,
replay, animation and Arena regressions. Two new scenarios check 14 viewport
sizes per entry, maximum board dimensions, contained pieces, accessible tools,
rotations and zero document overflow.

See [measurements, screenshots and limitations](docs/issue-6/README.md).

# Verification — 2026-10-16

## Latest: issue #4 application identity and IndexedDB migration

- `npm test`: 13 passed, 0 failed.
- `npm run test:browser`: 37 passed, 0 failed (2.0 minutes, final full run).
- `node --check storage.js`, `node --check tests/browser/storage.spec.js` and
  `git diff --check`: passed.

Five new browser scenarios verify fixed lowercase hex identifiers, matching IDs
in both interfaces, actual database naming, unchanged legacy records, complete
snapshot/recovery/extension copying, opening settings and arena progress,
shared persistence across navigation/reload, invalid-source rejection,
transaction rollback, quota failure, safe retry, and refusal to overwrite an
unmarked nonempty destination. Existing gameplay, engine, backup encryption,
offline, layouts, tablet and animation checks all pass.

The Program ID appears in Preferences & backups to preserve the existing footer
and tablet login geometry. No chess, engine, animation or backup format changes.

# Verification — 2026-10-10

## Latest: issue #3 tablet interface and piece animations

13 unit tests and 32 distinct browser scenarios passed. The full regression
run passed 31 tests; a final focused run passed three checks (two rechecks plus
one added orientation/duration scenario). Real Stockfish, both entry points,
all requested viewport sizes, movement duration and reduced motion are covered.
Desktop baseline PNGs match byte-for-byte at 1366 × 768 and 1920 × 1080.
See [measured boards, screenshots and limitations](docs/issue-3/README.md).

## Issue #2 interface refactor

`npm test`: **13 passed**. `npm run test:browser`: **18 passed** (1.2 minutes).
Existing functionality checks remain, with six new fixed-viewport tests.
See the [complete interface report, measured geometry and screenshots](docs/issue-2/README.md).

## Original engine/application delivery

Environment: Node 24.19.0, Playwright 1.56.1, Debian Chromium
151.0.7922.173. Browser viewport: 412 × 915, touch/mobile emulation.
Server: http://127.0.0.1:4173/credit-chess/stockfish/ (repository subpath).

| Command | Result |
| --- | --- |
| `npm test` | 13 passed, 0 failed |
| `npm run test:browser` | 12 passed, 0 failed; 35.0 seconds |
| `node --check app.js` and core/storage checks | passed |

## Actual engine evidence

Both workers loaded the bundled `stockfish-18-lite-single.wasm` and completed
`uci` / `isready`. Reported Elo limits: 1320 and 3190. One representative final
proof returned the following eight UCI moves, all independently accepted by
chess.js (the lower-strength engine is stochastic, so moves vary between runs):

```
g1f3 d7d5 b1c3 d5d4 c3b5 c7c5 b2b4 a7a6
```

Resulting FEN:

```
rnbqkbnr/1p2pppp/p7/1Np5/1P1p4/5N2/P1PPPPPP/R1BQKB1R w KQkq - 0 5
```

The game UI tests also awaited real engine replies after normal play,
underpromotion and en passant; no engine responses were mocked.

## Required checks

- **Engine loads:** actual browser WASM workers and UCI handshakes; two instances
  in the proof and arena.
- **Legal moves:** rejected e2→e5, played e2→e4 plus real engine reply, actual
  board underpromotion/en passant, library tests for castling and self-check.
- **Clocks:** deterministic per-side debit/increment; engine thinking reduced
  its clock; actual browser timeout finished and settled a game once;
  elapsed-time/reload and arena paused-time preservation passed.
- **Persistence:** profiles, preferences, large stakes, moves, balances and
  in-progress clocks survived reload; offline reload also passed.
- **Financial idempotence:** settlement retried with `settled:false` against an
  already settled record did not change the balance twice. Analysis and a
  completed two-game arena series left credits unchanged.
- **Reliability:** injected one IndexedDB quota failure, observed blocked play
  and retry control, verified durable history stayed unchanged until retry,
  then verified the retry saved the move before the real engine continued.
- **Generator:** exact 20/400/8902 counts, all 400 two-ply sequences unique with
  rank/unrank inverses, depth-3 boundary ranks and strict budget failures.
- **Arena:** saved paused state, reloaded, resumed; completed and archived two
  matches at consecutive opening ranks 0 and 1.
- **Backups:** hashed-password authentication, wrong password, schema rejection,
  encrypted round-trip, conflict preservation and pre-import recovery.

Physical Android 16/AVD and long mobile battery/memory sessions were **not run**.
See README for remaining limitations and optional features not implemented.

## Unlimited premove queue — 2026-10-17

Final verification in the managed Linux environment:

- `npm test`: **33 passed, 0 failed**.
- `npm run test:browser`: **60 passed, 0 failed** (3.0 minutes).
- `git diff --check`: passed.

Added domain coverage for 1, 10, 100 and 1,000 intentions, incremental projection,
undo, serialization, ten consecutive opponent responses, at most one automatic
move per response, illegal check evasion cancellation without position/clock
mutation, legal check blocking, castling, captures, en passant, every promotion,
checkmate, clock debit/increment/expiry, paused/opponent turns, and malformed
planning coordinates.

Added deterministic browser coverage for click planning, actual/planned view,
undo/clear, autosave/restoration, account isolation with 10/100/1,000 intentions,
virtualized list scrolling (at most 18 rendered rows), mouse and touch dragging,
instant automatic execution, illegal cancellation, and engine requests containing
only actual legal history rather than projected intentions.

The complete existing browser suite also passed: real Stockfish WASM, normal
click and mouse/touch/pen drag movement, special moves, animation speeds and
reduced motion, credits, clocks, accounts, IndexedDB migration and failed saves,
backups, offline restoration, openings, Arena, and desktop/tablet/phone layouts.
Both entry points passed board geometry checks at 14 sizes from 320×568 through
2560×1440, including short landscape and orientation changes. A mobile queue
screenshot was inspected manually.

Browser tests use system Chromium and touch/viewport emulation. Physical Android
and iOS devices and Safari were not tested. Initial layout regressions were fixed
before the final clean run above. GitHub Pages deployment status could not be
queried from this environment: the GitHub Pages API request returned Forbidden.
