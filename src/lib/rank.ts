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

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 1);
}

export function scoreResult(query: string, result: Omit<WebResult, "score">): number {
  const q = query.toLowerCase();
  const title = result.title.toLowerCase();
  const snippet = result.snippet.toLowerCase();
  const host = hostnameOf(result.url);
  const words = tokens(query);
  let score = 1 + authority(result.url);

  if (title === q) score += 24;
  else if (title.startsWith(q)) score += 14;
  else if (title.includes(q)) score += 8;

  for (const w of words) {
    if (title.includes(w)) score += 3;
    if (snippet.includes(w)) score += 1;
    if (host === w || host.startsWith(`${w}.`)) score += 22;
    else if (host.includes(w)) score += 6;
  }

  if (result.source === "wikipedia") score += 2;
  if (result.crawled && result.snippet.length > 80) score += 3;
  if (host.endsWith(".com") && words.some((w) => host.includes(w))) score += 5;
  return score;
}

export function rankAndDedupe(query: string, items: Omit<WebResult, "score">[]): WebResult[] {
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
    scored.push({ ...item, score: scoreResult(query, item) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
