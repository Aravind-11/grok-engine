export type SearchIntent = "web" | "local" | "entity" | "question";

export type ParsedQuery = {
  original: string;
  search: string;
  image: string;
  contentTokens: string[];
  intent: SearchIntent;
  place?: string;
  topic?: string;
};

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "of",
  "at",
  "by",
  "for",
  "with",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "to",
  "from",
  "in",
  "on",
  "over",
  "under",
  "again",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "should",
  "now",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "doing",
  "would",
  "could",
  "i",
  "me",
  "my",
  "we",
  "you",
  "your",
  "it",
  "its",
  "they",
  "them",
  "good",
  "best",
  "great",
  "nice",
  "cool",
  "awesome",
  "recommend",
  "recommended",
  "suggestions",
  "suggestion",
  "please",
  "tell",
  "show",
  "find",
  "give",
  "list",
  "looking",
]);

const PLACES: Record<string, string> = {
  la: "los angeles",
  "l.a": "los angeles",
  "l.a.": "los angeles",
  nyc: "new york",
  ny: "new york",
  sf: "san francisco",
  "s.f.": "san francisco",
  chi: "chicago",
  dc: "washington dc",
  "d.c.": "washington dc",
  philly: "philadelphia",
  atl: "atlanta",
};

const CITY_NAMES = new Set([
  "los angeles",
  "new york",
  "san francisco",
  "chicago",
  "seattle",
  "boston",
  "miami",
  "houston",
  "dallas",
  "austin",
  "denver",
  "portland",
  "phoenix",
  "atlanta",
  "philadelphia",
  "washington",
  "london",
  "paris",
  "tokyo",
  "toronto",
  "vancouver",
]);

const LOCAL_HINTS = new Set([
  "place",
  "places",
  "restaurant",
  "restaurants",
  "food",
  "eat",
  "eats",
  "dining",
  "dinner",
  "lunch",
  "brunch",
  "cafe",
  "cafes",
  "coffee",
  "bar",
  "bars",
  "hotel",
  "hotels",
  "stay",
  "near",
  "nearby",
  "around",
  "visit",
  "things",
]);

const FOOD_HINTS = new Set([
  "place",
  "places",
  "restaurant",
  "restaurants",
  "food",
  "eat",
  "dining",
  "dinner",
  "lunch",
  "cafe",
  "bar",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9.]+/i)
    .map((t) => t.replace(/\.$/, ""))
    .filter((t) => t.length > 1);
}

export function contentTokens(text: string): string[] {
  return tokenize(text)
    .map((t) => PLACES[t] ?? t)
    .join(" ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function overlapScore(queryTokens: string[], ...parts: string[]): number {
  if (!queryTokens.length) return 0;
  const hay = parts.join(" ").toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (hay.includes(token)) hits += 1;
    else if (token === "restaurants" && hay.includes("restaurant")) hits += 1;
    else if (token === "los" && hay.includes("la ")) hits += 0.5;
  }
  return hits / queryTokens.length;
}

export function isRelevant(queryTokens: string[], ...parts: string[]): boolean {
  if (queryTokens.length <= 1) return overlapScore(queryTokens, ...parts) > 0;
  return overlapScore(queryTokens, ...parts) >= (queryTokens.length >= 3 ? 0.4 : 0.5);
}

export function parseQuery(raw: string): ParsedQuery {
  const original = raw.trim();
  const rawTokens = tokenize(original);
  const expanded = rawTokens.map((t) => PLACES[t] ?? t);
  const text = expanded.join(" ");
  const contents = contentTokens(original);

  const hasLocalHint = expanded.some((t) => LOCAL_HINTS.has(t));
  const hasFoodHint = expanded.some((t) => FOOD_HINTS.has(t));
  const place =
    [...CITY_NAMES].find((city) => text.includes(city)) ??
    (expanded.includes("los") && expanded.includes("angeles") ? "los angeles" : undefined);

  let intent: SearchIntent = "web";
  if (hasLocalHint && place) intent = "local";
  else if (/^(what|who|where|when|why|how|which)\b/i.test(original) && contents.length >= 2) intent = "question";
  else if (contents.length <= 3 && !hasLocalHint) intent = "entity";

  let topic = contents.filter((t) => t !== "los" && t !== "angeles" && !place?.split(" ").includes(t)).join(" ");
  if (hasFoodHint) {
    topic = topic
      .replace(/\bplaces?\b/g, "restaurants")
      .replace(/\beats?\b/g, "restaurants")
      .replace(/\s+/g, " ")
      .trim();
    if (!/\brestaurant/.test(topic)) topic = `${topic} restaurants`.trim();
  }

  const search =
    intent === "local" && place
      ? [topic || contents.join(" "), place].filter(Boolean).join(" ")
      : contents.join(" ") || original;

  const image = intent === "local" ? `${topic || "restaurants"} ${place ?? ""}`.trim() : search;

  return {
    original,
    search,
    image,
    contentTokens: contentTokens(search),
    intent,
    place,
    topic: topic || undefined,
  };
}
