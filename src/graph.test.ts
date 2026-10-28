import { describe, it, expect } from "vitest";
import { makeEntry, type Entry } from "./model";
import { extractKeywords, canonicalConcept } from "./keywords";
import {
  migrateGraph,
  assignKeywords,
  rebuild,
  mergeConcepts,
  splitConcept,
  deleteConcept,
  renameConcept,
  setConnection,
  changeTheme,
  mergeThemes,
  neighborhood,
  type GraphState,
} from "./graph";
const note = (text: string, words: string[], demo = false): Entry => ({
  ...makeEntry(text, "Reflection"),
  keywords: words,
  demo,
});
const concept = (s: GraphState, label: string) =>
  s.concepts.find((c) => c.label === label)!;
describe("concept extraction and explainable graph", () => {
  it("extracts local English phrases and Chinese concepts, with conservative canonicalization", () => {
    expect(
      extractKeywords(
        "Machine learning and mental health. Running running running.",
      ),
    ).toEqual(
      expect.arrayContaining(["machine learning", "mental health", "running"]),
    );
    expect(
      extractKeywords("跑步帮助我改善心理健康，也让我思考人工智能和知识图谱。"),
    ).toEqual(
      expect.arrayContaining(["跑步", "心理健康", "人工智能", "知识图谱"]),
    );
    expect(canonicalConcept(" Ｍｅｎｔａｌ　Health ")).toBe("mental health");
    expect(canonicalConcept("runs")).toBe(canonicalConcept("running"));
    expect(extractKeywords("the and it is a")).toEqual([]);
  });
  it("shares one node per canonical concept within a dataset and records exact distinct supporting notes", () => {
    const a = note("first", ["Run", "memory", "memory"]),
      b = note("second", ["running", "memory"]),
      demo = note("fiction", ["running", "memory"], true);
    const s = migrateGraph([a, b, demo]);
    expect(s.concepts.filter((c) => !c.demo)).toHaveLength(2);
    const edge = s.edges.find((e) => e.noteIds.includes(a.id))!;
    expect(new Set(edge.noteIds)).toEqual(new Set([a.id, b.id]));
    expect(edge.supportCount).toBe(2);
    expect(edge.manual).toBe(false);
    expect(s.edges.find((e) => e.noteIds.includes(demo.id))?.supportCount).toBe(
      1,
    );
    expect(s.edges).toHaveLength(2);
  });
  it("does not infer edges from topic alone and replaces evidence on edited notes", () => {
    const a = note("first", ["apple"]),
      b = note("second", ["ocean"]);
    let s = migrateGraph([a, b]);
    expect(s.edges).toEqual([]);
    s = assignKeywords(s, a, ["apple", "ocean"]);
    expect(s.edges[0].noteIds).toEqual([a.id]);
    s = assignKeywords(s, a, ["apple"]);
    expect(s.edges).toEqual([]);
    s = rebuild({
      ...s,
      notes: s.notes.map((n) => ({ ...n, archived: true })),
    });
    expect(s.edges).toEqual([]);
  });
  it("retains explicit exclusions despite new evidence and distinguishes manual-only edges", () => {
    const a = note("first", ["alpha", "beta"]);
    let s = migrateGraph([a]);
    const x = concept(s, "alpha").id,
      y = concept(s, "beta").id;
    s = setConnection(s, x, y, { excluded: true });
    s = assignKeywords(s, note("second", []), ["alpha", "beta"]);
    expect(s.edges[0].excluded).toBe(true);
    expect(s.edges[0].supportCount).toBe(2);
    expect(neighborhood(s, x, 1)).toEqual(new Set([x]));
    const originals = [...s.notes];
    s = assignKeywords(s, originals[0], ["alpha"]);
    s = assignKeywords(s, originals[1], ["beta"]);
    s = setConnection(s, x, y, { manual: true, excluded: false });
    expect(s.edges[0]).toMatchObject({
      manual: true,
      excluded: false,
      supportCount: 0,
      noteIds: [],
    });
    s = setConnection(s, x, y, { manual: false });
    expect(s.edges).toEqual([]);
  });
  it("merges identities, aliases, provenance and exclusion policies without self-edges", () => {
    let s = migrateGraph([
      note("first", ["alpha", "beta", "gamma"]),
      note("second", ["beta", "gamma"]),
    ]);
    const a = concept(s, "alpha").id,
      b = concept(s, "beta").id,
      c = concept(s, "gamma").id;
    s = setConnection(s, a, c, { manual: true, excluded: true });
    s = mergeConcepts(s, a, b);
    expect(s.concepts.some((n) => n.id === a)).toBe(false);
    expect(s.concepts.find((n) => n.id === b)?.aliases).toContain("alpha");
    expect(s.edges).toHaveLength(1);
    expect(s.edges[0]).toMatchObject({
      supportCount: 2,
      manual: true,
      excluded: true,
    });
    expect(s.notes.every((n) => !n.conceptIds?.includes(a))).toBe(true);
    s = assignKeywords(s, note("third", []), ["alpha"]);
    expect(s.notes.at(-1)?.conceptIds).toEqual([b]);
  });
  it("splits selected note references, renames without losing IDs and deletes without deleting source text", () => {
    const a = note("keep original text", ["focus", "rest"]),
      b = note("another text", ["focus", "rest"]);
    let s = migrateGraph([a, b]);
    const id = concept(s, "focus").id;
    s = splitConcept(s, id, "deep work", [a.id]);
    const child = concept(s, "deep work").id;
    expect(s.notes.find((n) => n.id === a.id)?.conceptIds).toContain(child);
    expect(s.notes.find((n) => n.id === b.id)?.conceptIds).toContain(id);
    s = renameConcept(s, child, "concentration");
    expect(concept(s, "concentration").id).toBe(child);
    expect(() => renameConcept(s, child, "focus")).toThrow(/already exists/);
    s = deleteConcept(s, child);
    expect(s.notes.find((n) => n.id === a.id)?.text).toBe(a.text);
    expect(s.edges.some((e) => e.source === child || e.target === child)).toBe(
      false,
    );
    expect(() => splitConcept(s, id, "focus", [b.id])).toThrow(/distinct/);
  });
  it("renames and merges themes without dangling references", () => {
    let s = migrateGraph([note("first", ["alpha", "beta"])]);
    const old = s.concepts[0].topicId,
      target = s.themes.find((t) => t.id !== old)!.id;
    s = changeTheme(s, old, { name: "Personal insights", color: "#123456" });
    expect(s.themes.find((t) => t.id === old)?.color).toBe("#123456");
    s = mergeThemes(s, old, target);
    expect(s.concepts.every((c) => c.topicId === target)).toBe(true);
    expect(s.notes[0].topicId).toBe(target);
    expect(s.themes.some((t) => t.id === old)).toBe(false);
  });
  it("computes one-hop/two-hop/full focus and blocks excluded paths", () => {
    let s = migrateGraph([
      note("ab", ["a", "b"]),
      note("bc", ["b", "c"]),
      note("cd", ["c", "d"]),
    ]);
    const [a, b, c, d] = ["a", "b", "c", "d"].map((k) => concept(s, k).id);
    expect(neighborhood(s, a, 1)).toEqual(new Set([a, b]));
    expect(neighborhood(s, a, 2)).toEqual(new Set([a, b, c]));
    expect(neighborhood(s, a, Infinity)).toEqual(new Set([a, b, c, d]));
    s = setConnection(s, b, c, { excluded: true });
    expect(neighborhood(s, a, 2)).toEqual(new Set([a, b]));
  });
});
