import { useState } from "react";
import {
  type GraphState,
  type Concept,
  type Connection,
  renameConcept,
  deleteConcept,
  mergeConcepts,
  splitConcept,
  changeTheme,
  mergeThemes,
  setConnection,
} from "./graph";
import { normalizeConcept } from "./keywords";
import type { Entry } from "./model";
export type Apply = (
  transform: (state: GraphState) => GraphState,
) => Promise<boolean>;
export function ConceptPanel({
  state,
  concept,
  apply,
  onSelect,
  onOpen,
  onClose,
}: {
  state: GraphState;
  concept: Concept;
  apply: Apply;
  onSelect: (id: string | null) => void;
  onOpen: (note: Entry) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(concept.label),
    [target, setTarget] = useState(""),
    [splitName, setSplitName] = useState(""),
    [moved, setMoved] = useState<string[]>([]);
  const notes = state.notes.filter((n) => n.conceptIds?.includes(concept.id));
  return (
    <section className="inspector" aria-label="Concept details">
      <div className="panel-title">
        <h2>{concept.label}</h2>
        <button onClick={onClose}>Close</button>
      </div>
      <small>
        {notes.length} supporting notes · aliases:{" "}
        {concept.aliases.join(", ") || "none"}
      </small>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void apply((s) => renameConcept(s, concept.id, label));
        }}
      >
        <label>
          Concept name
          <input
            aria-label="Concept name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <button>Rename concept</button>
      </form>
      <label>
        Primary topic
        <select
          aria-label="Concept topic"
          value={concept.topicId}
          onChange={(e) =>
            void apply((s) => ({
              ...s,
              concepts: s.concepts.map((c) =>
                c.id === concept.id ? { ...c, topicId: e.target.value } : c,
              ),
            }))
          }
        >
          {state.themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="danger"
        onClick={async () => {
          if (await apply((s) => deleteConcept(s, concept.id))) onSelect(null);
        }}
      >
        Delete concept
      </button>
      <details>
        <summary>Merge or connect concepts</summary>
        <select
          aria-label="Target concept"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">Choose another concept</option>
          {state.concepts
            .filter((c) => c.id !== concept.id && c.demo === concept.demo)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
        </select>
        <button
          disabled={!target}
          onClick={async () => {
            if (await apply((s) => mergeConcepts(s, concept.id, target)))
              onSelect(target);
          }}
        >
          Merge into target
        </button>
        <button
          disabled={!target}
          onClick={() =>
            void apply((s) =>
              setConnection(s, concept.id, target, {
                manual: true,
                excluded: false,
              }),
            )
          }
        >
          Create manual connection
        </button>
        <p>
          Merging keeps the target ID and combines note references and aliases.
          Exclusions win if edge policies collide.
        </p>
      </details>
      <details>
        <summary>Split concept by notes</summary>
        <p>
          Move the selected notes to a new concept; remaining notes keep this
          concept. Manual connections stay with the original.
        </p>
        <input
          aria-label="Split concept name"
          placeholder="New distinct concept name"
          value={splitName}
          onChange={(e) => setSplitName(e.target.value)}
        />
        {notes.map((n) => (
          <label className="check-note" key={n.id}>
            <input
              type="checkbox"
              aria-label={`Move note: ${n.text.slice(0, 40)}`}
              checked={moved.includes(n.id)}
              onChange={(e) =>
                setMoved((old) =>
                  e.target.checked
                    ? [...old, n.id]
                    : old.filter((id) => id !== n.id),
                )
              }
            />
            {n.text.slice(0, 100)}
          </label>
        ))}
        <button
          disabled={!moved.length || !splitName.trim()}
          onClick={async () => {
            if (
              await apply((s) => splitConcept(s, concept.id, splitName, moved))
            ) {
              setMoved([]);
              setSplitName("");
            }
          }}
        >
          Split selected notes
        </button>
      </details>
      <h3>Related concepts</h3>
      <div className="chips">
        {state.edges
          .filter(
            (e) =>
              !e.excluded &&
              (e.source === concept.id || e.target === concept.id),
          )
          .map((e) => {
            const c = state.concepts.find(
              (c) => c.id === (e.source === concept.id ? e.target : e.source),
            )!;
            return (
              <button key={e.id} onClick={() => onSelect(c.id)}>
                {c.label}
              </button>
            );
          })}
      </div>
      <h3>Source notes</h3>
      {notes.map((n) => (
        <button className="source-note" key={n.id} onClick={() => onOpen(n)}>
          {n.text}
          <small>{new Date(n.createdAt).toLocaleDateString()}</small>
        </button>
      ))}
    </section>
  );
}
export function RelationPanel({
  state,
  edge,
  apply,
  onOpen,
  onClose,
}: {
  state: GraphState;
  edge: Connection;
  apply: Apply;
  onOpen: (n: Entry) => void;
  onClose: () => void;
}) {
  const a = state.concepts.find((c) => c.id === edge.source)!,
    b = state.concepts.find((c) => c.id === edge.target)!;
  return (
    <section className="inspector" aria-label="Connection evidence">
      <div className="panel-title">
        <h2>
          {a.label} ↔ {b.label}
        </h2>
        <button onClick={onClose}>Close</button>
      </div>
      <p>Co-occurrence, not causation.</p>
      <dl>
        <dt>Supporting notes</dt>
        <dd>{edge.supportCount}</dd>
        <dt>Manually created</dt>
        <dd>{edge.manual ? "Yes" : "No"}</dd>
        <dt>Explicitly excluded</dt>
        <dd>{edge.excluded ? "Yes" : "No"}</dd>
      </dl>
      <button
        onClick={() =>
          void apply((s) =>
            setConnection(s, edge.source, edge.target, {
              excluded: !edge.excluded,
            }),
          )
        }
      >
        {edge.excluded ? "Restore connection" : "Exclude connection"}
      </button>
      {edge.manual && (
        <button
          onClick={() =>
            void apply((s) =>
              setConnection(s, edge.source, edge.target, { manual: false }),
            )
          }
        >
          Remove manual flag
        </button>
      )}
      {!edge.noteIds.length && (
        <p>
          No source notes.{" "}
          {edge.manual
            ? "This connection was created manually."
            : "The explicit exclusion is retained."}
        </p>
      )}
      {edge.noteIds
        .map((id) => state.notes.find((n) => n.id === id))
        .filter((n): n is Entry => !!n)
        .map((n) => (
          <button key={n.id} className="source-note" onClick={() => onOpen(n)}>
            {n.text}
            <small>{new Date(n.createdAt).toLocaleDateString()}</small>
          </button>
        ))}
    </section>
  );
}
function ThemeRow({
  state,
  id,
  apply,
}: {
  state: GraphState;
  id: string;
  apply: Apply;
}) {
  const theme = state.themes.find((t) => t.id === id)!;
  const [name, setName] = useState(theme.name),
    [color, setColor] = useState(theme.color),
    [target, setTarget] = useState("");
  return (
    <article className="theme-row">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void apply((s) => changeTheme(s, id, { name, color }));
        }}
      >
        <input
          aria-label={`Topic name ${theme.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="color"
          aria-label={`Topic color ${theme.name}`}
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <button>Save topic</button>
      </form>
      <select
        aria-label={`Replacement for ${theme.name}`}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">Replacement topic</option>
        {state.themes
          .filter((t) => t.id !== id)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </select>
      <button
        disabled={!target}
        onClick={() => void apply((s) => mergeThemes(s, id, target))}
      >
        Merge topic
      </button>
      <button
        disabled={!target}
        onClick={() => void apply((s) => mergeThemes(s, id, target))}
      >
        Delete topic and reassign
      </button>
    </article>
  );
}
export function ThemeManager({
  state,
  apply,
}: {
  state: GraphState;
  apply: Apply;
}) {
  const [name, setName] = useState(""),
    [color, setColor] = useState("#799b78");
  return (
    <section className="management" aria-label="Topic management">
      <h2>Topics</h2>
      <p>
        Colors belong to a node’s primary topic. Deleting a topic requires a
        replacement; notes and concepts remain.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await apply((s) => {
              if (!normalizeConcept(name))
                throw Error("A topic name is required.");
              if (
                s.themes.some(
                  (t) => normalizeConcept(t.name) === normalizeConcept(name),
                )
              )
                throw Error("That topic already exists.");
              return {
                ...s,
                themes: [
                  ...s.themes,
                  { id: crypto.randomUUID(), name: name.trim(), color },
                ],
              };
            })
          )
            setName("");
        }}
      >
        <input
          aria-label="New topic name"
          placeholder="New topic"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          aria-label="New topic color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <button>Add topic</button>
      </form>
      {state.themes.map((t) => (
        <ThemeRow
          key={`${t.id}:${t.name}:${t.color}`}
          state={state}
          id={t.id}
          apply={apply}
        />
      ))}
    </section>
  );
}
