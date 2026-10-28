# Spatial Journal

A private, local-first spatial thought diary. React + TypeScript + Vite, Three.js / React Three Fiber / Drei, Motion, and IndexedDB. No accounts, analytics, remote fonts, or external semantic services.

## Run

Requires Node.js 22.12+ (tested with Node 24) and npm.

```sh
npm ci
npm run dev
```

Use the address printed by Vite. For a production build: `npm run build`, then `npm run preview`.

## MVP

- Idea Sphere: stable topic-cluster coordinates, colored nodes, weighted keyword/tag relationships, orbit/pan/zoom, selected and connected highlights, previews, search, filters, and keyboard-accessible entry list.
- Daily Note: fixed 360 × 700 CSS-pixel paper editor, scaled on small screens, scrolling text, dates, manual topics/tags, explainable topic suggestion, automatic draft saving, editing, Save / Ctrl-or-Cmd+Enter, and deliberate horizontal drag submission.
- Temporal Archive: chronological paper stack and depth timeline, paper thickness, binding dots, rendered text, previous/next controls, wheel and vertical drag navigation. Preview links jump to the corresponding page.
- Save completes before the editor exit animation. Entries, draft changes, and a single latest undo record persist in IndexedDB. Submitting and undoing update entries and recovery metadata in one transaction. localStorage is a synchronous draft safety copy; IndexedDB can recover a draft independently. Undo restores the previous entry and reopens revised text, or restores a new thought to the draft.
- Twenty clearly marked fictional demo notes live separately from personal notes and never generate cross-dataset connections. The dataset switch is at the top right; each new note is personal.
- Preview connection controls allow adding/removing links or correcting their strengths. Manually corrected outgoing links override automatic generation.
- Reduced-motion preferences disable spatial interpolation and shorten editor transitions. Essential actions have standard buttons and keyboard controls.

## Verify

```sh
npm test
npm run build
npx playwright install chromium  # needed only if a browser is not already available
npm run test:e2e
```

Browser tests use `/usr/bin/chromium` when available, otherwise Playwright's installed Chromium. Set `CHROMIUM_PATH` to override. Tests start or reuse Vite on port 5173. Unit tests cover classification, relationship strengths, stable coordinates, demo isolation, CRUD, seeding, draft state, and atomic submission/undo metadata. Browser tests cover save, reload, editing, undo after reload, IndexedDB draft recovery without localStorage, archive navigation, responsive editor, and drag submission. They also verify that undoing a new note restores a draft that survives another refresh, and assert no runtime errors in the persistence flow.

Validated in this environment: `npm ci`, production build, 7 unit tests, and 3 Chromium browser tests. The desktop editor was measured at 360 × 700 CSS pixels.

## Structure

`model.ts` defines the data model and provider-independent `SemanticEngine` interface. `storage.ts` owns IndexedDB transactions; `demo.ts` owns fixtures. `Space.tsx` owns the 3D scene; `App.tsx` owns navigation, previews, editor and submission. `style.css` owns the paper layout.

## Limits

This is an MVP: deterministic keyword/tag scoring (English lexicon), not embeddings or force simulation. Manual topic/tag corrections are supported; semantic layout remains stable after edits. Stack perforations are visual binding dots, and paper lighting is stylized. Timeline navigation moves by entry rather than date-range controls. Submission follows a curved 2D exit trajectory before the persisted node appears; it does not map the entire flight into world coordinates. Large text is previewed on 3D paper; open the editor for full text. No rich text, export, encryption, cross-device sync, multi-tab conflict resolution, deletion UI, or automated performance benchmark. Clearing site data/browser storage removes notes. Keep important writing backed up elsewhere. Three.js produces a build chunk warning; WebGL support is required for the scene, with a readable entry list fallback.

Only the latest submission can be undone. Closing a note keeps its draft; opening it again resumes unsaved edits. Browser test coverage currently targets Chromium, not Safari or real touch hardware.
