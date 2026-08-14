import type { NewsResult } from "../types";
import { cached, decodeHtml, fetchText, stripTags } from "../http";

function tag(block: string, name: string): string {
  const cdata = block.match(new RegExp(`<${name}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`, "i"));
  if (cdata) return cdata[1].trim();
  const plain = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return plain ? stripTags(plain[1]) : "";
}

export async function searchNews(query: string, limit = 40): Promise<NewsResult[]> {
  return cached(`news:${query}`, 60_000, async () => {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetchText(url, {}, 7000);
    const items: NewsResult[] = [];
    const re = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(xml)) && items.length < limit) {
      const block = match[1];
      const titleRaw = tag(block, "title");
      const link = tag(block, "link");
      if (!titleRaw || !link) continue;
      const sourceTag = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      let source = sourceTag ? stripTags(sourceTag[1]) : "";
      let title = decodeHtml(titleRaw);
      if (!source && title.includes(" - ")) {
        const parts = title.split(" - ");
        source = parts.pop() ?? "";
        title = parts.join(" - ");
      }
      let snippet = tag(block, "description").slice(0, 240);
      if (/news\.google\.com|https?:\/\//i.test(snippet)) snippet = "";
      items.push({
        title,
        url: link,
        source: source || "News",
        publishedAt: tag(block, "pubDate"),
        snippet,
      });
    }
    return items;
  });
}

export function formatNewsDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const delta = Date.now() - d.getTime();
  const mins = Math.round(delta / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
