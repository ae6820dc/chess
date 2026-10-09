# Issue #2 — fixed-viewport interface verification

Implemented only within `credit-chess/stockfish/`. The rules, engine, clocks,
credit settlement and IndexedDB schema were preserved.

## Changes

- After unlock, the application uses a viewport-height grid shell with `100vh`
  fallback, `100dvh`, safe-area padding and visual-viewport resize handling.
- Header branding, profile, imaginary-credit balance and navigation are compact.
- Desktop/laptop: board and both clock rows on the left; status, critical actions,
  collapsible manual input, bounded match configuration and history on the right.
- Portrait: critical actions above the board; Match settings/Move history expand
  a bounded internal pane, reducing board allocation instead of covering it.
  Starting a game closes the secondary pane. Landscape places these controls
  beside the board to keep the board's remaining height available.
- A ResizeObserver measures the real board slot. Size is the floor of
  `min(slot.width, slot.height)`. Piece/coordinate sizes follow the measured
  board. No header/nav/clock height is hardcoded into a viewport subtraction.
- Every non-Play tab scrolls within its own pane. Long move lists scroll within
  their own focusable list. Notifications, large balances and profile names have
  bounded accessible overflow. The document root's overflow remains `visible`.
- Replay uses a native modal dialog: bounded board, Previous/Next/Close controls,
  keyboard focus trapping and Escape dismissal. Promotion remains a native dialog.
- Service-worker cache version increased to v2 and includes `layout.js`; existing
  saved profiles/games do not need a migration.

## Commands and results

```sh
npm test
# 13 passed, 0 failed
npm run test:browser
# 18 passed, 0 failed (1.2 minutes)
node --check app.js
node --check layout.js
node --check sw.js
sha256sum -c vendor/SHA256SUMS
git diff --check
# all passed
```

Node 24.19.0, Playwright 1.56.1, Chromium 151.0.7922.173. Tests run beneath
`/credit-chess/stockfish/`, including genuine WASM worker replies. All twelve
existing browser tests are retained; the manual-input test now explicitly opens
its disclosure, and its original assertions are preserved. Six new layout tests
cover the four mandatory viewports, orientation/shorter-window behavior, and
320×568 with a 200-digit credit balance.

Every mandatory viewport checks:

- document scrollHeight ≤ clientHeight + 1, scrollWidth ≤ clientWidth + 1,
  root/body/window scroll offsets all zero, root overflow not hidden/clipped;
- square board and all four corner squares fully inside and reachable;
- both player names/clocks, status, Resign, Claim draw and Undo visible;
- optional From/To inputs accessible, real engine reply, actual pointer drag and
  analysis undo; no mocked engine;
- long move history scrolls internally with keyboard End;
- all other tabs keep document scroll at zero and allow deep content access,
  including 30 archive fixtures, modal replay and JSON export;
- Arena pause reachable with board/clocks/actions visible in the paused arena.

Presentation-only long-list/archive fixtures stress overflow; engine/gameplay
checks use actual rules and Stockfish. Running-arena geometry is measured after
pause so worker-driven board replacement cannot race DOM measurements.

## Measured viewport geometry

| Viewport | Board | Document scrollHeight / clientHeight | scrollTop |
| --- | --- | --- | --- |
| 1920x1080 | 801×801 | 1080 / 1080 | 0 |
| 1366x768 | 489×489 | 768 / 768 | 0 |
| 412x915 | 392×392 | 915 / 915 | 0 |
| 915x412 | 182×182 | 412 / 412 | 0 |

Raw bounding rectangles and document measurements: [measurements.json](measurements.json).
Screenshots show an actual started analysis game, before the first move:

- [1920×1080 desktop](desktop-1920x1080.png)
- [1366×768 laptop](laptop-1366x768.png)
- [412×915 mobile portrait](portrait-412x915.png)
- [915×412 mobile landscape](landscape-915x412.png)

## Limits

- A 915×412 landscape board is 182 pixels wide (about 22 pixels per square),
  although critical controls remain at least 44 pixels tall. Use the optional
  manual input or portrait orientation for more precise input. Smaller windows,
  an expanded secondary pane or the on-screen keyboard can reduce the board
  further. At 320×568 the layout still has no document scroll; this is not a
  claim that such small squares are comfortable touch targets.
- The keyboard/browser-bar resize path was tested by shrinking the viewport to
  412×600 with manual input open and a long notification. It keeps controls,
  player names/clocks and the complete board reachable. Below 320 pixels wide or
  roughly 400 pixels high, simultaneous usable board/control sizing is not
  guaranteed; increase the window or close secondary/manual panes.
- Desktop Chromium and touch/mobile Chromium emulation were tested. No physical
  Android 16 device, native mobile keyboard/browser chrome, Firefox or Safari
  was available for this run. Native pinch zoom remains enabled and is not
  overridden by the visual-viewport handler.
- Original engine/generator/security limitations in the main README still apply.

Live URL: https://ae6820dc.github.io/chess/credit-chess/stockfish/
