/** Local, deterministic suggestions; users remain the authority on concepts. */
export const normalizeConcept = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[\p{P}\p{Z}\s]+/gu, " ")
    .trim();
const aliases: Record<string, string> = {
  running: "running",
  runs: "running",
  run: "running",
  books: "book",
  memories: "memory",
  technologies: "technology",
  thoughts: "thought",
};
export const canonicalConcept = (value: string) =>
  aliases[normalizeConcept(value)] ?? normalizeConcept(value);
const stop = new Set(
  `a an the and or but if then in on at to of for from with without into after before between by is are was were be been being it its this that these those i me my myself we our you your he she they their them us as not no can could should would will have has had do does did when what which who how why than so too very more most less little once already all some any each every while even through about over under again also only just perhaps good things thing find helped helped me became make makes made much many one two three whole after during up down out ask give feel feels feeling feel like`.split(
    /\s+/,
  ),
);
const phrases = [
  "mental health",
  "machine learning",
  "artificial intelligence",
  "personal growth",
  "free will",
  "critical thinking",
  "knowledge graph",
  "physical exercise",
  "心理健康",
  "人工智能",
  "机器学习",
  "知识图谱",
  "个人成长",
  "自我反思",
  "自由意志",
  "注意力",
  "哲学",
  "跑步",
  "运动",
  "焦虑",
  "记忆",
  "文学",
  "技术",
  "习惯",
  "阅读",
  "呼吸",
  "身体",
  "时间",
];
export function extractKeywords(text: string): string[] {
  let rest = text.normalize("NFKC").toLowerCase();
  const result: string[] = [];
  for (const phrase of phrases) {
    const re = /[a-z]/.test(phrase)
      ? new RegExp(`\\b${phrase}\\b`, "g")
      : new RegExp(phrase, "g");
    if (re.test(rest)) {
      result.push(phrase);
      rest = rest.replace(re, " ");
    }
  }
  const counts = new Map<string, number>();
  // Segmenter supplies basic Chinese word boundaries; dictionary phrases win first.
  const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
  for (const part of segmenter.segment(rest)) {
    const word = canonicalConcept(part.segment);
    if (
      !part.isWordLike ||
      stop.has(word) ||
      !/\p{L}/u.test(word) ||
      (/^[a-z]+$/.test(word) ? word.length < 3 : word.length < 2)
    )
      continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [
    ...new Set([
      ...result,
      ...[...counts].sort((a, b) => b[1] - a[1]).map(([word]) => word),
    ]),
  ].slice(0, 12);
}
