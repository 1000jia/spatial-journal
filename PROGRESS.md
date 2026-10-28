# Keyword graph development checkpoint

Branch: `feat/keyword-knowledge-graph`, based on the preserved Spatial Journal MVP branch.

Implemented a 2D SVG concept graph in place of the 3D sphere. Notes, concepts, themes, and explainable connections are separately persisted. Version 2 migrates version 1 in-place with an original-note backup, preserving old note IDs/text/timestamps, drafts, undo and metadata. Legacy note-similarity edges are not concept evidence.

Implemented editable local English/Chinese keyword suggestions, normalization and aliases, node CRUD/merge/split, topic CRUD/color/merge/reassignment, one/two/full-hop focus, source-note evidence/counts, manual links, explicit exclusions, pan/zoom and persisted dragged positions. Existing editor, drafts, submission undo and chronological archive retained. Graph saves are atomic and batch-queued.

Actual test results will be recorded after the final complete regression run. See README for behavior, migration details and algorithm limitations. Existing files and prior Git history preserved.

Known environment limitation from the previous MVP: Git HTTPS push works; GitHub API was Forbidden and api.github.com is absent from the currently enforced network policy. Do not repeatedly retry. A prior environment configuration draft includes that domain, but needs user review/publishing before it applies. No pull request creation or merge is claimed here.

Final verification (2026-10-28):
- `npm test`: 17 unit tests passed (model, graph and versioned storage).
- `npm run test:e2e`: all 7 Chromium scenarios passed in 32.8 seconds, including the existing 3 editor/archive scenarios.
- `npm run build`: TypeScript and Vite succeeded. Initial graph bundle ~396 kB / 128 kB gzip; optional archive chunk ~901 kB / 244 kB gzip retains a size warning.
- `git diff --check`: passed.
- Desktop and 390-pixel mobile layouts inspected; mobile horizontal overflow check passed. Chinese keyword suggestions manually inspected. Development server remains available on port 5173.
