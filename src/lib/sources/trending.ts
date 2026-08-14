import { cached, fetchJson } from "../http";

type Featured = {
  mostread?: {
    articles?: { title?: string; views?: number; normalizedtitle?: string }[];
  };
};

const FALLBACK = [
  "James Webb Space Telescope",
  "Grok",
  "Premier League",
  "NVIDIA",
  "Olympics",
  "Taylor Swift",
  "Climate",
  "ChatGPT",
];

export async function trendingQueries(): Promise<string[]> {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return cached(`trend:${y}${m}${d}`, 30 * 60_000, async () => {
    try {
      const data = await fetchJson<Featured>(
        `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`,
        {},
        5000,
      );
      const titles = (data.mostread?.articles ?? [])
        .map((a) => a.normalizedtitle || a.title || "")
        .filter((t) => t && !/^[A-Z]{1,3}$/.test(t) && t !== "Main Page")
        .slice(0, 8);
      return titles.length ? titles : FALLBACK;
    } catch {
      return FALLBACK;
    }
  });
}
