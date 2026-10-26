# Independent Credit Chess editions

| Edition | Public URL | Bundled engine |
| --- | --- | --- |
| Stockfish 18 Credit Chess | https://ae6820dc.github.io/chess/credit-chess/stockfish/ | Stockfish.js npm 18.0.0, `stockfish-18-lite-single.js` + `.wasm` |
| Stockfish 19 Credit Chess | https://ae6820dc.github.io/chess/credit-chess/stockfish-19/ | Stockfish.js npm 19.0.1, `stockfish-19-lite-single.js` + `.wasm` |

Both are authentic Lite Single-Threaded WebAssembly distributions, with embedded
NNUE networks, bundled chess.js 1.4.0 and corresponding source archives. Neither
requires a backend, external runtime files, cross-origin isolation headers or
SharedArrayBuffer. Vendor NOTICE and SHA256SUMS document provenance. The adapter
checks the actual UCI `id name` on startup; a mismatched generation fails closed.

## Data and PWA isolation

The original app's `storage.js` is unchanged: database `bbebe43a0b38a335`, Program
ID `47f4d94492933a3b0a3f406e6e4ce412`, and its existing backward-compatible legacy
handling remain intact. No reset, rename or new migration is introduced.

The new edition opens only `sf19-credit-chess-v1`, Program ID
`af55f489f53544ca8df607b627748719`. It has no legacy database migration or automatic
import. Profiles, authentication records, credits, preferences, games, archives,
recovery backups and Arena results all live in the edition's own IndexedDB.
Neither edition currently stores state in localStorage or sessionStorage. Reserve
`sf18:` and `sf19:` respectively for any future Web Storage keys; do not add shared
keys. Export/import remains an explicit user action with the same backup format.

Writer locks use `stockfish-credit-chess-writer` and
`stockfish-19-credit-chess-writer`, so both editions can operate simultaneously.
Each edition vendors every runtime dependency within its own directory.

The original installed manifest ID `/chess/credit-chess/stockfish/tablet-app-v3`
is preserved. The new ID is `/chess/credit-chess/stockfish-19/tablet-app-v3`.
Names are Stockfish 18/19 Credit Chess, with short names SF18/SF19 Chess. Each
manifest is linked from all entrypoints and launches its own tablet interface.
Each `sw.js` registers in its own directory; caches include the full worker scope
path and the new edition also has its own cache prefix. No cache deletion or
service-worker unregistration affects other applications. Identical icon artwork
is retained, with edition-specific SVG accessible titles and PWA labels.

## Reproduce verification

In each edition directory run `npm ci`, `npm test`, and `npm run test:browser`.
The Playwright configuration uses `/usr/bin/chromium` by default; override with
`CHROMIUM_PATH` if needed. The original edition's `editions.spec.js` additionally
tests both apps together: concurrent profiles and balances, distinct preferences,
manifest IDs, worker scopes, caches, offline engines, refresh persistence,
no requests from 19 to the 18 directory, complete legal games with two workers,
and visible version branding at 320, 412, 768 and 1280 pixels.

The inherited migration suite remains in 18. It is intentionally absent from 19,
which never reads a legacy database. All other existing unit/browser tests are
retained and run for each edition, including Arena pause/resume/stop, million-game
configuration, archives, Atlas, credit accounting, premoves and animation.

## Verification results (2026-10-26)

- Unit suites: 50 passed per edition.
- Existing SF18 browser suite: 113 passed (6.7 minutes).
- SF19 browser suite: 107 passed and one initial failure (6.5 minutes). The
  failing rank-99 Arena continuation fixture timed out waiting for the pause
  button; it passed three consecutive focused repeats (11.7 seconds). No runtime
  change was needed. All 108 distinct SF19 tests therefore passed across the
  suite and focused repeats; the initial full run was not entirely green.
- Cross-edition browser suite: 7 passed. Both engines returned Elo 1320–3190.
- Actual UCI identities: `Stockfish 18 Lite WASM`, `Stockfish 19 Lite WASM`.
- Full two-worker games reached terminal positions (141 and 302 plies in the
  first recorded run; chess.js validated every move).
- Chromium CDP installed and launched both PWAs, then launched both again after
  both installations. Reproduced with `/chess/credit-chess/` URL paths using
  `python tests/pwa/server.py` and `python tests/pwa/editions.py` from the repo root
  with the appropriate full paths.
- Original storage module and SF18 engine bytes match the pre-change commit.
  Shared UI/game modules match between editions; SF19 vendored checksums pass.

Limitations: no Android device/emulator or Android Chrome was available; touch
and mobile Chromium emulation passed but does not establish physical Android
compatibility. Production GitHub Pages loading cannot be certified from this
environment: direct Pages access is outside its allowed hosts and the GitHub
Pages API returned Forbidden. Local tests verify the static assets and Pages
subpaths. Cross-browser testing and inspection of a user's actual browser data
were not available; preservation is checked using seeded compatibility fixtures
and unchanged original storage/engine files. Existing unrelated-repository PWA
integration tests require the separate `ae6820dc/9062` checkout; the new two-edition
native install/launch test was run independently.
