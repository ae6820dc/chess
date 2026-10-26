> Historical interface notes below describe the reference app. Current edition
> verification and limitations are recorded in [the edition report](../EDITIONS.md).

## Choose a version

Open `index.html` for the manual, responsive version chooser. Choose **Desktop**
(`desktop.html`) or **Tablet** (`tablet.html`). The app logo in either version
returns to the chooser. All three entrypoints are available offline after the
service worker finishes caching them.

Both layouts use the same unchanged storage module, Program ID, Storage Key,
IndexedDB namespace and active profile. Returning to the chooser does not modify
saved games, credits or preferences. Keep using the same browser and origin to
access existing data.

# Stockfish 19 Credit Chess

Static chess application for `ae6820dc/chess`. Desktop and tablet/phone entry points share all game, engine and storage modules.

Live application: https://ae6820dc.github.io/chess/credit-chess/stockfish-19/

No backend and no runtime CDNs. Open over HTTPS (GitHub Pages) or localhost,
not `file://`. All gameplay code, chess.js and Stockfish WASM are bundled.

## Desktop, phones and tablets

Both `desktop.html` and `tablet.html` maximize the board across phones, tablets
and desktop screens using the shared responsive layout. The tablet entry retains
its link back to the main entry. Both pages use the same origin, IndexedDB,
selected profile, credits, archives, themes and backups. Navigate in one tab;
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
is not at `/usr/bin/chromium`.
See [issue #6 verification](../stockfish/docs/issue-6/README.md) for geometry and screenshots.

## Tested delivery phases

1. A browser integration proof started **two genuine Stockfish 19 WASM workers**
   from `/credit-chess/stockfish-19/` and validated eight returned moves with chess.js.
   Engine-reported `UCI_Elo` range: **1320–3190**.
2. Rules, per-side clocks, profiles, credits, archives and full backup validation
   were implemented and tested, including reload, offline reload and atomic,
   idempotent settlement.
3. Exact opening enumeration and the two-worker arena were added and tested,
   including saved cursor, pause/reload/resume and a completed two-game series.

## Run and test

```sh
cd credit-chess/stockfish-19
npm ci
npm test
npm run test:browser
npm run serve
```

Open http://127.0.0.1:4173/credit-chess/stockfish-19/ . There is **no production
build step**. Development dependencies and test results are ignored by Git.
The browser tests use system Chromium at `/usr/bin/chromium`; set
`CHROMIUM_PATH` to another Chromium executable when needed. Node 24 is used for
`--test-isolation=none`; it also prevents this environment's child-process test
runner from reporting only file-level results.

Latest local verification (2026-10-16): **13/13 domain/generator tests** and
**42/42 Chromium integration tests passed**, including automatic local profiles,
PIN rejection/cancellation, cross-entrypoint selection, backups and regression
checks. Chromium 151.0.7922.173, Node 24.19.0.
See [issue #6 verification](../stockfish/docs/issue-6/README.md).

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
- Automatic generated profiles, creation PIN checks, persistent selection, JSON schema validation,
  AES-GCM encrypted backup round-trip, conflicts and recovery snapshot.
- Offline reload via the scoped service worker, exclusion of a second writer tab,
  and an injected IndexedDB write failure followed by a successful durable retry.
- Perft counts 20 / 400 / 8902; exhaustive uniqueness and inverse ranking of all
  400 depth-2 sequences; selected depth-3 ranks, boundaries and resource limits.
- Arena independent workers, initial generated moves, pause/reload/resume,
  two completed saved matches and sequence progression without credit changes.

The local browser tests emulate a **412 × 915 touch mobile viewport** in desktop
Chromium. They do **not** establish physical Android 16 testing. See limitations.

## Board-first responsive interface (issue #6)

Both `desktop.html` and `tablet.html` use the shared `board-layout.css` geometry.
Portrait screens give the board the full width with 4 px side gutters; controls
and clocks remain outside the squares. Landscape screens put navigation,
notifications, account details, gameplay actions and panels in a compact right
rail, leaving the board a full-height column bounded only by the two clocks.
The former 1600 px shell limit no longer restricts large desktop boards.

Match settings and Move history expand below the board on portrait screens and
close when a game starts. Short landscape screens show one rail panel at a time;
tall landscape screens show both. Opening Atlas, Arena, Archive and Preferences
retain internal scrolling. Manual From/To input and replay dialogs remain
available. Controls have at least 44 px touch targets. Pieces scale to about
96% of square size, with resize cancelling superseded movement animations.

ResizeObserver fits the square board to its actual available width and height.
Dynamic viewport height, safe-area insets and visual-viewport changes remain
supported without hiding root overflow. Service-worker cache v6 includes the
shared stylesheet. Program ID, Storage Key, data formats, rules and engine
settings are unchanged.

See [issue #6 measurements, screenshots and verification](../stockfish/docs/issue-6/README.md).
Earlier layout reports remain in [issue #2](../stockfish/docs/issue-2/README.md) and
[issue #3](../stockfish/docs/issue-3/README.md). Physical device and non-Chromium browser tests
were not run; very small windows and virtual keyboards can shrink the board.

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

The application opens directly, without a login screen. In Settings, **Generate
User** prompts for the creation PIN (`1111`) before creating anything. This PIN
is only a guard against accidental creation, **not a security boundary**: it is
in the static source and anyone with developer tools can bypass it. Cancel or
an incorrect PIN leaves stored data unchanged. Usernames use four cryptographically
random bytes, displayed as exactly eight uppercase hexadecimal characters, with
collision checks inside the profile creation transaction. New profiles begin
with 100000 imaginary credits.

Settings lists all generated profiles and switches immediately without a
password. Each profile keeps its games, credits and preferences. The selected
profile is stored in IndexedDB and automatically resumes across reloads, closing
and reopening the page, and navigation between desktop and tablet. A first visit
opens an empty application with guidance in Settings; profile-dependent actions
are disabled. Switching away pauses Arena; ordinary active-game clocks continue
to run, including while another profile is selected.

Legacy password profiles are no longer offered for login. Their records are
retained for export/recovery compatibility; no entire database is deleted. A
device owner, script on this origin, developer tools or modified backup can
access or alter local records. Credits are imaginary and are not tamper-proof.

Export regular backups. Browser data clearing, private-mode exit or storage
eviction can delete profiles. The app requests persistent storage where
supported, reports errors, and never substitutes a fake saved state for a failed
IndexedDB write. A transaction failure leaves the previous durable record, blocks further play and
shows “Retry failed save”. The current unsaved position stays in the open tab;
retry saves it and adjudicates any elapsed timeout before continuing.

## Backups and recovery

Full device JSON includes **all profiles and games**, including any retained legacy password hashes; treat it as
sensitive. `schemaVersion: 1` is required. Import checks identity uniqueness,
known preferences, integer strings, generated username format/uniqueness (or retained legacy password records), complete legal move
histories, timestamps, clock/status consistency and arena resource limits before
writing. Resource bounds: 20 MB file, 1000 profiles, 10000 games, 10000 plies/game.
No monetary precision is lost. Unsupported schemas and corrupt/encryption-failed
backups are rejected, without partial writes.

Conflicts **keep existing profile IDs and all their games**; only new profiles
and their games are added. Generated username collisions keep the existing profile; legacy names are disambiguated.
The import reports added/conflicting counts. Every import stores one pre-import
recovery snapshot, even when everything conflicts. Recovery swaps current and
recovery data. Finish the current game before import/recovery. Imported generated profiles appear in the Settings selector without passwords. A backup is not a trusted proof of a financial
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
workers, each with `Hash=16`, with 1–1,000,000 matches and 20–2000 ms maximum search
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
`/chess/credit-chess/stockfish-19/` subpath. Single-threaded lite Stockfish requires
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
- `stockfish` / Stockfish.js **19.0.1** (Nathan Rugg / Chess.com, Stockfish
  contributors), GPLv3: `vendor/stockfish-19-lite-single.js` and `.wasm`,
  `vendor/STOCKFISH-LICENSE.txt`, `vendor/STOCKFISH-AUTHORS.txt`.
  Corresponding upstream v19.0.1 source and build scripts are bundled as
  `vendor/stockfish-source.tar.gz` from
  https://github.com/nmrugg/stockfish.js/tree/v19.0.1 . The source documents
  Emscripten builds and NNUE retrieval; the distributed WASM already embeds
  its network. Upstream binaries were copied byte-for-byte from the pinned npm
  package. See `vendor/NOTICE.md` and `vendor/SHA256SUMS` for provenance.

Playwright is a development/test dependency, not loaded by the application.

### Fixed application identity and storage migration (issue #4)

Program ID: `af55f489f53544ca8df607b627748719` (shown under Preferences & backups in both interfaces).
Storage Key / IndexedDB database name: `sf19-credit-chess-v1`.
These randomly generated identifiers are fixed in the source, never generated at launch.
Both interfaces share this database on the same browser origin.

This edition opens only `sf19-credit-chess-v1`. It never opens, migrates or
imports the Stockfish 18 databases automatically. The writer lock is
`stockfish-19-credit-chess-writer`. No application code uses localStorage or
sessionStorage; any future keys must use the `sf19:` prefix (`sf18:` for new
keys in the original edition). The two editions share no browser storage keys.
The manifest identity, worker scope and cache names are edition specific.

JSON/encrypted backup schema remains version 1; generated profiles have `kind: "generated"` and no `auth` field. Export regular
backups, especially before changing browsers or origins.

### Unlimited premoves

While Stockfish is thinking, click a piece and destination or drag it to prepare
an intention. Continue from the projected position to add more; there is no queue
length limit. Open **Move history → Premoves** for the count, ordered scrollable
list, **Undo Last Premove**, **Clear Queue**, and the actual/planned position toggle.
The label beside the top clock identifies the displayed position.

The projection moves only your pieces. It never supplies an opponent reply.
Pawn diagonals can express a future capture or en passant; castling and all four
promotion choices are supported. Blocked paths and friendly occupied destinations
must first be opened in the projection. Every intention is conditional: captures,
checks, castling rights and opponent replies can invalidate it. Only the first
intention is checked against the real game after each engine move. If illegal,
the entire dependent queue is cleared with a notification. A legal premove uses
the normal clock/increment/adjudication path, without presentation animation.
Manual moves retain the configured animation speed.

Queues belong to their existing game/profile records and are included in autosave,
restoration, backups and offline caching. Old records without a queue remain
compatible. Queues clear on termination or analysis undo. Queue editing never
pauses the clock. Only a small visible window of list rows is rendered, and the
planning projection updates incrementally when adding or undoing intentions.

### Stockfish response delay

Preferences in both layouts offer 0 (default), 1, 2, 5, 10, 20, 30 and 60
seconds, or a custom value from 0 to 300 seconds. This per-profile setting
applies to the next human-versus-engine turn; Arena retains its own cadence.
The minimum response time starts when the player's move commits. Search,
loading and saving time count toward it; a longer search adds no second delay.
The engine clock keeps running, including while editing the Unlimited Premove
Queue, and a timeout prevents the delayed move from committing. One queued
intention is validated after each accepted response.

Undo, replacement games, profile changes, termination, import, page exit and
engine restart cancel pending responses. Reload uses the saved turn timestamp
rather than starting a fresh delay. Existing preferences/backups without this
field use zero; database keys, Program ID and backup schema remain unchanged.

Arena accepts any whole series count from 1 to 1,000,000 on desktop, tablet and
mobile. Games run sequentially; one opening is requested by its BigInt rank at a
time. Depth 3 currently supplies 8,902 openings. Series stop at the atlas end
without repeating, even if the requested game count is larger. No series-sized
game or opening array is allocated. Future random-access generators can supply
larger collections without changing the series counter.

Completed history spills into immutable 100-game IndexedDB chunks, with only
chunk references in the live snapshot. Archive results are paged (50 per page),
and recovery retains its original history manifest. Existing records, account
IDs, credits, preferences and storage keys are retained. Full JSON/encrypted
backups include chunked results within the existing 20 MB / 10,000-game import
bounds; larger histories report an explicit error and remain available for
individual PGN export through the archive. Disk quotas still apply; a failed
save stops the engines and retains the existing Retry failed save behavior.

Arena STOP permanently ends the current series, including while paused. It cancels
engine replies, response delays, animations and opening advancement. The unfinished
game is retained for review with result `*` and is excluded from the score.
PAUSE still preserves the current game for resuming.

The Arena page retains per-series scores and match settings in IndexedDB. “Review
games” opens that series in the existing paged archive, with replay and PGN export.
New series do not replace earlier scores. Full backups include series summaries;
legacy saves are upgraded in bounded history chunks without duplicating game data.
Results persist across reloads and browser restarts using the existing local storage
system; clearing browser data removes local saves, so keep exported backups.
