# Credit Chess Windows test build

This is an **unsigned, hosted-web** Electron test wrapper for Stockfish 19 Credit Chess. It opens the existing GitHub Pages desktop UI. An internet connection is needed on first launch, and offline operation is **not guaranteed** until tested with its service worker/cache. This is **not** the Microsoft Store MSIX release.

Run GitHub Actions workflow **Credit Chess Windows test installer** on branch `windows-chess-store-prep`, then download the **Credit-Chess-Windows-Test** artifact. Windows SmartScreen may warn because the installer is unsigned.

Before Store submission: test offline behavior, review Stockfish/chess.js licenses and attributions, package the app appropriately as MSIX or PWA, reserve the Store identity and obtain certification. Do not distribute this test installer as a trusted signed release.
