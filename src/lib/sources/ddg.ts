import type { WebResult } from "../types";
import { cached, displayPath, faviconFor, fetchText, hostnameOf, stripTags } from "../http";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function unwrapDdg(href: string): string {
  try {
    const absolute = href.startsWith("//") ? `https:${href}` : href;
    const u = new URL(absolute, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return uddg;
    return absolute;
  } catch {
    return href;
  }
}

async function ddgHtml(query: string, offset: number): Promise<string> {
  const request = () =>
    fetchText(
      "https://html.duckduckgo.com/html/",
      {
        method: "POST",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html",
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://html.duckduckgo.com/html/",
        },
        body: new URLSearchParams({
          q: query,
          kl: "us-en",
          s: String(offset),
          dc: String(offset),
        }).toString(),
      },
      8000,
    );

  let html = await request();
  if (html.includes("anomaly-modal") || html.includes("cc=botnet")) {
    await new Promise((r) => setTimeout(r, 450));
    html = await request();
  }
  return html;
}

export async function searchWebMany(query: string, pages = 4): Promise<Omit<WebResult, "score">[]> {
  const offsets = Array.from({ length: pages }, (_, i) => i * 10);
  const batches = await Promise.all(offsets.map((offset) => searchWeb(query, offset)));
  const seen = new Set<string>();
  const out: Omit<WebResult, "score">[] = [];
  for (const row of batches.flat()) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(row);
  }
  return out;
}

export async function searchWeb(query: string, offset = 0): Promise<Omit<WebResult, "score">[]> {
  return cached(`web:v2:${offset}:${query}`, 90_000, async () => {
    const html = await ddgHtml(query, offset);
    const results: Omit<WebResult, "score">[] = [];
    const seen = new Set<string>();
    const blockRe = /<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi;
    const titleRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
    const snippetRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i;
    const blocks = html.match(blockRe) ?? [];
    if (!blocks.length) {
      // fallback: pair each result__a with nearby snippet
      const titles = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
      for (const t of titles) {
        const rawUrl = unwrapDdg(t[1]);
        if (!/^https?:\/\//i.test(rawUrl) || seen.has(rawUrl)) continue;
        seen.add(rawUrl);
        const after = html.slice(t.index ?? 0, (t.index ?? 0) + 1200);
        const snip = after.match(snippetRe);
        results.push({
          title: stripTags(t[2]),
          url: rawUrl,
          displayUrl: displayPath(rawUrl),
          snippet: snip ? stripTags(snip[1]) : "",
          favicon: faviconFor(rawUrl),
          source: hostnameOf(rawUrl),
        });
      }
      return results.length ? results : instantRelated(query);
    }

    for (const block of blocks) {
      if (/result--ad|badge--ad/.test(block)) continue;
      const title = block.match(titleRe);
      if (!title) continue;
      const rawUrl = unwrapDdg(title[1]);
      if (!/^https?:\/\//i.test(rawUrl) || seen.has(rawUrl)) continue;
      seen.add(rawUrl);
      const snip = block.match(snippetRe);
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

    if (results.length) return results;
    return instantRelated(query);
  });
}

type InstantPayload = {
  AbstractURL?: string;
  AbstractText?: string;
  Heading?: string;
  RelatedTopics?: ({ FirstURL?: string; Text?: string; Topics?: { FirstURL?: string; Text?: string }[] } | string)[];
};

export async function instantRelated(query: string): Promise<Omit<WebResult, "score">[]> {
  return cached(`ddg-ia:${query}`, 120_000, async () => {
    try {
      const data = await fetchText(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } },
        5000,
      );
      const json = JSON.parse(data) as InstantPayload;
      const out: Omit<WebResult, "score">[] = [];
      if (json.AbstractURL && json.Heading) {
        out.push({
          title: json.Heading,
          url: json.AbstractURL,
          displayUrl: displayPath(json.AbstractURL),
          snippet: json.AbstractText ?? "",
          favicon: faviconFor(json.AbstractURL),
          source: hostnameOf(json.AbstractURL),
        });
      }
      const topics = json.RelatedTopics ?? [];
      for (const topic of topics) {
        if (!topic || typeof topic === "string") continue;
        const flat = topic.FirstURL ? [topic] : (topic.Topics ?? []);
        for (const item of flat) {
          if (!item.FirstURL || !item.Text) continue;
          out.push({
            title: item.Text.split(" - ")[0] ?? item.Text,
            url: item.FirstURL.replace("https://duckduckgo.com/", "https://en.wikipedia.org/wiki/"),
            displayUrl: displayPath(item.FirstURL),
            snippet: item.Text,
            favicon: faviconFor(item.FirstURL),
            source: hostnameOf(item.FirstURL),
          });
        }
      }
      return out.slice(0, 20);
    } catch {
      return [];
    }
  });
}

export async function suggest(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  return cached(`ac:${query}`, 60_000, async () => {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
    const data = await fetchText(
      url,
      { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } },
      4000,
    );
    const parsed = JSON.parse(data) as unknown;
    if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
      return (parsed[1] as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 8);
    }
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) =>
          item && typeof item === "object" && "phrase" in item ? String((item as { phrase: string }).phrase) : "",
        )
        .filter(Boolean)
        .slice(0, 8);
    }
    return [];
  });
}
