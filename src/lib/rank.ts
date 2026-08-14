import type { ParsedQuery } from "./query";
import { contentTokens } from "./query";
import type { WebResult } from "./types";
import { hostnameOf } from "./http";

const AUTHORITY: Record<string, number> = {
  "wikipedia.org": 18,
  "en.wikipedia.org": 18,
  "britannica.com": 14,
  "gov": 16,
  "edu": 14,
  "nih.gov": 16,
  "nasa.gov": 16,
  "cdc.gov": 16,
  "who.int": 14,
  "un.org": 12,
  "github.com": 10,
  "developer.mozilla.org": 14,
  "stackoverflow.com": 10,
  "arxiv.org": 12,
  "nature.com": 12,
  "nytimes.com": 8,
  "bbc.com": 9,
  "bbc.co.uk": 9,
  "reuters.com": 9,
  "apnews.com": 9,
  "theguardian.com": 8,
  "wsj.com": 8,
  "bloomberg.com": 8,
  "cnn.com": 6,
  "youtube.com": 4,
  "x.com": 3,
  "twitter.com": 3,
  "reddit.com": 4,
  "imdb.com": 8,
  "wiktionary.org": 10,
};

function authority(url: string): number {
  const host = hostnameOf(url);
  if (AUTHORITY[host] != null) return AUTHORITY[host];
  const parts = host.split(".");
  const tld = parts.at(-1) ?? "";
  const sld = parts.slice(-2).join(".");
  if (AUTHORITY[sld] != null) return AUTHORITY[sld];
  if (tld === "gov") return 16;
  if (tld === "edu") return 13;
  if (tld === "mil") return 14;
  if (tld === "int") return 10;
  return 0;
}

const LOCAL_HOSTS = [
  "yelp.com",
  "eater.com",
  "timeout.com",
  "infatuation.com",
  "tripadvisor.com",
  "opentable.com",
  "resy.com",
  "timeout.com",
  "latimes.com",
  "cbslocal.com",
  "thrillist.com",
];

export function scoreResult(query: string, result: Omit<WebResult, "score">, parsed?: ParsedQuery): number {
  const q = (parsed?.search ?? query).toLowerCase();
  const title = result.title.toLowerCase();
  const snippet = result.snippet.toLowerCase();
  const host = hostnameOf(result.url);
  const words = parsed?.contentTokens?.length ? parsed.contentTokens : contentTokens(query);
  let score = 1 + authority(result.url);

  if (title === q) score += 24;
  else if (title.startsWith(q)) score += 14;
  else if (title.includes(q)) score += 8;

  let hits = 0;
  for (const w of words) {
    if (title.includes(w)) {
      score += 5;
      hits += 1;
    }
    if (snippet.includes(w)) {
      score += 2;
      hits += 1;
    }
    if (host === w || host.startsWith(`${w}.`)) score += 22;
    else if (host.includes(w)) score += 6;
  }

  if (words.length >= 2 && hits === 0) score -= 24;
  else if (words.length >= 3 && hits < 2) score -= 12;

  if (parsed?.brand) {
    const brand = parsed.brand.toLowerCase();
    const compact = brand.replace(/\s+/g, "");
    const hayBrand = `${title} ${snippet} ${host} ${result.url}`.toLowerCase();
    if (hayBrand.includes(brand) || hayBrand.includes(compact)) score += 20;
    if (parsed.brandHost && host.endsWith(parsed.brandHost)) score += 28;
    if (brand === "zipcar" && /zip\.co|zippay|afterpay|quadpay|zip(?:\s|-)?pay|buy now pay later/.test(hayBrand)) {
      score -= 50;
    }
  }

  if (parsed?.intent === "local") {
    const placeBits = (parsed.place ?? "").split(/\s+/).filter(Boolean);
    const hay = `${title} ${snippet} ${host} ${result.url}`.toLowerCase();
    const hasPlace =
      !placeBits.length ||
      placeBits.some((p) => hay.includes(p)) ||
      (parsed.place === "los angeles" && (hay.includes("/la") || /\bla\b/.test(hay)));
    if (parsed.localKind !== "poi" && LOCAL_HOSTS.some((h) => host.endsWith(h)) && hasPlace) score += 18;
    if (parsed.localKind !== "poi" && /restaurant|trattoria|osteria/.test(hay) && hasPlace) score += 10;
    if (/locations?|pods?|parking|map|near|hours/.test(hay) && parsed.localKind === "poi") score += 12;
    if (!hasPlace) score -= 20;
    if (result.source === "wikipedia" || host.includes("wikipedia.org")) score -= parsed.brand ? 4 : 16;
    const topicBits = (parsed.topic ?? "").split(/\s+/).filter((t) => t.length > 2 && t !== "los" && t !== "angeles");
    if (topicBits.length && !topicBits.some((t) => title.includes(t) || snippet.includes(t) || host.includes(t.replace(/\s+/g, "")))) {
      score -= 18;
    }
    if (/language|phrases|lessons|grammar|vocabulary|duolingo|recipes?|wikipedia|wordreference|dizionario/.test(hay)) {
      score -= 28;
    }
    if (parsed.localKind === "poi" && /crash|arrest|sexual assault|killed|dies after|insurance/.test(hay) && parsed.brand && !hay.includes(parsed.brand)) {
      score -= 30;
    }
  } else if (parsed?.intent === "weather") {
    const hay = `${title} ${snippet} ${host}`.toLowerCase();
    if (/weather|forecast|sunny|sunshine|climate|temperature|heat/.test(hay)) score += 16;
    if (/sunland|tujunga|herald examiner|newspaper|robot|seahawks/.test(hay)) score -= 30;
    if (result.source === "wikipedia" || host.includes("wikipedia.org")) score -= 12;
  } else if (result.source === "wikipedia") {
    score += 2;
  }

  if (result.crawled && result.snippet.length > 80) score += 3;
  if (host.endsWith(".com") && words.some((w) => host.includes(w))) score += 5;
  return score;
}

export function rankAndDedupe(
  query: string,
  items: Omit<WebResult, "score">[],
  parsed?: ParsedQuery,
): WebResult[] {
  const seen = new Set<string>();
  const scored: WebResult[] = [];
  for (const item of items) {
    let key = item.url;
    try {
      const u = new URL(item.url);
      key = `${u.hostname}${u.pathname.replace(/\/$/, "")}`;
    } catch {
      /* keep raw */
    }
    if (seen.has(key)) continue;
    seen.add(key);
    scored.push({ ...item, score: scoreResult(query, item, parsed) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
