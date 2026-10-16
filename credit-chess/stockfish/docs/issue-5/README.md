# Issue #5: automatic local profiles

Desktop: https://ae6820dc.github.io/chess/credit-chess/stockfish/

Tablet: https://ae6820dc.github.io/chess/credit-chess/stockfish/tablet.html

Both entrypoints use the same shared modules and IndexedDB snapshot. The fixed
Program ID remains `47f4d94492933a3b0a3f406e6e4ce412`; the database name remains
`bbebe43a0b38a335`. No databases are deleted. Legacy profiles remain available
in device backups and recovery snapshots but are excluded from the user selector.

Settings offers Generate User and a password-free selector. The masked PIN dialog
checks the creation PIN before random generation or stored changes, and clears
its input/result each time. The PIN is a convenience guard against accidental
creation, not security: this static source can be inspected or modified.
Four cryptographically random bytes produce an uppercase eight-digit hexadecimal
username. Collision checking, profile creation and active selection share one
IndexedDB transaction. Selection survives reloads, new tabs and entrypoint changes.
Each generated profile retains independent preferences, credits and games.

Schema version 1 backups support generated profiles with `kind: "generated"` and
no authentication record, as well as retained legacy records. Import validates
before writing, preserves existing IDs and generated usernames on conflict, and
keeps the pre-import recovery snapshot. JSON and encrypted backup paths remain.
The service worker cache advances to v5 to refresh offline application assets.

## Verification

Commands: `npm test`, `npm run test:browser`, `git diff --check`.
Results (2026-10-16): **13/13 domain/generator tests and 40/40 browser tests passed**.
`git diff --check` passed.

Environment: Node 24.19.0, Chromium 151.0.7922.173 on Linux.

New browser tests cover empty first visits on both interfaces, disabled actions,
incorrect/cancelled PINs (including Escape after a prior confirmation), accepted
creation, format and forced RNG collision retries, independent balances and
preferences, selection, reload, a fresh tab, cross-entrypoint resume, JSON
export/import with games, generated username import conflicts and schema rejection.
Existing tests cover encrypted backup/recovery, migration retention and failure
atomicity, real Stockfish, rules, clocks, credits, arena, opening enumeration,
offline reload, write failures, responsive layout and animations.

Browser tests emulate tablet/touch viewports; no physical-device testing was run.
