import { openDB, type IDBPDatabase } from "idb";
import type { Entry } from "./model";
import {
  migrateGraph,
  assignKeywords,
  rebuild,
  type GraphState,
} from "./graph";
const graphStores = ["entries", "concepts", "themes", "edges", "settings"];
export function createStorage(name = "spatial-journal") {
  let connection: Promise<IDBPDatabase> | undefined;
  const db = () =>
    (connection ??= openDB(name, 2, {
      upgrade(database, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          database.createObjectStore("entries", { keyPath: "id" });
          database.createObjectStore("settings");
        }
        for (const store of ["concepts", "themes", "edges"])
          database.createObjectStore(store, { keyPath: "id" });
        // Runs in the version-change transaction: failure rolls back the complete upgrade.
        void tx
          .objectStore("entries")
          .getAll()
          .then((notes: Entry[]) => {
            const graph = migrateGraph(notes);
            if (oldVersion === 1)
              void tx
                .objectStore("settings")
                .put(notes, "migration:v1:entries");
            for (const [store, records] of [
              ["entries", graph.notes],
              ["concepts", graph.concepts],
              ["themes", graph.themes],
              ["edges", graph.edges],
            ] as const)
              for (const record of records)
                void tx.objectStore(store).put(record);
            void tx.objectStore("settings").put(2, "graphSchema");
          })
          .catch(() => tx.abort());
      },
      blocking() {
        void connection?.then((c) => c.close());
        connection = undefined;
      },
    }));
  return {
    async saveGraph(graph: GraphState, settings: Record<string, unknown> = {}) {
      const d = await db(),
        tx = d.transaction(graphStores, "readwrite");
      const requests: Promise<unknown>[] = [];
      try {
        for (const [store, records] of [
          ["entries", graph.notes],
          ["concepts", graph.concepts],
          ["themes", graph.themes],
          ["edges", graph.edges],
        ] as const) {
          requests.push(tx.objectStore(store).clear());
          for (const record of records)
            requests.push(tx.objectStore(store).put(record));
        }
        for (const [key, value] of Object.entries(settings))
          requests.push(tx.objectStore("settings").put(value, key));
        // Queue in order, then wait once: avoid thousands of serial request round-trips.
        await Promise.all([...requests, tx.done]);
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* It may already have aborted. */
        }
        await Promise.allSettled([...requests, tx.done]);
        throw error;
      }
    },
    async loadGraph(): Promise<GraphState> {
      const d = await db(),
        tx = d.transaction(graphStores, "readonly");
      const [notes, concepts, themes, edges] = await Promise.all(
        ["entries", "concepts", "themes", "edges"].map((store) =>
          tx.objectStore(store).getAll(),
        ),
      );
      await tx.done;
      const graph = migrateGraph(notes, { concepts, themes, edges });
      if (notes.some((n) => !n.conceptIds)) await this.saveGraph(graph);
      return graph;
    },
    async replace(entries: Entry[], settings: Record<string, unknown> = {}) {
      const graph = await this.loadGraph();
      await this.saveGraph(migrateGraph(entries, graph), settings);
    },
    async entries(): Promise<Entry[]> {
      return (await db()).getAll("entries");
    },
    async put(entry: Entry) {
      const graph = await this.loadGraph();
      await this.saveGraph(assignKeywords(graph, entry, entry.keywords));
    },
    async remove(id: string) {
      const graph = await this.loadGraph();
      await this.saveGraph(
        rebuild({ ...graph, notes: graph.notes.filter((n) => n.id !== id) }),
      );
    },
    async setting<T>(key: string): Promise<T | undefined> {
      return (await db()).get("settings", key);
    },
    async set(key: string, value: unknown) {
      return (await db()).put("settings", value, key);
    },
    async seed(entries: Entry[]) {
      const d = await db(),
        tx = d.transaction(["entries", "settings"], "readwrite");
      if (!(await tx.objectStore("settings").get("seeded"))) {
        for (const e of entries) await tx.objectStore("entries").put(e);
        await tx.objectStore("settings").put(true, "seeded");
      }
      await tx.done;
    },
    async close() {
      (await connection)?.close();
      connection = undefined;
    },
  };
}
export const storage = createStorage();
