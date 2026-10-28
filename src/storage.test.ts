import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { storage } from "./storage";
import { makeEntry } from "./model";
describe("IndexedDB persistence", () => {
  it("persists, edits, reloads and removes a note", async () => {
    const e = makeEntry("A private thought");
    await storage.put(e);
    expect(await storage.entries()).toContainEqual(e);
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
    expect(await storage.entries()).toEqual([saved]);
    expect(await storage.setting("undo")).toEqual({ saved, previous: null });
    await storage.replace([], { undo: null, draft: { text: saved.text } });
    expect(await storage.entries()).toEqual([]);
    expect(await storage.setting("draft")).toEqual({ text: saved.text });
    expect(await storage.setting("undo")).toBeNull();
  });
});
