import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { storage, createStorage } from "./storage";
import { makeEntry } from "./model";
import { openDB } from "idb";
import { migrateGraph } from "./graph";
describe("IndexedDB persistence", () => {
  it("persists, edits, reloads and removes a note", async () => {
    const e = makeEntry("A private thought");
    await storage.put(e);
    expect(await storage.entries()).toEqual(
      expect.arrayContaining([expect.objectContaining(e)]),
    );
    const edited = makeEntry("Updated private thought", "Reflection", [], e);
    await storage.put(edited);
    expect((await storage.entries()).find((n) => n.id === e.id)?.text).toBe(
      "Updated private thought",
    );
    await storage.remove(e.id);
    expect((await storage.entries()).some((n) => n.id === e.id)).toBe(false);
  });
  it("seeds only once and keeps draft state", async () => {
    const e = { ...makeEntry("fiction"), demo: true };
    await storage.seed([e]);
    await storage.remove(e.id);
    await storage.seed([e]);
    expect((await storage.entries()).some((n) => n.id === e.id)).toBe(false);
    await storage.set("draft", { text: "unfinished" });
    expect(await storage.setting("draft")).toEqual({ text: "unfinished" });
  });
  it("atomically persists submission and undo metadata across reads", async () => {
    const saved = makeEntry("A submitted thought");
    await storage.replace([saved], {
      undo: { saved, previous: null },
      draft: null,
    });
    expect(await storage.entries()).toMatchObject([saved]);
    expect(await storage.setting("undo")).toEqual({ saved, previous: null });
    await storage.replace([], { undo: null, draft: { text: saved.text } });
    expect(await storage.entries()).toEqual([]);
    expect(await storage.setting("draft")).toEqual({ text: saved.text });
    expect(await storage.setting("undo")).toBeNull();
  });
});

describe("version-one database migration", () => {
  it("preserves original IDs, text, timestamps, draft, undo and legacy relationships, then reopens idempotently", async () => {
    const name = "migration-" + crypto.randomUUID(),
      old = await openDB(name, 1, {
        upgrade(d) {
          d.createObjectStore("entries", { keyPath: "id" });
          d.createObjectStore("settings");
        },
      });
    const note = {
      ...makeEntry("旧笔记：跑步与心理健康。"),
      keywords: ["跑步", "心理健康"],
      related: [{ id: "old-related", strength: 0.7 }],
    };
    await old.put("entries", note);
    await old.put("settings", { text: "旧草稿" }, "draft");
    await old.put("settings", { saved: note }, "undo");
    await old.put("settings", true, "seeded");
    old.close();
    const upgraded = createStorage(name);
    const graph = await upgraded.loadGraph();
    expect(graph.notes[0]).toMatchObject(note);
    expect(graph.notes[0].conceptIds).toHaveLength(2);
    expect(graph.edges[0].noteIds).toEqual([note.id]);
    expect(await upgraded.setting("draft")).toEqual({ text: "旧草稿" });
    expect(await upgraded.setting("undo")).toEqual({ saved: note });
    expect(await upgraded.setting("migration:v1:entries")).toEqual([note]);
    await upgraded.close();
    const reopened = createStorage(name);
    expect(await reopened.loadGraph()).toEqual(graph);
    expect(await reopened.setting("graphSchema")).toBe(2);
    await reopened.close();
  });
  it("rolls back all stores if saving a graph fails after clearing a store", async () => {
    const store = createStorage("atomic-" + crypto.randomUUID());
    const graph = migrateGraph([makeEntry("an original memory")]);
    await store.saveGraph(graph, { draft: { text: "safe" } });
    const baseline = await store.loadGraph();
    const invalid = structuredClone(graph);
    (invalid.concepts[0] as { id?: string }).id = undefined;
    await expect(
      store.saveGraph(invalid, { draft: { text: "lost" } }),
    ).rejects.toThrow();
    expect(await store.loadGraph()).toEqual(baseline);
    expect(await store.setting("draft")).toEqual({ text: "safe" });
    await store.close();
  });
});
