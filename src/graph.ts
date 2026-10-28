import { colors, topics, type Entry } from "./model";
import {
  canonicalConcept,
  normalizeConcept,
  extractKeywords,
} from "./keywords";
export interface Concept {
  id: string;
  label: string;
  aliases: string[];
  topicId: string;
  demo: boolean;
  x: number;
  y: number;
}
export interface Theme {
  id: string;
  name: string;
  color: string;
}
export interface Connection {
  id: string;
  source: string;
  target: string;
  noteIds: string[];
  supportCount: number;
  manual: boolean;
  excluded: boolean;
}
export interface GraphState {
  notes: Entry[];
  concepts: Concept[];
  themes: Theme[];
  edges: Connection[];
}
export const fallbackTheme = "theme:reflection";
export const initialThemes = (): Theme[] =>
  topics.map((name) => ({
    id: "theme:" + name.toLowerCase(),
    name,
    color: colors[name],
  }));
export const pairId = (a: string, b: string) => [a, b].sort().join("~");
const unique = <T>(values: T[]) => [...new Set(values)];
export function rebuild(state: GraphState): GraphState {
  const nodes = new Map(state.concepts.map((c) => [c.id, c]));
  const edges = new Map<string, Connection>();
  for (const old of state.edges) {
    if (
      old.source === old.target ||
      !nodes.has(old.source) ||
      !nodes.has(old.target) ||
      nodes.get(old.source)!.demo !== nodes.get(old.target)!.demo
    )
      continue;
    if (old.manual || old.excluded)
      edges.set(pairId(old.source, old.target), {
        ...old,
        id: pairId(old.source, old.target),
        noteIds: [],
        supportCount: 0,
      });
  }
  const notes = state.notes.map((n) => ({
    ...n,
    conceptIds: unique(n.conceptIds ?? []).filter(
      (id) => nodes.has(id) && nodes.get(id)!.demo === n.demo,
    ),
  }));
  for (const note of notes.filter((n) => !n.archived)) {
    const ids = note.conceptIds!;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const id = pairId(ids[i], ids[j]);
        const edge = edges.get(id) ?? {
          id,
          source: [ids[i], ids[j]].sort()[0],
          target: [ids[i], ids[j]].sort()[1],
          noteIds: [],
          supportCount: 0,
          manual: false,
          excluded: false,
        };
        edge.noteIds.push(note.id);
        edge.supportCount = edge.noteIds.length;
        edges.set(id, edge);
      }
  }
  return { ...state, notes, edges: [...edges.values()] };
}
export function addConcept(
  state: GraphState,
  label: string,
  topicId: string,
  demo: boolean,
): Concept {
  if (!state.themes.some((t) => t.id === topicId)) topicId = state.themes[0].id;
  const clean = label.trim().replace(/\s+/g, " ");
  const key = canonicalConcept(clean);
  if (!key) throw Error("A concept name is required.");
  const found = state.concepts.find(
    (c) =>
      c.demo === demo &&
      [c.label, ...c.aliases].some((a) => canonicalConcept(a) === key),
  );
  if (found) return found;
  const id = crypto.randomUUID();
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const angle = (hash % 6283) / 1000,
    radius = 80 + ((hash >>> 8) % 240);
  const concept = {
    id,
    label: clean,
    aliases: [],
    topicId,
    demo,
    x: 500 + Math.cos(angle) * radius,
    y: 300 + Math.sin(angle) * radius * 0.65,
  };
  state.concepts.push(concept);
  return concept;
}
/** Idempotent: preserve original fields and only fill missing graph references. */
export function migrateGraph(
  notes: Entry[],
  existing?: Omit<GraphState, "notes">,
): GraphState {
  const state: GraphState = {
    notes: structuredClone(notes),
    concepts: structuredClone(existing?.concepts ?? []),
    themes: structuredClone(existing?.themes ?? initialThemes()),
    edges: structuredClone(existing?.edges ?? []),
  };
  if (!state.themes.length) state.themes = initialThemes();
  for (const note of state.notes) {
    note.topicId ??=
      state.themes.find((t) => t.name === note.primaryTopic)?.id ??
      state.themes[0].id;
    if (!note.conceptIds) {
      const keywords = unique([
        ...(note.keywords?.length ? note.keywords : extractKeywords(note.text)),
        ...(note.tags ?? []),
      ]);
      note.conceptIds = unique(
        keywords.map(
          (label) => addConcept(state, label, note.topicId!, note.demo).id,
        ),
      );
    }
  }
  return rebuild(state);
}
export function assignKeywords(
  state: GraphState,
  note: Entry,
  labels: string[],
): GraphState {
  const next = structuredClone(state);
  const updated = {
    ...note,
    keywords: unique(labels.map((s) => s.trim()).filter(Boolean)),
  };
  updated.topicId = next.themes.some((t) => t.id === note.topicId)
    ? note.topicId
    : (next.themes.find((t) => t.name === note.primaryTopic)?.id ??
      next.themes[0].id);
  updated.conceptIds = unique(
    updated.keywords.map(
      (label) => addConcept(next, label, updated.topicId!, note.demo).id,
    ),
  );
  next.notes = [...next.notes.filter((n) => n.id !== note.id), updated];
  return rebuild(next);
}
export function renameConcept(
  state: GraphState,
  id: string,
  label: string,
): GraphState {
  const next = structuredClone(state),
    c = next.concepts.find((c) => c.id === id)!;
  if (!canonicalConcept(label)) throw Error("A concept name is required.");
  if (
    next.concepts.some(
      (other) =>
        other.id !== id &&
        other.demo === c.demo &&
        [other.label, ...other.aliases].some(
          (a) => canonicalConcept(a) === canonicalConcept(label),
        ),
    )
  )
    throw Error("That concept already exists. Use Merge instead.");
  c.aliases = unique([...c.aliases, c.label]);
  c.label = label.trim();
  return next;
}
export function deleteConcept(state: GraphState, id: string): GraphState {
  return rebuild({
    ...state,
    concepts: state.concepts.filter((c) => c.id !== id),
  });
}
export function mergeConcepts(
  state: GraphState,
  source: string,
  target: string,
): GraphState {
  const next = structuredClone(state),
    a = next.concepts.find((c) => c.id === source),
    b = next.concepts.find((c) => c.id === target);
  if (!a || !b || source === target || a.demo !== b.demo)
    throw Error("Choose two different concepts in the same journal.");
  b.aliases = unique([...b.aliases, a.label, ...a.aliases]);
  next.notes = next.notes.map((n) => ({
    ...n,
    conceptIds: unique(
      (n.conceptIds ?? []).map((id) => (id === source ? target : id)),
    ),
  }));
  const policies = new Map<string, Connection>();
  for (const e of next.edges) {
    const sourceId = e.source === source ? target : e.source,
      targetId = e.target === source ? target : e.target;
    if (sourceId === targetId) continue;
    const id = pairId(sourceId, targetId),
      prior = policies.get(id);
    policies.set(id, {
      ...e,
      id,
      source: sourceId,
      target: targetId,
      manual: e.manual || !!prior?.manual,
      excluded: e.excluded || !!prior?.excluded,
    });
  }
  next.edges = [...policies.values()];
  next.concepts = next.concepts.filter((c) => c.id !== source);
  return rebuild(next);
}
export function splitConcept(
  state: GraphState,
  id: string,
  label: string,
  noteIds: string[],
): GraphState {
  const next = structuredClone(state),
    original = next.concepts.find((c) => c.id === id)!;
  const linked = next.notes.filter((n) => n.conceptIds?.includes(id));
  if (!noteIds.length || noteIds.some((id) => !linked.some((n) => n.id === id)))
    throw Error("Select at least one supporting note to move.");
  const c = addConcept(next, label, original.topicId, original.demo);
  if (state.concepts.some((n) => n.id === c.id))
    throw Error("Use a new, distinct name for the split concept.");
  next.notes = next.notes.map((n) =>
    noteIds.includes(n.id)
      ? {
          ...n,
          conceptIds: (n.conceptIds ?? []).map((old) =>
            old === id ? c.id : old,
          ),
        }
      : n,
  );
  return rebuild(next);
}
export function setConnection(
  state: GraphState,
  source: string,
  target: string,
  policy: { manual?: boolean; excluded?: boolean },
): GraphState {
  if (
    source === target ||
    !state.concepts.some((c) => c.id === source) ||
    !state.concepts.some((c) => c.id === target) ||
    state.concepts.find((c) => c.id === source)!.demo !==
      state.concepts.find((c) => c.id === target)!.demo
  )
    throw Error("Choose two different concepts in the same journal.");
  const next = structuredClone(state),
    id = pairId(source, target),
    edge = next.edges.find((e) => e.id === id);
  if (edge) Object.assign(edge, policy);
  else
    next.edges.push({
      id,
      source,
      target,
      noteIds: [],
      supportCount: 0,
      manual: false,
      excluded: false,
      ...policy,
    });
  return rebuild(next);
}
export function changeTheme(
  state: GraphState,
  id: string,
  patch: Partial<Pick<Theme, "name" | "color">>,
): GraphState {
  const next = structuredClone(state),
    theme = next.themes.find((t) => t.id === id)!;
  if (patch.name !== undefined) {
    if (!normalizeConcept(patch.name)) throw Error("A topic name is required.");
    if (
      next.themes.some(
        (t) =>
          t.id !== id &&
          normalizeConcept(t.name) === normalizeConcept(patch.name!),
      )
    )
      throw Error("That topic exists. Use Merge instead.");
    patch.name = patch.name.trim();
  }
  Object.assign(theme, patch);
  return next;
}
export function mergeThemes(
  state: GraphState,
  source: string,
  target: string,
): GraphState {
  if (source === target || !state.themes.some((t) => t.id === target))
    throw Error("Choose a different replacement topic.");
  return {
    ...state,
    themes: state.themes.filter((t) => t.id !== source),
    concepts: state.concepts.map((c) =>
      c.topicId === source ? { ...c, topicId: target } : c,
    ),
    notes: state.notes.map((n) =>
      n.topicId === source ? { ...n, topicId: target } : n,
    ),
  };
}
export function neighborhood(
  state: Pick<GraphState, "concepts" | "edges">,
  selected: string | null,
  hops: number,
): Set<string> {
  if (!selected || !Number.isFinite(hops))
    return new Set(state.concepts.map((c) => c.id));
  const seen = new Set([selected]);
  let frontier = [selected];
  for (let i = 0; i < hops; i++) {
    const next: string[] = [];
    for (const e of state.edges.filter((e) => !e.excluded)) {
      if (frontier.includes(e.source) && !seen.has(e.target)) {
        seen.add(e.target);
        next.push(e.target);
      }
      if (frontier.includes(e.target) && !seen.has(e.source)) {
        seen.add(e.source);
        next.push(e.source);
      }
    }
    frontier = next;
  }
  return seen;
}
