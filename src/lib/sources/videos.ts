import type { VideoResult } from "../types";
import { searchWeb } from "./ddg";

function videoIdFrom(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") {
        return parts[1] ?? null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function searchVideos(query: string): Promise<VideoResult[]> {
  const [a, b] = await Promise.all([
    searchWeb(`${query} site:youtube.com`, 0),
    searchWeb(`${query} site:youtube.com`, 10),
  ]);
  const rows = [...a, ...b];
  const out: VideoResult[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = videoIdFrom(row.url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      title: row.title.replace(/\s*[-|]\s*YouTube\s*$/i, ""),
      url: `https://www.youtube.com/watch?v=${id}`,
      videoId: id,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      snippet: row.snippet,
      source: "YouTube",
    });
  }
  return out;
}
