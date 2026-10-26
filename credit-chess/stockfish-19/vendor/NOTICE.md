# Dependency provenance

Vendored, unchanged runtime files:

- `chess.js`: npm `chess.js@1.4.0`, `dist/esm/chess.js` (BSD-2-Clause).
- `stockfish-19-lite-single.js` and `.wasm`: npm `stockfish@19.0.1`, `bin/`
  (GPLv3). Lite single-threaded flavor, network embedded in WASM. No worker/CDN
  dependencies are missing. Upstream UCI reports supported Elo 1320–3190 (verified in the browser test).
- `stockfish-source.tar.gz`: unmodified GitHub v19.0.1 source archive from
  `https://codeload.github.com/nmrugg/stockfish.js/tar.gz/refs/tags/v19.0.1`.
  Includes Stockfish C++ sources, JS wrapper generation/build scripts and NNUE
  download instructions. Runtime operation does not need this archive.

Licenses and upstream authors are preserved here. Application code is
GPL-3.0-or-later; chess.js retains its BSD notice. Source and binary checksums
are recorded in `SHA256SUMS`.
