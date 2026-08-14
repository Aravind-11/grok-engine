import type { WebResult } from "../types";
import { cached, displayPath, faviconFor, fetchJson, hostnameOf } from "../http";

type HnHit = {
  title?: string;
  url?: string;
  objectID?: string;
  story_text?: string;
};

type HnResponse = { hits?: HnHit[] };

export async function searchHn(query: string): Promise<Omit<WebResult, "score">[]> {
  return cached(`hn:${query}`, 120_000, async () => {
    try {
      const data = await fetchJson<HnResponse>(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=16`,
        {},
        5000,
      );
      return (data.hits ?? [])
        .map((hit) => {
          const url = hit.url || (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : "");
          if (!url || !hit.title) return null;
          return {
            title: hit.title,
            url,
            displayUrl: displayPath(url),
            snippet: (hit.story_text ?? "").slice(0, 240),
            favicon: faviconFor(url),
            source: hostnameOf(url),
          };
        })
        .filter((row): row is Omit<WebResult, "score"> => Boolean(row));
    } catch {
      return [];
    }
  });
}
