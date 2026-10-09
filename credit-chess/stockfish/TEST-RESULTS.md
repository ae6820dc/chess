# Verification — 2026-10-09

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
