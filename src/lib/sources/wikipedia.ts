import type { KnowledgePanel, WebResult } from "../types";
import { cached, displayPath, faviconFor, fetchJson, stripTags } from "../http";
import { wikidataFacts } from "./wikidata";

type WikiSearchResponse = {
  query?: {
    search?: { title: string; snippet: string; pageid: number }[];
  };
};

type WikiSummary = {
  title: string;
  description?: string;
  extract?: string;
  type?: string;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  wikibase_item?: string;
  coordinates?: { lat: number; lon: number };
};

export async function wikiSearch(query: string, limit = 8) {
  return cached(`wiki-s:${limit}:${query}`, 120_000, async () => {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
      `&utf8=1&format=json&srlimit=${limit}&srprop=snippet`;
    const data = await fetchJson<WikiSearchResponse>(url);
    return (data.query?.search ?? []).map((row) => ({
      title: row.title,
      snippet: stripTags(row.snippet),
      pageid: row.pageid,
    }));
  });
}

export async function wikiSummary(title: string): Promise<WikiSummary | null> {
  return cached(`wiki-sum:${title}`, 300_000, async () => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    try {
      return await fetchJson<WikiSummary>(url);
    } catch {
      return null;
    }
  });
}

export async function wikiAsResults(query: string): Promise<Omit<WebResult, "score">[]> {
  const rows = await wikiSearch(query, 6);
  return rows.map((row) => {
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(row.title.replace(/ /g, "_"))}`;
    return {
      title: `${row.title} - Wikipedia`,
      url,
      displayUrl: displayPath(url),
      snippet: row.snippet,
      favicon: faviconFor(url),
      source: "wikipedia",
    };
  });
}

export async function getKnowledge(query: string): Promise<KnowledgePanel | null> {
  const rows = await wikiSearch(query, 8);
  if (!rows.length) return null;

  const q = query.toLowerCase().trim();
  const preferred =
    rows.find((r) => r.title.toLowerCase() === q) ??
    rows.find((r) => r.title.toLowerCase().replace(/,/g, "") === q) ??
    rows.find((r) => {
      const t = r.title.toLowerCase();
      return t.startsWith(`${q},`) || t.startsWith(`${q} (`) || t.startsWith(`${q} inc`);
    }) ??
    rows.find((r) => r.title.toLowerCase().startsWith(q) && r.title.length <= q.length + 14) ??
    rows[0];

  let summary = await wikiSummary(preferred.title);
  if (summary?.type === "disambiguation" && rows[1]) {
    summary = (await wikiSummary(rows[1].title)) ?? summary;
  }
  if (!summary?.extract) return null;

  const url =
    summary.content_urls?.desktop?.page ??
    `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title.replace(/ /g, "_"))}`;

  const facts = summary.wikibase_item ? await wikidataFacts(summary.wikibase_item) : [];

  return {
    title: summary.title,
    description: summary.description ?? "",
    extract: summary.extract,
    url,
    thumbnail: summary.originalimage?.source ?? summary.thumbnail?.source,
    type: summary.description,
    facts,
  };
}
