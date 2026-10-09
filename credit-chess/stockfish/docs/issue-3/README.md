# Issue #3 verification — 2026-10-10

Separate `tablet.html` and `tablet.css` reuse `app.js`, chess.js, Stockfish,
profiles, IndexedDB, credits, archives and preferences. `style.css` is unchanged.
The desktop Play screen remains pixel-identical to main's original layout.

## Tests

- 13 rules/clock/payout/opening tests passed.
- Full browser regression run: 31 passed, zero failures (2.2 minutes).
- Final focused alignment, adjustable-duration and tablet-orientation run:
  3 passed, zero failures (11.3 seconds). This rechecks two existing scenarios
  and adds one: **32 distinct browser scenarios passed overall**.
- Real bundled Stockfish WASM was used, including independent Arena workers.
- Touch/manual/drag play, engine replies, archive replay, credits settlement,
  clock timeout, undo, profiles, backups/recovery, offline restore, writer lock,
  quota retry, openings, Arena series and pause/resume remain covered.
- Visible 600 ms player/engine/replay/Arena transforms verified. Settings save
  and take effect at 250/400/600/800/1000 ms; instant and reduced motion suppress
  animation. Castling animates king and rook; capture, en passant and promotion
  leave the correct piece count and centered final positions. Rapid replay and
  orientation changes cancel superseded transforms.
- Same profile, balance, game, archive, theme and duration survive desktop ↔
  tablet navigation and reload. Tablet panels and all section tabs remain
  reachable with no document overflow at every requested viewport.

Environment: Windows, Node.js, Playwright 1.56.1, headless Microsoft Edge
(Chromium), mobile/touch emulation. Tests run from the actual repository subpath.

## Measured square boards

| Viewport | Tablet page board | Screenshot |
| --- | --- | --- |
| 360 × 800 | 340 × 340 | [Phone](tablet-360x800.png) |
| 412 × 915 | 392 × 392 | [Phone](tablet-412x915.png) |
| 600 × 960 | 580 × 580 | [Small tablet](tablet-600x960.png) |
| 768 × 1024 | 647 × 647 | [Tablet portrait](tablet-768x1024.png) |
| 915 × 412 | 235 × 235 | [Phone landscape](tablet-915x412.png) |
| 1024 × 768 | 489 × 489 | [Tablet landscape](tablet-1024x768.png) |
| 1366 × 768 | 489 × 489 | [Wide tablet page](tablet-1366x768.png) |
| 1920 × 1080 | 801 × 801 | [Wide tablet page](tablet-1920x1080.png) |

Both clocks, names, game status and essential controls were checked within the
viewport. Settings/history use a closable overlay on smaller screens; larger
tablets have a side panel. Landscape navigation sits beside the board to retain
its height. Settings, manual input, histories and archives scroll internally.

## Desktop preservation

Compared against `1530e9c14bf00b150b9ead32cd83beb66ed9d7ab` using identical
unlocked profiles and the starting Play position. PNGs match byte-for-byte:

- 1366 × 768: board 489 × 489;
  [before](desktop-1366x768-before.png), [after](desktop-1366x768-after.png).
- 1920 × 1080: board 801 × 801;
  [before](desktop-1920x1080-before.png), [after](desktop-1920x1080-after.png).

The only desktop markup addition is the required movement preference in the
existing Settings section. Desktop CSS and Play structure are unchanged.

## Practical limits

Browser tests emulate phones/tablets; physical Android/iOS and Safari were not
available for this delivery. Reduced motion deliberately makes moves instant.
The short landscape board is constrained by the two clocks and accessible
navigation/actions. Replay remains manual; no autoplay was previously present.
Arena calculation retains the selected think-time budget, while visible
presentation waits for the preceding animation plus 150 ms. Real elapsed time
continues to count on the clock. Existing HTTPS/Web Locks and one-writer-tab
requirements still apply.

Desktop: https://ae6820dc.github.io/chess/credit-chess/stockfish/

Tablet: https://ae6820dc.github.io/chess/credit-chess/stockfish/tablet.html
