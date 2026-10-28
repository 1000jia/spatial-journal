import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { Network as NetworkIcon, Layers, Plus, Lock } from "lucide-react";
import { Editor } from "./Editor";
import { Network } from "./Network";
import {
  ConceptPanel,
  RelationPanel,
  ThemeManager,
  type Apply,
} from "./GraphPanels";
import {
  addConcept,
  assignKeywords,
  migrateGraph,
  neighborhood,
  type GraphState,
} from "./graph";
import { storage } from "./storage";
import { demoEntries } from "./demo";
import type { Entry } from "./model";
import "./graph.css";
const Archive = lazy(() =>
  import("./Space").then((m) => ({ default: m.Space })),
);
interface Undo {
  saved: Entry;
  previous?: Entry;
  before?: GraphState;
}
export default function App() {
  const [state, setState] = useState<GraphState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = useRef<GraphState | null>(null),
    locked = useRef(false);
  const [demo, setDemo] = useState(true),
    [view, setView] = useState<"graph" | "archive" | "topics">("graph");
  const [selected, setSelected] = useState<string | null>(null),
    [edgeId, setEdgeId] = useState<string | null>(null),
    [hops, setHops] = useState(1),
    [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined),
    [noteId, setNoteId] = useState<string | null>(null),
    [undo, setUndo] = useState<Undo | null>(null);
  const [newName, setNewName] = useState(""),
    [newTopic, setNewTopic] = useState("");
  const [index, setIndex] = useState(0),
    [timeline, setTimeline] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    void (async () => {
      try {
        await storage.seed(demoEntries);
        const graph = await storage.loadGraph();
        current.current = graph;
        setState(graph);
        setUndo((await storage.setting<Undo>("undo")) ?? null);
      } catch {
        setError(
          "Could not open or migrate local data. Existing data has not been deleted. Close older tabs and reload.",
        );
      }
    })();
  }, []);
  const apply: Apply = async (transform) => {
    if (locked.current || !current.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      const next = transform(structuredClone(current.current));
      await storage.saveGraph(next, { undo: null });
      current.current = next;
      setState(next);
      setUndo(null);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your previous data is unchanged.",
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  async function save(entry: Entry): Promise<boolean> {
    if (locked.current || !current.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      const before = current.current,
        previous = before.notes.find((n) => n.id === entry.id);
      const next = assignKeywords(before, entry, entry.keywords);
      const saved = next.notes.find((n) => n.id === entry.id)!;
      const record = { saved, previous, before };
      await storage.saveGraph(next, {
        undo: record,
        [previous ? "draft-" + entry.id : "draft"]: null,
      });
      current.current = next;
      setState(next);
      setUndo(record);
      setEditing(undefined);
      setDemo(entry.demo);
      setSelected(saved.conceptIds?.[0] ?? null);
      setEdgeId(null);
      setNoteId(null);
      setView("graph");
      return true;
    } catch {
      setError("Could not save. Keep this editor open and try again.");
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function undoSave() {
    if (!undo || !current.current || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const before =
        undo.before ??
        migrateGraph(
          current.current.notes
            .filter((n) => n.id !== undo.saved.id)
            .concat(undo.previous ? [undo.previous] : []),
          current.current,
        );
      const draftKey = undo.previous ? "draft-" + undo.saved.id : "draft";
      await storage.saveGraph(before, {
        undo: null,
        [draftKey]: {
          text: undo.saved.text,
          topic: undo.saved.primaryTopic,
          tags: undo.saved.tags.join(", "),
          keywords: undo.saved.keywords.join(", "),
        },
      });
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* IndexedDB is authoritative. */
      }
      current.current = before;
      setState(before);
      setDemo(undo.saved.demo);
      setEditing(undo.previous ? undo.saved : null);
      setUndo(null);
      setSelected(null);
      setEdgeId(null);
    } catch {
      setError("Could not undo. Previous data remains saved.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const notes = useMemo(
    () =>
      state?.notes
        .filter((n) => n.demo === demo && !n.archived)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) ?? [],
    [state, demo],
  );
  const concepts = useMemo(
    () => state?.concepts.filter((c) => c.demo === demo) ?? [],
    [state, demo],
  );
  const edges = useMemo(
    () =>
      state?.edges.filter(
        (e) =>
          concepts.some((c) => c.id === e.source) &&
          concepts.some((c) => c.id === e.target),
      ) ?? [],
    [state, concepts],
  );
  const lit = neighborhood({ concepts, edges }, selected, hops);
  if (query.trim())
    for (const c of concepts)
      if (
        ![c.label, ...c.aliases].some((t) =>
          t.toLowerCase().includes(query.toLowerCase()),
        )
      )
        lit.delete(c.id);
  const picked = state?.concepts.find((c) => c.id === selected),
    edge = state?.edges.find((e) => e.id === edgeId),
    note = state?.notes.find((n) => n.id === noteId);
  const select = (id: string | null) => {
    setSelected(id);
    setEdgeId(null);
    setNoteId(null);
  };
  const open = (entry: Entry) => {
    setEditing({
      ...entry,
      keywords: (entry.conceptIds ?? [])
        .map((id) => state?.concepts.find((c) => c.id === id)?.label)
        .filter((s): s is string => !!s),
    });
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#">
          <NetworkIcon size={30} />
          <span>
            spatial<span className="brand-sub">JOURNAL</span>
          </span>
        </a>
        <div className="nav-label">YOUR INNER LANDSCAPE</div>
        <nav>
          <button
            className={view === "graph" ? "active" : ""}
            onClick={() => setView("graph")}
          >
            <NetworkIcon size={18} />
            Knowledge Graph
          </button>
          <button
            className={view === "archive" ? "active" : ""}
            onClick={() => setView("archive")}
          >
            <Layers size={18} />
            Temporal Archive
          </button>
          <button
            className={view === "topics" ? "active" : ""}
            onClick={() => setView("topics")}
          >
            Manage topics
          </button>
          <button onClick={() => setEditing(null)} disabled={!state}>
            <Plus size={18} />A new thought
          </button>
        </nav>
        <div className="nav-label">THREADS OF THOUGHT</div>
        {state?.themes.map((t) => (
          <div className="topic-key" key={t.id}>
            <i style={{ background: t.color }} />
            {t.name}
            <small>{concepts.filter((c) => c.topicId === t.id).length}</small>
          </div>
        ))}
        <div className="sidebar-foot">
          <Lock size={13} /> Local to this browser. No AI API.
        </div>
      </aside>
      <main>
        <header>
          <span>A PLACE FOR YOUR THOUGHTS</span>
          <button
            onClick={() => {
              setDemo(!demo);
              select(null);
              setQuery("");
              setIndex(0);
            }}
          >
            {demo ? "Exploring demo journal" : "My personal journal"} ⌄
          </button>
        </header>
        <section className="hero">
          <div>
            <small>
              {demo ? "A FICTIONAL JOURNAL" : "YOUR PERSONAL KNOWLEDGE"}
            </small>
            <h1>
              {view === "archive" ? (
                <>
                  The days become
                  <br />
                  <em>a story.</em>
                </>
              ) : (
                <>
                  One concept.
                  <br />
                  <em>Many connections.</em>
                </>
              )}
            </h1>
            <p>Notes provide evidence. Concepts form the network.</p>
          </div>
          <button
            className="write-button"
            disabled={!state}
            onClick={() => setEditing(null)}
          >
            Write a thought
          </button>
        </section>
        {state ? (
          <fieldset className="graph-workspace" disabled={busy}>
            <p className="save-indicator" role="status">
              {busy ? "Saving changes…" : "All changes saved locally"}
            </p>
            {view === "topics" ? (
              <ThemeManager state={state} apply={apply} />
            ) : (
              <>
                <div className="graph-heading">
                  <span>
                    {view === "graph"
                      ? "KEYWORD KNOWLEDGE GRAPH"
                      : "TEMPORAL ARCHIVE"}
                  </span>
                  <small>{notes.length} thoughts</small>
                  <small>
                    {concepts.length} concepts ·{" "}
                    {edges.filter((e) => !e.excluded).length} connections
                  </small>
                  <input
                    aria-label="Find a concept"
                    placeholder="Find a concept…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {view === "graph" ? (
                  <>
                    <div className="focus-controls">
                      <label>
                        Explore
                        <select
                          aria-label="Neighborhood depth"
                          value={String(hops)}
                          onChange={(e) => setHops(Number(e.target.value))}
                        >
                          <option value="1">One hop</option>
                          <option value="2">Two hops</option>
                          <option value="Infinity">Full network</option>
                        </select>
                      </label>
                      <button
                        onClick={() => {
                          select(null);
                          setQuery("");
                        }}
                      >
                        Exit focus
                      </button>
                      <span>
                        Connections show co-occurrence, not causation.
                      </span>
                    </div>
                    <Network
                      concepts={concepts}
                      themes={state.themes}
                      edges={edges}
                      selected={selected}
                      lit={lit}
                      onSelect={select}
                      onEdge={(id) => {
                        setEdgeId(id);
                        setNoteId(null);
                      }}
                      onMove={(id, x, y) =>
                        apply((s) => ({
                          ...s,
                          concepts: s.concepts.map((c) =>
                            c.id === id ? { ...c, x, y } : c,
                          ),
                        }))
                      }
                    />
                    <form
                      className="concept-add"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await apply((s) => {
                            addConcept(
                              s,
                              newName,
                              newTopic || s.themes[0].id,
                              demo,
                            );
                            return s;
                          })
                        )
                          setNewName("");
                      }}
                    >
                      <input
                        aria-label="New concept name"
                        placeholder="Add a concept…"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <select
                        aria-label="New concept topic"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                      >
                        <option value="">Choose primary topic</option>
                        {state.themes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button>Add concept</button>
                    </form>
                    <div className="inspection-grid">
                      {picked && !edge && (
                        <ConceptPanel
                          key={picked.id}
                          state={state}
                          concept={picked}
                          apply={apply}
                          onSelect={select}
                          onOpen={open}
                          onClose={() => select(null)}
                        />
                      )}
                      {edge && (
                        <RelationPanel
                          state={state}
                          edge={edge}
                          apply={apply}
                          onOpen={open}
                          onClose={() => setEdgeId(null)}
                        />
                      )}
                    </div>
                    <details className="excluded-list">
                      <summary>
                        Excluded connections (
                        {edges.filter((e) => e.excluded).length})
                      </summary>
                      {edges
                        .filter((e) => e.excluded)
                        .map((e) => (
                          <button key={e.id} onClick={() => setEdgeId(e.id)}>
                            {concepts.find((c) => c.id === e.source)?.label} ↔{" "}
                            {concepts.find((c) => c.id === e.target)?.label}
                          </button>
                        ))}
                    </details>
                  </>
                ) : (
                  <>
                    <div className="archive-controls">
                      <button
                        aria-pressed={!timeline}
                        onClick={() => setTimeline(false)}
                      >
                        Paper stack
                      </button>
                      <button
                        aria-pressed={timeline}
                        onClick={() => setTimeline(true)}
                      >
                        Spatial timeline
                      </button>
                      <button
                        aria-label="Previous page"
                        disabled={index <= 0}
                        onClick={() => setIndex((i) => i - 1)}
                      >
                        ←
                      </button>
                      <span>
                        {notes.length ? Math.min(index + 1, notes.length) : 0} /{" "}
                        {notes.length}
                      </span>
                      <button
                        aria-label="Next page"
                        disabled={index >= notes.length - 1}
                        onClick={() => setIndex((i) => i + 1)}
                      >
                        →
                      </button>
                    </div>
                    <div
                      className="scene"
                      onWheel={(e) =>
                        setIndex((i) =>
                          Math.max(
                            0,
                            Math.min(
                              notes.length - 1,
                              i + (e.deltaY > 0 ? 1 : -1),
                            ),
                          ),
                        )
                      }
                    >
                      <Suspense fallback={<p>Opening archive…</p>}>
                        <Archive
                          entries={notes}
                          archive
                          selected={noteId}
                          onSelect={(n) => setNoteId(n.id)}
                          timeline={timeline}
                          index={Math.min(index, Math.max(0, notes.length - 1))}
                          reduced={!!reduced}
                        />
                      </Suspense>
                    </div>
                  </>
                )}
                {note && (
                  <div className="note-preview">
                    <p>{note.text}</p>
                    <button onClick={() => open(note)}>Open note</button>
                    <button
                      onClick={() => {
                        setView("archive");
                        setIndex(
                          Math.max(
                            0,
                            notes.findIndex((n) => n.id === note.id),
                          ),
                        );
                      }}
                    >
                      See in archive
                    </button>
                    <button onClick={() => setNoteId(null)}>
                      Close preview
                    </button>
                  </div>
                )}
              </>
            )}
            <section className="recent">
              <div className="section-title">
                <h2>Notes behind the concepts</h2>
                <span>{demo ? "DEMONSTRATION ENTRIES" : "YOUR ENTRIES"}</span>
              </div>
              <div className="note-grid">
                {notes.map((n) => (
                  <button
                    className="mini-note"
                    key={n.id}
                    onClick={() => setNoteId(n.id)}
                  >
                    <small>
                      {new Date(n.createdAt).toLocaleDateString()}{" "}
                      {n.demo ? " · DEMO" : ""}
                    </small>
                    <p>{n.text}</p>
                    <span>
                      {(n.conceptIds ?? [])
                        .map(
                          (id) =>
                            state.concepts.find((c) => c.id === id)?.label,
                        )
                        .join(" · ") || "No concepts assigned"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </fieldset>
        ) : (
          <p role="status">Opening and migrating your local journal…</p>
        )}
        <footer>
          Private by nature. Keyword co-occurrence is an editable association.
        </footer>
      </main>
      {error && (
        <div className="toast" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {undo && (
        <div className="toast" role="status">
          Thought saved.
          <button disabled={busy} onClick={() => void undoSave()}>
            Undo
          </button>
          <button
            aria-label="Dismiss saved message"
            onClick={() =>
              void storage
                .set("undo", null)
                .then(() => setUndo(null))
                .catch(() => setError("Could not dismiss undo record."))
            }
          >
            ×
          </button>
        </div>
      )}
      <AnimatePresence>
        {editing !== undefined && (
          <Editor
            key={editing?.id ?? "new"}
            entry={editing}
            onClose={() => setEditing(undefined)}
            onSave={save}
            reduced={!!reduced}
            themes={state?.themes ?? []}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
