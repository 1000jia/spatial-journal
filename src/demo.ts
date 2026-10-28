import { connect, makeEntry, position, type Topic } from "./model";
const notes: [Topic, string, string[]][] = [
  [
    "Philosophy",
    "Perhaps a good life is not a question we answer once. It is a question we learn to ask more carefully.",
    ["meaning", "life"],
  ],
  [
    "Running",
    "Six quiet miles by the river. After the third mile my breath settled, and the world became a little less complicated.",
    ["body", "quiet"],
  ],
  [
    "Literature",
    "A line in my book stayed with me all morning: we read to discover the words for things we already feel.",
    ["words", "feeling"],
  ],
  [
    "Psychology",
    "Attention is a small act of love. What happens when I give the ordinary things my whole attention?",
    ["attention", "life"],
  ],
  [
    "Technology",
    "Good design leaves room for a person to think. I want to build digital spaces that feel more like gardens than machines.",
    ["design", "attention"],
  ],
  [
    "Everyday",
    "Rain on the café window. Two strangers sharing an umbrella. The city has its own small language of kindness.",
    ["rain", "life"],
  ],
  [
    "Reflection",
    "I called an old friend without a reason. Maybe staying close is made of these tiny, unremarkable choices.",
    ["friend", "meaning"],
  ],
  [
    "Running",
    "Running slowly taught me something about patience. Progress can be happening even when the pace feels almost still.",
    ["body", "habit"],
  ],
  [
    "Philosophy",
    "Time feels different when I stop measuring it. An hour in a book and an hour waiting are different kinds of existence.",
    ["time", "words"],
  ],
  [
    "Psychology",
    "My morning habit of reaching for the phone is really a search for novelty. Today I tried the window instead.",
    ["habit", "attention"],
  ],
  [
    "Literature",
    "The poem did not explain the feeling. It gave the feeling somewhere to live. I want to write with that kind of space.",
    ["words", "feeling"],
  ],
  [
    "Technology",
    "A system should help us remember without deciding what matters. Memory is more than a searchable database.",
    ["memory", "design"],
  ],
  [
    "Everyday",
    "The coffee was too hot, so I waited. For once, waiting felt like part of the morning rather than an interruption.",
    ["time", "quiet"],
  ],
  [
    "Reflection",
    "I used to think change would arrive loudly. Now I notice it in the things that no longer make me anxious.",
    ["change", "feeling"],
  ],
  [
    "Running",
    "The body remembers the trail. My feet found a rhythm before my mind stopped making lists.",
    ["body", "memory"],
  ],
  [
    "Philosophy",
    "Freedom might mean choosing which limits to accept. A blank page becomes a story only after the first word.",
    ["words", "meaning"],
  ],
  [
    "Psychology",
    "Naming a feeling makes it less like weather and more like a visitor. Anxiety came today; it did not have to stay.",
    ["feeling", "attention"],
  ],
  [
    "Literature",
    "Rereading a favourite story is a conversation with an earlier version of myself. The book stays; the reader changes.",
    ["memory", "change"],
  ],
  [
    "Technology",
    "Learning to code is learning to ask smaller questions. A difficult problem becomes a path when I can see the next step.",
    ["design", "habit"],
  ],
  [
    "Everyday",
    "Late afternoon light on the kitchen wall. Nothing special happened today, and I am grateful I was here to see it.",
    ["quiet", "attention"],
  ],
];
export const demoEntries = connect(
  notes.map(([topic, text, tags], i) => {
    const e = makeEntry(text, topic, tags);
    const id = `demo-${i}`;
    return {
      ...e,
      id,
      demo: true,
      keywords: [...tags], // Curated fictional concepts; existing stored notes are never overwritten.
      createdAt: new Date(Date.UTC(2026, 9, 4 + i, 9 + (i % 8))).toISOString(),
      coordinates: position(id, topic),
    };
  }),
);
