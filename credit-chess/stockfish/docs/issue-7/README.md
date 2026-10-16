# Issue #7: manual version chooser

`index.html` is a responsive, keyboard-accessible chooser with explicit Desktop
and Tablet links. It never redirects. `landing.css` is isolated from the apps.
`desktop.html` contains the former desktop index, with only the brand link's
accessible label/title added. The tablet brand now returns to the same chooser.
No gameplay, storage, engine or app stylesheet code changed.

The service worker cache is bumped to v7 and precaches the chooser stylesheet and
both apps. Storage identifiers, schema, active profile selection, IndexedDB and
relative imports remain unchanged. README, proof harness and repository file
index references reflect the new entrypoint; historical issue screenshots retain
their original names.

Validation:
- `npm test`: 13 domain/opening tests.
- `npm run test:browser`: existing 42 Chromium regression tests covering real
  Stockfish, saved games, profiles, migrations, backups, offline use, responsive
  geometry, touch input and animations.
- `npx playwright test tests/browser/landing.spec.js`: 5 chooser tests covering
  320px phone, 768px tablet and 1366px desktop widths, keyboard navigation,
  return links, offline navigation, unchanged saved state and active game resume.
- Visual inspection of the desktop chooser; `git diff --check`.
