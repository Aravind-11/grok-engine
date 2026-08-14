export type SearchIntent = "web" | "local" | "entity" | "question" | "weather";
export type LocalKind = "dining" | "poi";

export type ParsedQuery = {
  original: string;
  search: string;
  image: string;
  contentTokens: string[];
  intent: SearchIntent;
  place?: string;
  topic?: string;
  brand?: string;
  brandHost?: string;
  localKind?: LocalKind;
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
  "look",
  "looks",
  "like",
  "likes",
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

const BRANDS: { pattern: RegExp; name: string; host?: string }[] = [
  { pattern: /\bzip[\s-]?cars?\b/i, name: "zipcar", host: "zipcar.com" },
  { pattern: /\bwhole[\s-]?foods\b/i, name: "whole foods", host: "wholefoodsmarket.com" },
  { pattern: /\btrader[\s-]?joe'?s\b/i, name: "trader joes", host: "traderjoes.com" },
  { pattern: /\buber[\s-]?eats\b/i, name: "uber eats", host: "ubereats.com" },
  { pattern: /\bhome[\s-]?depot\b/i, name: "home depot", host: "homedepot.com" },
  { pattern: /\btaco[\s-]?bell\b/i, name: "taco bell", host: "tacobell.com" },
];

const NEIGHBORHOODS: Record<string, string> = {
  westwood: "westwood",
  brentwood: "brentwood",
  "century city": "century city",
  "culver city": "culver city",
  "santa monica": "santa monica",
  venice: "venice",
  hollywood: "hollywood",
  "silver lake": "silver lake",
  ktown: "koreatown",
  koreatown: "koreatown",
  ucla: "ucla",
  "west la": "west los angeles",
  downtown: "downtown",
};

const LOCATION_STOP = new Set(["near", "nearby", "around", "close", "locations", "location", "find"]);

const WEATHER_HINTS = new Set([
  "weather",
  "forecast",
  "temperature",
  "sunny",
  "sunshine",
  "sun",
  "rain",
  "rainy",
  "cloudy",
  "clouds",
  "hot",
  "cold",
  "humid",
  "humidity",
  "climate",
  "storm",
  "snow",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9.]+/i)
    .map((t) => t.replace(/\.$/, ""))
    .filter((t) => t.length > 1);
}

export function normalizeBrands(text: string): string {
  let out = text;
  for (const brand of BRANDS) {
    out = out.replace(brand.pattern, brand.name);
  }
  return out;
}

export function detectBrand(text: string): { name: string; host?: string } | undefined {
  const normalized = normalizeBrands(text);
  for (const brand of BRANDS) {
    if (brand.pattern.test(text) || normalized.toLowerCase().includes(brand.name)) {
      return { name: brand.name, host: brand.host };
    }
  }
  return undefined;
}

export function contentTokens(text: string): string[] {
  return tokenize(normalizeBrands(text))
    .map((t) => PLACES[t] ?? t)
    .join(" ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t) && !LOCATION_STOP.has(t));
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
  const branded = normalizeBrands(original);
  const brand = detectBrand(original);
  const rawTokens = tokenize(branded);
  const expanded = rawTokens.map((t) => PLACES[t] ?? t);
  const text = expanded.join(" ");
  const contents = contentTokens(branded);

  const hasLocalHint = expanded.some((t) => LOCAL_HINTS.has(t) || LOCATION_STOP.has(t));
  const hasFoodHint = expanded.some((t) => FOOD_HINTS.has(t)) && !brand;
  const whereIn = branded.match(
    /^(?:where(?:'s| is| are)?|find|locate)\s+(.+?)\s+(?:in|near|around|at)\s+(.+?)\??$/i,
  );
  const neighborhood =
    Object.keys(NEIGHBORHOODS)
      .sort((a, b) => b.length - a.length)
      .find((name) => text.includes(name)) ?? undefined;

  const place =
    whereIn?.[2]?.trim().toLowerCase() ??
    [...CITY_NAMES].find((city) => text.includes(city)) ??
    (expanded.includes("los") && expanded.includes("angeles") ? "los angeles" : undefined) ??
    neighborhood;

  const hasWeatherHint =
    expanded.some((t) => WEATHER_HINTS.has(t)) ||
    /\blook(?:s)? like\b|\bforecast\b|\btemperature\b/i.test(branded);

  let intent: SearchIntent = "web";
  let localKind: LocalKind | undefined;
  if (hasWeatherHint && place) {
    intent = "weather";
  } else if ((hasLocalHint || whereIn || brand) && place) {
    intent = "local";
    localKind = hasFoodHint ? "dining" : "poi";
  } else if (whereIn || (brand && hasLocalHint)) {
    intent = "local";
    localKind = "poi";
  } else if (/^(what|who|where|when|why|how|which)\b/i.test(original) && contents.length >= 2) {
    intent = "question";
  } else if (contents.length <= 3 && !hasLocalHint) {
    intent = "entity";
  }

  let topic = contents
    .filter((t) => t !== "los" && t !== "angeles" && !place?.split(" ").includes(t))
    .join(" ");
  if (brand) topic = brand.name;
  if (hasFoodHint) {
    topic = topic
      .replace(/\bplaces?\b/g, "restaurants")
      .replace(/\beats?\b/g, "restaurants")
      .replace(/\s+/g, " ")
      .trim();
    if (!/\brestaurant/.test(topic)) topic = `${topic} restaurants`.trim();
  }

  const search =
    intent === "weather" && place
      ? `${place} sunny day weather`
      : intent === "local" && place
        ? [topic || contents.join(" "), place].filter(Boolean).join(" ")
        : brand
          ? [brand.name, ...contents.filter((t) => t !== brand.name)].join(" ")
          : contents.join(" ") || original;

  const image =
    intent === "weather" && place
      ? `${place} sunny day skyline sunshine`
      : brand
        ? `${brand.name} ${place ?? ""}`.trim()
        : intent === "local"
          ? `${topic || "restaurants"} ${place ?? ""}`.trim()
          : search;

  const tokens = contentTokens(search);
  if (brand && !tokens.includes(brand.name)) tokens.unshift(brand.name);

  return {
    original,
    search,
    image,
    contentTokens: tokens,
    intent,
    place,
    topic: topic || undefined,
    brand: brand?.name,
    brandHost: brand?.host,
    localKind,
  };
}
