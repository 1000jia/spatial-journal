# Spatial Journal — keyword knowledge graph

A private local-first thought diary. **One keyword/concept is one 2D node. Notes are the evidence behind connections, never graph nodes.** React + TypeScript + Vite; SVG for the knowledge graph; IndexedDB for local storage. The existing paper editor and optional chronological 3D archive remain available.

## Run

Node.js 22.12+ and npm (tested on Node 24):

```sh
npm ci
npm run dev
```

Use Vite's printed address. Keep the process running. `npm run build` creates the production app; `npm run preview` serves that build.

No account, API key, paid AI, analytics, remote font or external classification service is used. Writing stays in this browser's origin. Clearing site data removes it; this MVP does not provide encryption or sync.

## Use

- Write a full thought. The editor suggests concepts locally; edit the comma-separated Keywords field to add, remove or change any suggestion. “Suggest keywords” explicitly regenerates suggestions. Clearing Keywords deliberately saves a note without concepts. Tags remain separate note metadata.
- Switch between the fictional demo and your personal journal at the top right. New notes are personal. Concepts and edges never cross these datasets. Fresh demo notes have curated concept annotations; existing stored demo notes retain their original keywords.
- Select a labeled concept to highlight its neighborhood. Choose one hop, two hops, or full network; “Exit focus” restores the network. Click a neighbor to continue exploring. Search dims labels and aliases that do not match.
- Zoom with the wheel or buttons. Drag the background to pan; drag a node to save its position. Keyboard: Tab through graph nodes/edges; Enter/Space selects; arrow keys move a focused node. Positions persist after the save indicator finishes; view zoom/pan are session controls.
- Concept details provide rename, primary topic, delete, merge, manual link creation and split. A split moves selected supporting notes to a new distinct concept, leaving other note references unchanged. Deleting a node removes its references and edges, never the source notes. Unreferenced concepts can intentionally remain as standalone nodes.
- Merge keeps the target ID, unions note references and aliases, drops self-links and combines connection policies. An explicit exclusion wins a policy collision. Aliases ensure later use of the merged name resolves to the surviving concept. Manually created links stay with the original node during a split; new co-occurrence edges are computed from the reassigned notes.
- Click an edge for its exact supporting notes, distinct support count, manual flag and exclusion flag. A manual-only edge has zero supporting notes. Excluding an edge suppresses its rendering/traversal without deleting its evidence; restore it from “Excluded connections”. An excluded relation stays excluded even when additional notes support it.
- “Manage topics” adds/renames topics, edits colors, merges topics and deletes them with a required replacement. All concepts and notes are reassigned before a topic is removed; the last topic cannot be removed. Topics are shared across the demo and personal journal, while their concepts/edges are isolated.
- Temporal Archive retains paper stack/depth timeline, previous/next and wheel navigation. Open a source note to edit the original. Save / Ctrl-or-Cmd+Enter / deliberate handle drag persists before closing. The latest submission can be undone, including after refresh. Other graph mutations clear that submission undo record so it cannot overwrite later edits.

## Extraction: capabilities and limits

`keywords.ts` is a replaceable, deterministic local suggestion function:

1. Match a small curated list of English/Chinese phrases first (e.g. “mental health”, “machine learning”, “心理健康”, “知识图谱”).
2. Segment remaining text with `Intl.Segmenter`, remove a basic English stop list and short/non-word tokens, rank remaining words by frequency, and suggest at most 12 concepts. Manual edits are not capped at 12.
3. Match concepts by Unicode NFKC normalization, case, punctuation/space normalization and a tiny explicit inflection map (e.g. run/runs/running). Matching is scoped to the current journal dataset. Manual merges add persistent aliases.

It is **not semantic understanding**: the phrase vocabulary and stop list are incomplete, Chinese segmentation can include generic verbs, and synonyms/polysemy are not solved automatically. Phrase extraction beyond the dictionary is limited. Users should review suggestions, rename/merge duplicates and split ambiguous concepts by note. Primary-topic suggestions use a small bilingual keyword list and default to Reflection when no cue matches; users can correct them. An existing concept keeps its primary topic until manually reassigned.

An edge means its endpoints were assigned to the **same note** (which may include manual concept annotations), or were explicitly connected by the user. It never claims causation, agreement, entailment, or truth. Connections are undirected; no arrows or causal language are inferred. Same topic alone never creates a connection.

## Storage and compatible migration

Database name stays `spatial-journal`; schema increases **v1 → v2**:

| Store | Purpose |
|---|---|
| `entries` | Original notes with stable IDs, timestamps, text and new `conceptIds` / `topicId` references |
| `concepts` | Stable concept UUID, label, aliases, primary topic ID, dataset flag, saved x/y |
| `themes` | Stable topic ID, editable name and color |
| `edges` | Canonical endpoint-pair ID, supporting `noteIds`, `supportCount`, manual and excluded flags |
| `settings` | Existing drafts/undo/seed state, graph schema marker, migration backup |

The version-change transaction creates the new stores, snapshots original v1 entries in `settings["migration:v1:entries"]`, and backfills concept references from the old keywords/tags (or extraction for notes without keywords). Original note IDs, text, timestamps, metadata and legacy note relationships are retained. Old similarity relationships are **not** imported as concept evidence. Drafts, seed markers and legacy undo remain intact. Migration is idempotent on subsequent loads. Close older app tabs before upgrade; an upgrade waiting for an old connection may require closing that tab and refreshing.

Every graph mutation replaces notes/concepts/themes/edges in one IndexedDB transaction, including recovery metadata when saving or undoing a note. Failure aborts the complete transaction. Edge evidence is rebuilt from note references; each note supports an endpoint pair once. Aliases, manual links, exclusions, topics and dragged positions persist. `conceptIds` is authoritative; original `keywords`/`primaryTopic` fields remain for legacy compatibility, so the editor resolves the latest labels and topics through IDs.

The editor keeps a synchronous localStorage safety copy and an IndexedDB draft. IndexedDB recovery works after clearing localStorage. A single persisted submission snapshot supports undo; undoing a new note restores a draft, which survives another refresh. No multi-tab write conflict resolution is provided; use one editing tab. Storage is origin-specific (including hostname/port), and has no cross-device backup.

## Validate

```sh
npm test
npm run build
npx playwright install chromium  # only if no usable browser is installed
npm run test:e2e
```

Browser tests use `/usr/bin/chromium` when available or Playwright Chromium; override with `CHROMIUM_PATH`. They start/reuse Vite on port 5173.

Actual final results: **17 unit tests passed, 7 Chromium browser scenarios passed, production build passed**. The optional archive chunk has a size warning. Desktop and 390-pixel mobile layouts were inspected; no mobile horizontal overflow was detected.

Automated coverage includes keyword/phrase normalization, dataset isolation, exact edge provenance/counts, manual/excluded policies, edits, merges, splits, deletes, topic references, hop traversal, actual v1 database upgrade, draft/undo preservation, idempotent reopening and atomic rollback. Browser scenarios cover real v1 IndexedDB migration; node focus and path depth; zoom/pan/drag; evidence inspection; edge exclusion/restoration; concept and topic CRUD/merge/split; refresh persistence; cleared keywords; original editor saving/drafts/undo, responsive gesture submission and archive navigation. Runtime errors fail the graph scenarios.

## Architecture / remaining limits

`graph.ts`: pure graph operations and migration. `keywords.ts`: local extraction/canonicalization. `storage.ts`: versioned database and atomic commits. `Network.tsx`: interactive SVG. `GraphPanels.tsx`: editing/evidence. `Editor.tsx`: existing paper editor with editable concepts. `Space.tsx`: archive only, lazy loaded; the old sphere display has been removed.

Large graphs can still have overlapping labels and dense edges: focus, search, zoom and manual placement help. There is no force simulation, edge direction, typed relation ontology, semantic embedding provider, export, rich text or broad browser/device test matrix. Chromium is tested; Safari and real touch hardware are not. The optional Three.js archive still produces a chunk-size warning but is not loaded for the initial 2D graph.
