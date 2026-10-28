export const topics = [
  "Philosophy",
  "Running",
  "Psychology",
  "Literature",
  "Technology",
  "Everyday",
  "Reflection",
] as const;
export type Topic = (typeof topics)[number];
export const colors: Record<Topic, string> = {
  Philosophy: "#bb9863",
  Running: "#7d9c76",
  Psychology: "#ae88a7",
  Literature: "#8299ba",
  Technology: "#6b9f9f",
  Everyday: "#d49b7c",
  Reflection: "#b7ac78",
};
export interface Entry {
  id: string;
  createdAt: string;
  updatedAt: string;
  text: string;
  primaryTopic: Topic;
  tags: string[];
  keywords: string[];
  related: { id: string; strength: number }[];
  coordinates: [number, number, number];
  archived: boolean;
  demo: boolean;
  manualRelated?: { id: string; strength: number }[];
}
export interface SemanticEngine {
  classify(text: string): Topic;
  keywords(text: string): string[];
  similarity(a: Entry, b: Entry): number;
  relationships(entry: Entry, others: Entry[]): Entry["related"];
}
const lexicon: Record<Topic, string[]> = {
  Philosophy: ["meaning", "time", "exist", "freedom", "question", "life"],
  Running: ["run", "running", "body", "breath", "pace", "miles"],
  Psychology: ["mind", "habit", "attention", "memory", "feeling", "anxiety"],
  Literature: ["book", "read", "poem", "story", "words", "write"],
  Technology: ["code", "machine", "design", "digital", "technology", "system"],
  Everyday: ["coffee", "rain", "street", "window", "morning", "light"],
  Reflection: ["myself", "remember", "gratitude", "friend", "change", "quiet"],
};
export const semantic: SemanticEngine = {
  classify(text) {
    const words = text.toLowerCase();
    return [...topics].sort(
      (a, b) =>
        lexicon[b].filter((w) => words.includes(w)).length -
        lexicon[a].filter((w) => words.includes(w)).length,
    )[0];
  },
  keywords(text) {
    return [...new Set(text.toLowerCase().match(/[a-z]{4,}/g) || [])]
      .filter(
        (w) =>
          ![
            "that",
            "this",
            "with",
            "from",
            "have",
            "were",
            "there",
            "about",
            "into",
            "what",
          ].includes(w),
      )
      .slice(0, 18);
  },
  similarity(a, b) {
    const shared = a.keywords.filter((w) => b.keywords.includes(w)).length;
    const tags = a.tags.filter((t) => b.tags.includes(t)).length;
    return Math.min(
      1,
      shared / Math.max(3, Math.min(a.keywords.length, b.keywords.length)) +
        tags * 0.22,
    );
  },
  relationships(entry, others) {
    return others
      .filter((e) => e.id !== entry.id && e.demo === entry.demo && !e.archived)
      .map((e) => ({ id: e.id, strength: this.similarity(entry, e) }))
      .filter((r) => r.strength > 0.12)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 4);
  },
};
export function position(id: string, topic: Topic): Entry["coordinates"] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const i = topics.indexOf(topic);
  const phi = i * 2.39996 + (h % 100) / 200;
  const y = 0.78 - i * 0.25 + ((h >> 8) % 100) / 500;
  const r = Math.sqrt(Math.max(0.1, 1 - y * y));
  return [3 * r * Math.cos(phi), 3 * y, 3 * r * Math.sin(phi)];
}
export function makeEntry(
  text: string,
  topic: Topic = semantic.classify(text),
  tags: string[] = [],
  existing?: Entry,
): Entry {
  const id = existing?.id ?? crypto.randomUUID();
  return {
    ...existing,
    id,
    text,
    primaryTopic: topic,
    tags,
    keywords: semantic.keywords(text),
    related: existing?.related ?? [],
    coordinates: existing?.coordinates ?? position(id, topic),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: existing?.archived ?? false,
    demo: existing?.demo ?? false,
  };
}
export function connect(entries: Entry[]): Entry[] {
  return entries.map((e) => ({
    ...e,
    related: e.manualRelated ?? semantic.relationships(e, entries),
  }));
}
