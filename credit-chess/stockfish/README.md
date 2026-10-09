# Stockfish Credit Chess

Static chess application for `ae6820dc/chess`. Desktop and tablet/phone entry points share all game, engine and storage modules.

Live application: https://ae6820dc.github.io/chess/credit-chess/stockfish/

No backend and no runtime CDNs. Open over HTTPS (GitHub Pages) or localhost,
not `file://`. All gameplay code, chess.js and Stockfish WASM are bundled.

## Desktop, phones and tablets (issue #3)

Use `index.html` for the original desktop layout and `tablet.html` for phones
and tablets. The tablet page adds its own stylesheet, spacious square board,
compact landscape navigation and internally scrolling settings/history panels.
Its footer links back to desktop. Both pages use the same origin, IndexedDB,
session profile, credits, archives, themes and backups. Navigate in one tab;
the existing writer lock still protects data from concurrent chess tabs.

Preferences offers **Piece movement**: instant, 250, 400, **600 (default)**,
800 or 1000 ms, saved with the profile. The operating system's reduced-motion
preference always disables movement. Shared Web Animations move actual pieces
with easing on player/Stockfish moves, forward/backward archive replay and
Arena. Castling moves both king and rook. Interruptions snap to the committed
position; resize, page/tab changes and reduced motion cancel outstanding
transforms. Presentation never writes game state or credits.

Arena begins the next engine calculation immediately using its selected think
time. If its result arrives before the preceding piece animation finishes,
presentation waits for that animation plus a 150 ms breathing interval before
applying the next move. Clocks continue to charge actual wall-clock time; pause,
timeout and generation checks remain authoritative. Replay remains manual and
read-only, so users control its cadence with Previous/Next.

Run `npm test` and `npm run test:browser`. Set `CHROMIUM_PATH` when Chromium
is not at `/usr/bin/chromium` (the delivery tests used Windows Edge).
See [issue #3 verification](docs/issue-3/README.md) for geometry and screenshots.

## Tested delivery phases

1. A browser integration proof started **two genuine Stockfish 18 WASM workers**
   from `/credit-chess/stockfish/` and validated eight returned moves with chess.js.
   Engine-reported `UCI_Elo` range: **1320–3190**.
2. Rules, per-side clocks, profiles, credits, archives and full backup validation
   were implemented and tested, including reload, offline reload and atomic,
   idempotent settlement.
3. Exact opening enumeration and the two-worker arena were added and tested,
   including saved cursor, pause/reload/resume and a completed two-game series.

## Run and test

```sh
cd credit-chess/stockfish
npm ci
npm test
npm run test:browser
npm run serve
```

Open http://127.0.0.1:4173/credit-chess/stockfish/ . There is **no production
build step**. Development dependencies and test results are ignored by Git.
The browser tests use system Chromium at `/usr/bin/chromium`; set
`CHROMIUM_PATH` to another Chromium executable when needed. Node 24 is used for
`--test-isolation=none`; it also prevents this environment's child-process test
runner from reporting only file-level results.

Latest local verification (2026-10-09): **13/13 domain/generator tests** and
**18/18 Chromium integration tests passed** (including desktop/laptop, portrait,
landscape and six fixed-viewport layout tests). Chromium 151.0.7922.173, Node 24.19.0.

Automated coverage includes:

- Real WASM/UCI initialization, two independent workers, engine legal moves.
- Illegal moves, checkmate, stalemate, castling, en passant, all four promotions,
  self-check rejection, insufficient material, threefold/fivefold repetition and
  50/75-move thresholds.
- Clock debit/increment and engine thinking time, timeout before a late move,
  elapsed time across serialization, reload and real browser timeout settlement.
- Mobile tap moves, preferences and active-game persistence; board underpromotion
  and en passant followed by a genuine Stockfish reply.
- Arbitrary-size exact integer stakes/balances, negative balance, frozen terms,
  duplicate settlement rejection, no credits in analysis or arena.
- PBKDF2 authentication, wrong-password rejection, JSON schema validation,
  AES-GCM encrypted backup round-trip, conflicts and recovery snapshot.
- Offline reload via the scoped service worker, exclusion of a second writer tab,
  and an injected IndexedDB write failure followed by a successful durable retry.
- Perft counts 20 / 400 / 8902; exhaustive uniqueness and inverse ranking of all
  400 depth-2 sequences; selected depth-3 ranks, boundaries and resource limits.
- Arena independent workers, initial generated moves, pause/reload/resume,
  two completed saved matches and sequence progression without credit changes.

The local browser tests emulate a **412 × 915 touch mobile viewport** in desktop
Chromium. They do **not** establish physical Android 16 testing. See limitations.

## Fixed-viewport interface (issue #2)

After profile unlock the application fits the available viewport, with no
vertical or horizontal document scrolling. Desktop/laptop keep board/clocks
left and compact controls, internally scrolling match settings and move history
right. Mobile uses expandable Match settings/Move history panes; starting a game
closes these panes. The manual From/To form remains available behind “Manual move”.
Opening Atlas, Arena, Archive and Preferences each have an internal scrolling
pane. Saved-game replay is a modal dialog with keyboard focus and Escape support.

Board size follows both measured width and height through ResizeObserver,
`100dvh` with `100vh` fallback, safe areas and visual-viewport resizing. No
root overflow hiding is used. Service-worker cache v2 includes the new layout
module; profiles, preferences and saved games retain the same storage schema.

[Issue #2 test report, measurements and four screenshots](docs/issue-2/README.md)
record zero document scroll and complete board/clock/control access at
1920×1080, 1366×768, 412×915 and 915×412, plus resize and 320×568 stress checks.
The short landscape board is 182 pixels wide; use manual input or portrait for
larger targets. Very small windows/virtual keyboards can shrink the board further.
Physical Android 16/browser-chrome and non-Chromium browser tests were not run.

## Playing and clocks

Create one or more device-local profiles. Each begins with 100000 imaginary
credits. Choose White/Black, actual supported UCI strength or **MAX**, stake and
clock. Presets: 10+5, 5+3, 3+2. Custom base: 1 second–24 hours; increment:
0–3600 seconds. Last selected settings/stake are remembered per profile.

Tap a piece then a highlighted destination, drag between squares, or use the
keyboard-accessible From/To form. Choose queen, rook, bishop or knight in the
promotion dialog. Four themes and optional move sound are saved per profile.
The move list contains SAN; archives export PGN and offer move-by-move replay.

Clock state stores per-side milliseconds and a wall-clock timestamp. The side
to move pays all elapsed time, **including engine loading/searching, background
suspension and reload**. Legal moves add increment; illegal moves add nothing.
A timeout is checked before accepting either human or engine moves. Games have
no automatic pause on tab hide. System clock changes can affect time; local
clocks cannot be trusted against deliberate device-time manipulation.

Credits games have no undo or pause. Starting a replacement game explicitly
asks to finish the old game; a credits game records resignation and loses its
stake. Analysis permits undo back to the preceding human turn, never before
its generated opening; time already used remains charged. Arena can pause.

Threefold repetition and 50 moves are claimable by the human on their turn;
fivefold and 75 moves are automatic. Mate takes precedence on the final move.
Stockfish searches normally until mate, an automatic draw, or timeout; the
application does not fabricate an engine draw claim.

## Credits, profiles and storage

**Imaginary credits only:** no real money, payments, transfers or cashout.
Negative balances are unlimited and a stake may exceed the balance. Exact
BigInt integers are serialized as decimal strings. The stake is not deducted
upfront: win adds `stake × multiplier`; loss subtracts `stake`; draw adds zero.
Default multipliers: 1320→2, 2000→3, 2800→5, 3190→8, MAX→10. They are editable
non-negative whole integers and terms are frozen for each started game.
Analysis, arena and replay never reward credits.

Profile and game writes use IndexedDB. Finished-game settlement and the balance
update happen in one read/write transaction. A settled game cannot settle again;
older revisions cannot replace newer state. A Web Lock permits only one writable
application tab for this origin at a time. Other tabs explain how to retry.
Games save at creation, every move, pause, undo and finish; the stored timestamp
accounts for intervening time without a write every clock tick. Finished and
in-progress records include UCI moves, PGN, results, dates, stake, multiplier,
difficulty, clocks and starting/ending balances.

Passwords use a random 128-bit salt and **PBKDF2-SHA256, 310000 iterations**.
An unlocked session persists in the current browser tab until “Lock profile”.
This is **local-only convenience authentication, not server-backed security**.
A device owner, script running in this origin, browser developer tools or a
modified backup can access/alter records. It is impossible for a static app to
provide tamper-proof financial security. UI actions cannot edit an active game's
stake/result/multiplier or pay an archived game again.

Export regular backups. Browser data clearing, private-mode exit or storage
eviction can delete profiles. The app requests persistent storage where
supported, reports errors, and never substitutes a fake saved state for a failed
IndexedDB write. A transaction failure leaves the previous durable record, blocks further play and
shows “Retry failed save”. The current unsaved position stays in the open tab;
retry saves it and adjudicates any elapsed timeout before continuing.

## Backups and recovery

Full device JSON includes **all profiles and password hashes**; treat it as
sensitive. `schemaVersion: 1` is required. Import checks identity uniqueness,
known preferences, integer strings, password records, complete legal move
histories, timestamps, clock/status consistency and arena resource limits before
writing. Resource bounds: 20 MB file, 1000 profiles, 10000 games, 10000 plies/game.
No monetary precision is lost. Unsupported schemas and corrupt/encryption-failed
backups are rejected, without partial writes.

Conflicts **keep existing profile IDs and all their games**; only new profiles
and their games are added. Same-name new profiles receive an imported suffix.
The import reports added/conflicting counts. Every import stores one pre-import
recovery snapshot, even when everything conflicts. Recovery swaps current and
recovery data. Finish the current game before import/recovery. Imported profiles
can then be unlocked normally. A backup is not a trusted proof of a financial
balance or a game's authenticity.

Optional encrypted JSON uses a new random salt and 96-bit IV, PBKDF2-SHA256
310000 iterations and **AES-256-GCM** authenticated encryption. Enter the backup
password before importing an encrypted file. Wrong password/damage fails
closed. The application cannot recover a lost encryption password.

## Exact sequential opening generator

Ranks are **zero-based**, stored as BigInt decimal strings. Each rank identifies
one legal move sequence of the fixed ply depth, starting from standard chess.
Canonical order is ascending UCI strings (from square, to square, promotion
suffix), including every legal alternative. Distinct sequences can transpose
to the same position; the enumeration is not an enumeration of distinct FENs.

For each ordered move `m`, compute the exact legal-continuation subtree count
`C(position after m, remaining depth)`. Ranking sums counts of preceding
subtrees; unranking subtracts them until the containing subtree is found.
`C(position,0)=1`; no legal continuation contributes zero at positive depth.
There is no modulo, hash-selection substitute or wraparound. `Enumeration.rank`
and `.unrank` are both implemented and tested.

Supported exact random access: **depths 1–3 only** (20 / 400 / 8902 sequences).
Deeper depths are disabled, not approximated. A module worker performs heavy
computation, emits node-count progress and is terminated on cancellation.
Strict budget: 250000 visited nodes, 15 seconds (16-second parent watchdog),
20000 cached subtree entries. Cache keys include legal-position state and
remaining depth. Each request's worker is disposed before engines are started.
The optional balanced-opening filter is **not implemented**; the UI clearly
states it is absent, so no silently filtered numbering occurs.

Next/Previous/jump and saved cursor work within the finite rank range. Select
“Start from selected atlas opening” for human-vs-engine. Opening moves are in
history/PGN but use no play clock time; play begins at the resulting position.

## Motor Arena and adapter contract

Initial arena: **Stockfish vs Stockfish**, two independent single-threaded
workers, each with `Hash=16`, with 1–100 matches and 20–2000 ms maximum search
budget per move. Actual clock remaining can reduce that budget. The selected
Play clock and strength apply to both engines. They start at the selected
opening and advance one exact sequence per completed game; the series stops
at the range boundary. Arena games are archived, with no credit settlement.

Pause cancels both searches by terminating workers, debits elapsed time and
saves paused clock/series state. Resume creates fresh workers at the saved move
history. Reload resumes a running series (elapsed time remains charged) or
keeps a paused one paused. A completed match's pending continuation is durable;
creating the next match and acknowledging that continuation is transactional.

`StockfishAdapter` is the initial adapter implementation. Future adapters should
provide `ready` (Promise of supported strength metadata),
`move({moves,difficulty,milliseconds,clocks,increment})` (Promise of legal UCI
move), and `close()` (cancel and release resources). Callers still validate moves
with the independent rules library. Leela Chess Zero and a Windows UCI bridge
are **not implemented**. Fritz EXEs cannot run inside GitHub Pages, and no
proprietary engines are bundled/uploaded.

## GitHub Pages and offline operation

Place this folder in `main`, with GitHub Pages publishing the repository root.
Relative module/worker/WASM/service-worker paths work beneath the repository's
`/chess/credit-chess/stockfish/` subpath. Single-threaded lite Stockfish requires
**no SharedArrayBuffer or COOP/COEP headers**, which Pages cannot configure.
The WASM NNUE network is embedded, with no network fetch to an engine CDN.

The existing `.github/workflows/generate-index.yml` is preserved. It continues
to rebuild the repository index on main pushes. This project does not replace
or edit repository files/workflows outside its own folder.

After one complete online visit, the application-scoped service worker caches
runtime assets. Offline reload is tested. The app checks network first and
falls back to cache. Offline support is unavailable until cache installation
has succeeded; the status message reports caching failures. Documentation and
Stockfish source downloads are not precached. No backend sync exists.

## Known limitations and incomplete optional features

- **No physical Android 16 device/AVD was available.** Current Android Chrome
  supports the APIs used (WASM workers, Web Crypto, IndexedDB, Web Locks, service
  workers); touch/mobile Chromium tests pass. This is compatibility design and
  emulation, not a claim of an Android 16 hardware test. Firefox/other mobile
  browsers, device-specific fonts, battery use and long arena sessions need
  physical-device checks. Keep the arena foregrounded; Android may suspend tabs.
- MAX is unrestricted **lite** Stockfish within the mobile time/memory budget,
  not full-network desktop Stockfish and not a verified Elo rating.
- Exact enumeration beyond three plies and the optional balanced filter are
  disabled/unimplemented. LCZero/Windows bridge are future work.
- Standard insufficient-material cases and timeout mating-material handling are
  supported (bare king, lone minor vs bare king, two knights can potentially
  mate, opposing material can permit helpmates). An exhaustive FIDE dead-position
  solver for unusual blocked positions/material configurations is not present.
  The application does not claim tablebase-perfect timeout adjudication.
- Draw claims are for the **current** position, not advance claims based on an
  announced intended move. Engines do not proactively claim threefold/50 moves.
- A single application writer tab is intentional. Sessions and accounts do not
  sync across devices. Password-reset/account-recovery services do not exist.
- Every write stores the local snapshot. Very large archives consume storage
  and may slow writes; export periodically. Import/replay are bounded for
  reliability. Quota eviction/data clearing cannot be repaired without a backup.
- Local data, time and backup files are editable by a device owner. No claim of
  fraud resistance or trustworthy monetary value is made.

## Bundled dependencies and licenses

Application code: GPL-3.0-or-later. See `LICENSE.txt`.

- `chess.js` **1.4.0**, BSD-2-Clause: bundled `vendor/chess.js` and
  `vendor/CHESS-JS-LICENSE.txt`.
- `stockfish` / Stockfish.js **18.0.0** (Nathan Rugg / Chess.com, Stockfish
  contributors), GPLv3: `vendor/stockfish-18-lite-single.js` and `.wasm`,
  `vendor/STOCKFISH-LICENSE.txt`, `vendor/STOCKFISH-AUTHORS.txt`.
  Corresponding upstream v18.0.0 source and build scripts are bundled as
  `vendor/stockfish-source.tar.gz` from
  https://github.com/nmrugg/stockfish.js/tree/v18.0.0 . The source documents
  Emscripten builds and NNUE retrieval; the distributed WASM already embeds
  its network. Upstream binaries were copied byte-for-byte from the pinned npm
  package. See `vendor/NOTICE.md` and `vendor/SHA256SUMS` for provenance.

Playwright is a development/test dependency, not loaded by the application.
