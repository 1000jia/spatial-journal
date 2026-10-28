import { describe, it, expect } from "vitest";
import { makeEntry, semantic, connect, position } from "./model";
import { demoEntries } from "./demo";
describe("semantic journal model", () => {
  it("classifies running and preserves manual corrections and identity", () => {
    expect(semantic.classify("Running miles with steady breath and pace")).toBe(
      "Running",
    );
    const a = makeEntry("Running miles", "Literature", ["body"]);
    const b = makeEntry("A revised thought", "Psychology", [], a);
    expect(b.id).toBe(a.id);
    expect(b.createdAt).toBe(a.createdAt);
    expect(b.primaryTopic).toBe("Psychology");
    expect(b.coordinates).toEqual(a.coordinates);
  });
  it("does not connect entries just because their category matches", () => {
    const a = makeEntry("apple orchard", "Philosophy");
    const b = makeEntry("ocean coral", "Philosophy");
    expect(connect([a, b])[0].related).toHaveLength(0);
  });
  it("weights shared words and tags and isolates demo data", () => {
    const a = makeEntry("running body breath", "Running", ["body"]);
    const b = makeEntry("running body pace", "Running", ["body"]);
    const c = { ...b, id: "demo", demo: true };
    expect(semantic.similarity(a, b)).toBeGreaterThan(0.5);
    expect(connect([a, b, c])[0].related.map((r) => r.id)).toEqual([b.id]);
  });
  it("seeds twenty fictional entries across weeks with stable positions", () => {
    expect(demoEntries).toHaveLength(20);
    expect(demoEntries.every((e) => e.demo)).toBe(true);
    expect(position("fixed", "Running")).toEqual(position("fixed", "Running"));
    expect(new Set(demoEntries.map((e) => e.createdAt.slice(0, 10))).size).toBe(
      20,
    );
  });
});
