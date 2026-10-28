import { openDB } from "idb";
import type { Entry } from "./model";
const db = () =>
  openDB("spatial-journal", 1, {
    upgrade(db) {
      db.createObjectStore("entries", { keyPath: "id" });
      db.createObjectStore("settings");
    },
  });
export const storage = {
  async replace(entries: Entry[], settings: Record<string, unknown> = {}) {
    const d = await db();
    const tx = d.transaction(["entries", "settings"], "readwrite");
    await tx.objectStore("entries").clear();
    for (const entry of entries) await tx.objectStore("entries").put(entry);
    for (const [key, value] of Object.entries(settings))
      await tx.objectStore("settings").put(value, key);
    await tx.done;
  },
  async entries(): Promise<Entry[]> {
    return (await db()).getAll("entries");
  },
  async put(entry: Entry) {
    return (await db()).put("entries", entry);
  },
  async remove(id: string) {
    return (await db()).delete("entries", id);
  },
  async setting<T>(key: string): Promise<T | undefined> {
    return (await db()).get("settings", key);
  },
  async set(key: string, value: unknown) {
    return (await db()).put("settings", value, key);
  },
  async seed(entries: Entry[]) {
    const d = await db();
    const tx = d.transaction(["entries", "settings"], "readwrite");
    if (!(await tx.objectStore("settings").get("seeded"))) {
      for (const e of entries) await tx.objectStore("entries").put(e);
      await tx.objectStore("settings").put(true, "seeded");
    }
    await tx.done;
  },
};
