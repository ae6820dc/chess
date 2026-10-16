# Issue #6 — maximum board size

Both entry points now share a board-first layout. Portrait boards use the full
width with 4 px gutters. Landscape boards get a full-height column, with all
application chrome in a separate control rail and clocks outside the board.
The 1600 px shell cap is removed. Short screens switch between settings/history;
the shortest landscape phones expand tools within the rail without covering
any squares. Closing a panel or pressing Escape returns to play.

Piece font size is 96% of the usable square size (after subtracting board borders),
up from about 70%. Unicode glyphs remain sharp, centered and fully contained.
Touch targets outside the board remain at least 44 px. Both entry points retain
all sections, manual input, promotion, replay, animations and reduced motion.
The new stylesheet is included in the offline service-worker cache (v6).

## Measured playing boards

Measurements are CSS pixels in Chromium, with a generated profile and active
analysis game. Optional panels are closed, as they are when play starts. Both
entry points produce the same board dimensions. JSON files include position,
board size, piece font size, square size and document overflow for every viewport.

| Viewport | Board (both entries) | Piece font | Main screenshot | Tablet screenshot |
| --- | --- | --- | --- | --- |
| 360 × 800 | 352 × 352 | 41.76 px | [Main](index.html-360x800.png) | [Tablet](tablet.html-360x800.png) |
| 412 × 915 | 404 × 404 | 48 px | [Main](index.html-412x915.png) | [Tablet](tablet.html-412x915.png) |
| 768 × 1024 | 760 × 760 | 90.72 px | [Main](index.html-768x1024.png) | [Tablet](tablet.html-768x1024.png) |
| 915 × 412 | 333 × 333 | 39.48 px | [Main](index.html-915x412.png) | [Tablet](tablet.html-915x412.png) |
| 1024 × 768 | 689 × 689 | 82.20 px | [Main](index.html-1024x768.png) | [Tablet](tablet.html-1024x768.png) |
| 1366 × 768 | 689 × 689 | 82.20 px | [Main](index.html-1366x768.png) | [Tablet](tablet.html-1366x768.png) |
| 1920 × 1080 | 1001 × 1001 | 119.64 px | [Main](index.html-1920x1080.png) | [Tablet](tablet.html-1920x1080.png) |

Additional checked sizes: 320×568 (251 px board), 568×320 (241 px),
640×360 (281 px), 600×960 (592 px), 844×390 (311 px),
1024×1366 (1016 px), and 2560×1440 (1361 px).

[Main measurements](index.html.json) · [Tablet measurements](tablet.html.json)

Portrait boards are width-limited at the requested sizes; landscape boards are
height-limited with 79 px reserved for clocks, gaps and safe outer margins.
For comparison, the [previous interface report](../issue-3/README.md) recorded
235 px at 915×412, 489 px at 1024×768/1366×768 and 801 px at 1920×1080.

## Verification

- `npm test`: 13 unit tests passed (rules, clocks, payouts, exact opening ranking).
- `npm run test:browser`: 42 browser tests passed, including two new responsive
  scenarios covering 14 viewport sizes each, both entry points and rotations.
- Geometry checks assert maximum fitted square area, whole-board visibility,
  contained pieces, both clocks and essential actions in the viewport, and zero
  horizontal/vertical document overflow. Expanded history and manual input are
  checked at every size, including the shortest landscape control rail.
- The existing suite exercises real bundled Stockfish WASM, tap and drag input,
  manual moves, legal/illegal moves, all special-move animations, underpromotion,
  en passant, checkmate/timeout/settlement, undo, archive replay, opening workers,
  independent Arena engines, pause/resume, animation durations and reduced motion.
- Profiles, PIN generation, selection persistence, themes, balances, backup
  encryption/import/recovery, legacy migration, fixed IDs, failed-write retry,
  writer locking, offline reload and cross-entry-point saved games remain covered.
- The preference/reload regression waits for the queued IndexedDB write to
  commit before unloading, avoiding a timing-dependent test failure.
- `git diff --check` passed. Engine, rules, storage and backup modules are unchanged.

Program ID remains `47f4d94492933a3b0a3f406e6e4ce412`.
Storage Key / IndexedDB database remains `bbebe43a0b38a335`.
There are no saved-data schema changes or migrations in this change.

Environment: Linux, Node 24.19.0, Playwright 1.56.1 and system Chromium;
mobile/touch emulation under the actual repository subpath. These tests do not
claim physical-device, Safari or Firefox coverage. Safe-area and visual-viewport
support remain in place; actual virtual-keyboard behavior depends on the browser.

Live entry points (GitHub Pages deployment follows main):
[Main](https://ae6820dc.github.io/chess/credit-chess/stockfish/) ·
[Tablet](https://ae6820dc.github.io/chess/credit-chess/stockfish/tablet.html).
