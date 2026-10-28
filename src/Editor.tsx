import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import { makeEntry, semantic, topics, type Entry, type Topic } from "./model";
import { storage } from "./storage";
import { extractKeywords } from "./keywords";
import type { Theme } from "./graph";
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export function Editor({
  entry,
  onClose,
  onSave,
  reduced,
  themes,
}: {
  entry: Entry | null;
  onClose: () => void;
  onSave: (e: Entry) => Promise<boolean>;
  reduced: boolean;
  themes: Theme[];
}) {
  const [text, setText] = useState(entry?.text ?? ""),
    [topic, setTopic] = useState<Topic | "">(
      (themes.find((t) => t.id === entry?.topicId)?.name as Topic) ??
        entry?.primaryTopic ??
        "",
    ),
    [tags, setTags] = useState(entry?.tags.join(", ") ?? ""),
    [keywords, setKeywords] = useState<string | undefined>(
      entry?.keywords.join(", "),
    ),
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
      d:
        | { text: string; topic: Topic | ""; tags: string; keywords?: string }
        | null
        | undefined,
    ) => {
      if (active && !changed.current && d) {
        setText(d.text);
        setTopic(d.topic);
        setTags(d.tags);
        if (d.keywords !== undefined) setKeywords(d.keywords);
      }
    };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) recover(JSON.parse(raw));
    } catch {
      /* IndexedDB recovery below. */
    }
    void storage
      .setting<{
        text: string;
        topic: Topic | "";
        tags: string;
        keywords?: string;
      }>(draftKey)
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
    keywords?: string;
  }) {
    next = { ...next, keywords: next.keywords ?? keywords };
    setKeywords(next.keywords);
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
    result.topicId =
      themes.find((t) => t.name === (topic || suggestion))?.id ?? themes[0]?.id;
    result.keywords = (keywords ?? extractKeywords(text).join(", "))
      .split(/[,，\n]/)
      .map((k) => k.trim())
      .filter(Boolean);
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
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.12 }}
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
              {themes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Keywords
            <input
              aria-label="Concept keywords"
              value={keywords ?? extractKeywords(text).join(", ")}
              placeholder="Editable concepts, comma separated"
              onChange={(e) =>
                updateDraft({ text, topic, tags, keywords: e.target.value })
              }
            />
          </label>
          <button
            type="button"
            onClick={() =>
              updateDraft({
                text,
                topic,
                tags,
                keywords: extractKeywords(text).join(", "),
              })
            }
          >
            Suggest keywords
          </button>
          <small>
            Local word/phrase rules. Edit before saving; co-occurrence is not
            causation.
          </small>
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
