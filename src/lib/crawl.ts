import type { WebResult } from "./types";
import { displayPath, faviconFor, fetchText, hostnameOf, stripTags, withTimeout } from "./http";

const SKIP_EXT = /\.(pdf|zip|gz|png|jpe?g|gif|webp|svg|mp4|mp3|mov|avi|wmv|exe|dmg|iso|css|js)(\?|$)/i;
const SKIP_HOST = /(doubleclick|googlesyndication|facebook\.com\/login|accounts\.google|appleid\.apple)/i;

function tokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2);
}

function relevant(query: string, ...parts: string[]): boolean {
  const words = tokens(query);
  if (!words.length) return true;
  const hay = parts.join(" ").toLowerCase();
  return words.some((w) => hay.includes(w));
}

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
      "i",
    );
    const m = html.match(re) ?? html.match(alt);
    if (m?.[1]) return stripTags(m[1]);
  }
  return "";
}

function extractText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  const paras = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((p) => p.length > 40 && p.length < 600);
  if (paras.length) return paras.slice(0, 2).join(" ");
  return stripTags(cleaned).slice(0, 400);
}

function extractLinks(html: string, base: string, query: string, limit = 3): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && out.length < limit) {
    let href = match[1];
    const text = stripTags(match[2]);
    try {
      href = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(href)) continue;
    if (SKIP_EXT.test(href) || SKIP_HOST.test(href)) continue;
    const key = href.replace(/\/$/, "").split("#")[0];
    if (seen.has(key) || key === base.replace(/\/$/, "")) continue;
    if (!relevant(query, href, text)) continue;
    seen.add(key);
    out.push({ href, text });
  }
  return out;
}

export type CrawledPage = {
  url: string;
  title: string;
  snippet: string;
  links: { href: string; text: string }[];
};

export async function crawlPage(url: string, query: string): Promise<CrawledPage | null> {
  if (!/^https?:\/\//i.test(url) || SKIP_EXT.test(url) || SKIP_HOST.test(url)) return null;
  try {
    const html = (
      await fetchText(
        url,
        {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "GrokEngine/1.0 (+https://grok-engine.vercel.app; query-time crawler)",
          },
        },
        3200,
      )
    ).slice(0, 140_000);

    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = stripTags(titleTag?.[1] ?? "").replace(/\s+/g, " ").slice(0, 140);
    const snippet =
      metaContent(html, ["description", "og:description", "twitter:description"]) || extractText(html);
    return {
      url,
      title: title || hostnameOf(url),
      snippet: snippet.slice(0, 320),
      links: extractLinks(html, url, query, 3),
    };
  } catch {
    return null;
  }
}

export async function crawlExpand(
  query: string,
  seeds: Omit<WebResult, "score">[],
  budget = 14,
): Promise<{ enriched: Map<string, CrawledPage>; discovered: Omit<WebResult, "score">[] }> {
  const unique: Omit<WebResult, "score">[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    const key = seed.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(seed);
    if (unique.length >= budget) break;
  }

  const pages = await Promise.all(unique.map((seed) => withTimeout(crawlPage(seed.url, query), 3500, null)));
  const enriched = new Map<string, CrawledPage>();
  const discovered: Omit<WebResult, "score">[] = [];
  const discSeen = new Set(seen);

  for (const page of pages) {
    if (!page) continue;
    enriched.set(page.url.replace(/\/$/, ""), page);
    for (const link of page.links) {
      const key = link.href.replace(/\/$/, "");
      if (discSeen.has(key)) continue;
      discSeen.add(key);
      const pathTitle = decodeURIComponent(link.href.replace(/^https?:\/\/[^/]+/i, "")).replace(/[-_/]+/g, " ").trim();
      discovered.push({
        title: link.text.slice(0, 140) || pathTitle || hostnameOf(link.href),
        url: link.href,
        displayUrl: displayPath(link.href),
        snippet: `Found while crawling ${hostnameOf(page.url)}`,
        favicon: faviconFor(link.href),
        source: hostnameOf(link.href),
        crawled: true,
      });
      if (discovered.length >= 24) break;
    }
  }

  return { enriched, discovered };
}

export function applyCrawl(
  rows: Omit<WebResult, "score">[],
  enriched: Map<string, CrawledPage>,
): Omit<WebResult, "score">[] {
  return rows.map((row) => {
    const page = enriched.get(row.url.replace(/\/$/, ""));
    if (!page) return row;
    return {
      ...row,
      title: row.title.length > 8 ? row.title : page.title,
      snippet: page.snippet && page.snippet.length > (row.snippet?.length ?? 0) ? page.snippet : row.snippet || page.snippet,
      crawled: true,
    };
  });
}
