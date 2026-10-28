import { useEffect, useMemo, useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Orbit,
  Layers,
  Plus,
  ArrowUpRight,
  X,
  Lock,
  Search,
  PenLine,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Space } from "./Space";
import {
  colors,
  connect,
  makeEntry,
  semantic,
  topics,
  type Entry,
  type Topic,
} from "./model";
import { storage } from "./storage";
import { demoEntries } from "./demo";
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [view, setView] = useState<"sphere" | "archive">("sphere"),
    [timeline, setTimeline] = useState(false),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const [demo, setDemo] = useState(true),
    [filter, setFilter] = useState<Topic | null>(null),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Entry | null | undefined>(undefined),
    [undo, setUndo] = useState<{
      saved: Entry;
      previous: Entry | undefined;
    } | null>(null);
  const reduced = useReducedMotion();
  const archiveDrag = useRef<number | null>(null);
  useEffect(() => {
    (async () => {
      try {
        await storage.seed(demoEntries);
        setEntries(await storage.entries());
        setUndo(
          (await storage.setting<{
            saved: Entry;
            previous: Entry | undefined;
          } | null>("undo")) ?? null,
        );
      } catch {
        setError(
          "Local storage is unavailable. Please allow browser storage to save your notes.",
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const visible = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            !e.archived &&
            e.demo === demo &&
            (!filter || e.primaryTopic === filter) &&
            e.text.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries, demo, filter, query],
  );
  const picked = entries.find((e) => e.id === selected);
  async function save(entry: Entry): Promise<boolean> {
    try {
      const next = connect([
        ...entries.filter((e) => e.id !== entry.id),
        entry,
      ]);
      const record = {
        saved: entry,
        previous: entries.find((e) => e.id === entry.id),
      };
      await storage.replace(next, {
        undo: record,
        [record.previous ? "draft-" + entry.id : "draft"]: null,
      });
      setEntries(next);
      setUndo(record);
      setDemo(entry.demo);
      setSelected(entry.id);
      setEditing(undefined);
      setView("sphere");
      return true;
    } catch {
      setError("Could not save. Your editor remains open; please try again.");
      return false;
    }
  }
  async function undoSave() {
    if (!undo) return;
    try {
      const next = connect(
        entries
          .filter((e) => e.id !== undo.saved.id)
          .concat(undo.previous ? [undo.previous] : []),
      );
      await storage.replace(next, {
        undo: null,
        [undo.previous ? "draft-" + undo.saved.id : "draft"]: {
          text: undo.saved.text,
          topic: undo.saved.primaryTopic,
          tags: undo.saved.tags.join(", "),
        },
      });
      setEntries(next);
      setDemo(undo.saved.demo);
      setEditing(undo.previous ? undo.saved : null);
      setUndo(null);
      setSelected(null);
    } catch {
      setError("Could not undo. Please try again.");
    }
  }
  async function correctConnection(id: string, strength: number) {
    if (!picked) return;
    const manualRelated = picked.related.filter((r) => r.id !== id);
    if (strength > 0) manualRelated.push({ id, strength });
    const next = connect(
      entries.map((e) =>
        e.id === picked.id
          ? { ...e, manualRelated, updatedAt: new Date().toISOString() }
          : e,
      ),
    );
    try {
      await storage.replace(next, { undo: null });
      setEntries(next);
      setUndo(null);
    } catch {
      setError("Could not save connection correction.");
    }
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#">
          <Orbit size={30} />
          <span>
            spatial<span className="brand-sub">JOURNAL</span>
          </span>
        </a>
        <div className="sidebar-caption">YOUR INNER LANDSCAPE</div>
        <nav>
          <button
            className={view === "sphere" ? "nav active" : "nav"}
            onClick={() => setView("sphere")}
          >
            <Orbit size={18} />
            Idea Sphere<span>01</span>
          </button>
          <button
            className={view === "archive" ? "nav active" : "nav"}
            onClick={() => setView("archive")}
          >
            <Layers size={18} />
            Temporal Archive<span>02</span>
          </button>
        </nav>
        <button
          className="new-note"
          onClick={() => {
            setUndo(null);
            setEditing(null);
          }}
        >
          <Plus size={17} /> A new thought
        </button>
        <div className="sidebar-caption topic-heading">THREADS OF THOUGHT</div>
        <button className="topic" onClick={() => setFilter(null)}>
          All topics{" "}
          <span>{entries.filter((e) => e.demo === demo).length}</span>
        </button>
        {topics.map((t) => (
          <button
            key={t}
            className={"topic " + (filter === t ? "chosen" : "")}
            onClick={() => setFilter(filter === t ? null : t)}
          >
            <i style={{ background: colors[t] }} />
            {t}
            <span>
              {
                entries.filter((e) => e.demo === demo && e.primaryTopic === t)
                  .length
              }
            </span>
          </button>
        ))}
        <div className="side-bottom">
          <div className="privacy">
            <Lock size={14} /> Just for you. Stored on this device.
          </div>
          <p>
            A little space for
            <br />
            everything on your mind.
          </p>
          <span>SPATIAL JOURNAL · VOL. 01</span>
        </div>
      </aside>
      <main>
        <header>
          <span>A PLACE FOR YOUR THOUGHTS</span>
          <div className="header-right">
            <button
              className="dataset"
              onClick={() => {
                setDemo(!demo);
                setSelected(null);
                setIndex(0);
              }}
            >
              {demo ? "Exploring demo journal" : "My personal journal"}{" "}
              <span>⌄</span>
            </button>
            <div className="avatar">SJ</div>
          </div>
        </header>
        <section className="intro">
          <div>
            <div className="eyebrow">
              {demo
                ? "A FICTIONAL JOURNAL · OCTOBER 2026"
                : "YOUR PRIVATE JOURNAL"}
            </div>
            <h1>
              {view === "sphere" ? (
                <>
                  Every thought,
                  <br />
                  <em>connected.</em>
                </>
              ) : (
                <>
                  The days become
                  <br />
                  <em>a story.</em>
                </>
              )}
            </h1>
            <p>
              {view === "sphere"
                ? "Small moments. Unexpected connections. A universe that is uniquely yours."
                : "Return to a moment. See how your thoughts have changed."}
            </p>
          </div>
          <button
            className="write-button"
            onClick={() => {
              setUndo(null);
              setEditing(null);
            }}
          >
            <PenLine size={17} /> Write a thought <ArrowUpRight size={16} />
          </button>
        </section>
        <div className="workspace">
          <div className="space-top">
            <div className="view-label">
              <span className="live-dot" />{" "}
              {view === "sphere" ? "YOUR IDEA SPHERE" : "TEMPORAL ARCHIVE"}{" "}
              <small>{visible.length} thoughts</small>
            </div>
            <label className="search">
              <Search size={15} />
              <input
                aria-label="Search thoughts"
                placeholder="Find a thought…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          {view === "archive" && (
            <div className="archive-controls">
              <button
                aria-pressed={!timeline}
                onClick={() => setTimeline(false)}
              >
                Paper stack
              </button>
              <button aria-pressed={timeline} onClick={() => setTimeline(true)}>
                Spatial timeline
              </button>
              <button
                aria-label="Previous page"
                onClick={() => setIndex(Math.max(0, index - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {visible.length ? index + 1 : 0} / {visible.length}
              </span>
              <button
                aria-label="Next page"
                onClick={() =>
                  setIndex(Math.min(visible.length - 1, index + 1))
                }
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <div
            className="scene"
            onPointerDown={(e) => {
              archiveDrag.current = e.clientY;
            }}
            onPointerUp={(e) => {
              const delta = (archiveDrag.current ?? e.clientY) - e.clientY;
              archiveDrag.current = null;
              if (view === "archive" && Math.abs(delta) > 65)
                setIndex((i) =>
                  Math.max(
                    0,
                    Math.min(visible.length - 1, i + (delta > 0 ? 1 : -1)),
                  ),
                );
            }}
            onWheel={(e) => {
              if (view === "archive")
                setIndex((i) =>
                  Math.max(
                    0,
                    Math.min(visible.length - 1, i + (e.deltaY > 0 ? 1 : -1)),
                  ),
                );
            }}
          >
            {ready && (
              <Space
                entries={visible}
                selected={selected}
                onSelect={(e) => setSelected(e.id)}
                archive={view === "archive"}
                timeline={timeline}
                index={index}
                reduced={!!reduced}
              />
            )}
            {(!ready || visible.length === 0) && (
              <div className="empty">
                {ready
                  ? "Your next thought starts something."
                  : "Opening your journal…"}
                <button onClick={() => setEditing(null)}>
                  Write your first thought <ArrowUpRight size={15} />
                </button>
              </div>
            )}
            <div className="scene-caption">
              {view === "sphere" ? (
                <>
                  <Orbit size={14} /> Drag to explore · Scroll to zoom · Select
                  a thought
                </>
              ) : (
                <>Scroll through time · Select a page to read</>
              )}
            </div>
            <div className="scene-number">
              {view === "sphere"
                ? "01 / SEMANTIC LANDSCAPE"
                : "02 / THROUGH TIME"}
            </div>
          </div>
          <AnimatePresence>
            {picked && (
              <motion.div
                className="preview"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <button
                  className="close"
                  aria-label="Close preview"
                  onClick={() => setSelected(null)}
                >
                  <X size={16} />
                </button>
                <small style={{ color: colors[picked.primaryTopic] }}>
                  {picked.primaryTopic} · {date(picked.createdAt)}
                  {picked.demo ? " · DEMO" : ""}
                </small>
                <p>{picked.text}</p>
                <details className="connections">
                  <summary>Connections · keywords and shared tags</summary>
                  {picked.related.map((r) => (
                    <label key={r.id}>
                      <span>
                        {entries.find((e) => e.id === r.id)?.text.slice(0, 45)}…
                      </span>
                      <select
                        aria-label={"Connection strength " + r.id}
                        value={r.strength}
                        onChange={(e) =>
                          void correctConnection(r.id, Number(e.target.value))
                        }
                      >
                        <option value={r.strength}>
                          {Math.round(r.strength * 100)}%
                        </option>
                        <option value="0">Remove</option>
                        <option value="0.25">25%</option>
                        <option value="0.5">50%</option>
                        <option value="1">100%</option>
                      </select>
                    </label>
                  ))}
                  <select
                    aria-label="Add connection"
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        void correctConnection(e.target.value, 0.5);
                    }}
                  >
                    <option value="">Add a connection…</option>
                    {entries
                      .filter(
                        (e) =>
                          e.id !== picked.id &&
                          e.demo === picked.demo &&
                          !picked.related.some((r) => r.id === e.id),
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.text.slice(0, 55)}
                        </option>
                      ))}
                  </select>
                </details>
                <div>
                  <button onClick={() => setEditing(picked)}>
                    Open note <ArrowUpRight size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setView("archive");
                      setIndex(
                        Math.max(
                          0,
                          visible.findIndex((e) => e.id === picked.id),
                        ),
                      );
                    }}
                  >
                    See in archive
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <section className="recent">
          <div className="section-title">
            <h2>A few moments, revisited</h2>
            <span>
              {demo ? "DEMONSTRATION ENTRIES" : "YOUR RECENT ENTRIES"}
            </span>
          </div>
          <div className="note-grid">
            {visible.slice(0, 6).map((e) => (
              <button
                className="mini-note"
                key={e.id}
                onClick={() => setSelected(e.id)}
              >
                <div>
                  <span>
                    <i style={{ background: colors[e.primaryTopic] }} />
                    {e.primaryTopic}
                  </span>
                  <ArrowUpRight size={15} />
                </div>
                <p>{e.text}</p>
                <small>
                  {date(e.createdAt)} {e.demo ? " · DEMO" : ""}
                </small>
              </button>
            ))}
          </div>
          <details className="all-entries">
            <summary>
              Browse all {visible.length} thoughts with keyboard
            </summary>
            {visible.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setSelected(e.id);
                  setEditing(e);
                }}
              >
                {date(e.createdAt)} — {e.text.slice(0, 90)}
              </button>
            ))}
          </details>
        </section>
        <footer>
          <span>Let your mind wander. Give your thoughts a home.</span>
          <Lock size={13} /> Private by nature.
        </footer>
      </main>
      {error && (
        <div role="alert" className="toast">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {undo && (
        <div className="toast" role="status">
          Thought saved to your sphere.<button onClick={undoSave}>Undo</button>
          <button
            onClick={() => setUndo(null)}
            aria-label="Dismiss saved message"
          >
            <X size={14} />
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}
export function Editor({
  entry,
  onClose,
  onSave,
  reduced,
}: {
  entry: Entry | null;
  onClose: () => void;
  onSave: (e: Entry) => Promise<boolean>;
  reduced: boolean;
}) {
  const [text, setText] = useState(entry?.text ?? ""),
    [topic, setTopic] = useState<Topic | "">(entry?.primaryTopic ?? ""),
    [tags, setTags] = useState(entry?.tags.join(", ") ?? ""),
    [status, setStatus] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const suggestion = semantic.classify(text);
  const draftKey = entry ? "draft-" + entry.id : "draft";
  const changed = useRef(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    changed.current = false;
    const recover = (
      d: { text: string; topic: Topic | ""; tags: string } | null | undefined,
    ) => {
      if (active && !changed.current && d) {
        setText(d.text);
        setTopic(d.topic);
        setTags(d.tags);
      }
    };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) recover(JSON.parse(raw));
    } catch {
      /* IndexedDB recovery below. */
    }
    void storage
      .setting<{ text: string; topic: Topic | ""; tags: string }>(draftKey)
      .then(recover)
      .catch(() => {
        if (active) setStatus("IndexedDB recovery unavailable");
      });
    return () => {
      active = false;
    };
  }, [draftKey]);
  function updateDraft(next: {
    text: string;
    topic: Topic | "";
    tags: string;
  }) {
    changed.current = true;
    setText(next.text);
    setTopic(next.topic);
    setTags(next.tags);
    try {
      localStorage.setItem(draftKey, JSON.stringify(next));
      setStatus("Draft saved on this device");
    } catch {
      setStatus("Draft could not be saved; keep this card open");
    }
    void storage
      .set(draftKey, next)
      .catch(() => setStatus("IndexedDB draft unavailable"));
  }
  async function submit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    const result = makeEntry(
      text,
      topic || suggestion,
      tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      entry ?? undefined,
    );
    const saved = await onSave(result);
    if (saved) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* The saved entry remains in IndexedDB. */
      }
      void storage.set(draftKey, null).catch(() => {});
    } else setSubmitting(false);
  }
  function trapFocus(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Tab") {
      const items = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),textarea,input,select",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <motion.div
      className="editor-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        ref={dialog}
        onKeyDown={trapFocus}
        role="dialog"
        aria-modal="true"
        aria-label="Daily Note"
        className="editor paper"
        initial={{ y: reduced ? 0 : 60, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={
          reduced
            ? { opacity: 0 }
            : {
                scale: [1, 0.65, 0.05],
                x: [0, -120, -350],
                y: [0, -180, -80],
                opacity: [1, 1, 0],
              }
        }
        transition={{ duration: reduced ? 0 : 0.55 }}
      >
        <motion.div
          className="drag-handle"
          drag="x"
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (
              Math.abs(info.offset.x) > 110 ||
              Math.abs(info.velocity.x) > 700
            )
              void submit();
          }}
        >
          ⠿ <span>Drag here to send your thought</span>
        </motion.div>
        <div className="editor-heading">
          <div>
            <small>{date(entry?.createdAt ?? new Date().toISOString())}</small>
            <h2>{entry ? "A thought, revisited." : "What’s on your mind?"}</h2>
          </div>
          <button aria-label="Close editor" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {entry?.demo && (
          <div className="demo-mark">FICTIONAL DEMONSTRATION NOTE</div>
        )}
        <textarea
          autoFocus
          aria-label="Your thought"
          placeholder="An observation, a question, a little thing worth remembering…"
          value={text}
          onChange={(e) => updateDraft({ text: e.target.value, topic, tags })}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="editor-meta">
          <label>
            Topic
            <select
              aria-label="Primary topic"
              value={topic}
              onChange={(e) =>
                updateDraft({ text, topic: e.target.value as Topic | "", tags })
              }
            >
              <option value="">Suggested: {suggestion}</option>
              {topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <input
              aria-label="Topic tags"
              placeholder="quiet, attention, life"
              value={tags}
              onChange={(e) =>
                updateDraft({ text, topic, tags: e.target.value })
              }
            />
          </label>
        </div>
        <div className="editor-save">
          <span role="status">{status}</span>
          <button
            disabled={!text.trim() || submitting}
            onClick={() => void submit()}
          >
            Save thought <ArrowUpRight size={15} />
          </button>
        </div>
        <small className="editor-hint">
          One small thought is enough. ⌘ / Ctrl + Enter to save.
        </small>
      </motion.section>
    </motion.div>
  );
}
