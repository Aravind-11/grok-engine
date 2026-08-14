import type { WebResult } from "../types";
import { cached, displayPath, faviconFor, fetchText, hostnameOf, stripTags } from "../http";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function unwrapBing(href: string): string {
  try {
    const absolute = href.replace(/&amp;/g, "&");
    const u = new URL(absolute, "https://www.bing.com");
    const encoded = u.searchParams.get("u");
    if (encoded) {
      const b64 = encoded.replace(/^a1/i, "").replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      const decoded = Buffer.from(padded, "base64").toString("utf8");
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
    if (/^https?:\/\//i.test(absolute) && !absolute.includes("bing.com/ck/")) return absolute;
  } catch {
    /* fall through */
  }
  return href;
}

function parseBing(html: string): Omit<WebResult, "score">[] {
  const results: Omit<WebResult, "score">[] = [];
  const seen = new Set<string>();
  const blocks = html.split(/<li class="b_algo"/i).slice(1);
  for (const block of blocks) {
    const title = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!title) continue;
    const rawUrl = unwrapBing(title[1]);
    if (!/^https?:\/\//i.test(rawUrl) || rawUrl.includes("bing.com/") || seen.has(rawUrl)) continue;
    seen.add(rawUrl);
    const snip =
      block.match(/<p class="b_lineclamp\d*"[^>]*>([\s\S]*?)<\/p>/i) ??
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const textTitle = stripTags(title[2]);
    if (!textTitle) continue;
    results.push({
      title: textTitle,
      url: rawUrl,
      displayUrl: displayPath(rawUrl),
      snippet: snip ? stripTags(snip[1]) : "",
      favicon: faviconFor(rawUrl),
      source: hostnameOf(rawUrl),
    });
  }
  return results;
}

export async function searchBing(query: string, first = 1): Promise<Omit<WebResult, "score">[]> {
  return cached(`bing:${first}:${query}`, 90_000, async () => {
    try {
      const html = await fetchText(
        `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&first=${first}`,
        {
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: "text/html",
            "Accept-Language": "en-US,en;q=0.9",
          },
        },
        7000,
      );
      return parseBing(html);
    } catch {
      return [];
    }
  });
}

export async function searchBingMany(query: string): Promise<Omit<WebResult, "score">[]> {
  const pages = await Promise.all([searchBing(query, 1), searchBing(query, 21)]);
  const seen = new Set<string>();
  const out: Omit<WebResult, "score">[] = [];
  for (const row of pages.flat()) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(row);
  }
  return out;
}
