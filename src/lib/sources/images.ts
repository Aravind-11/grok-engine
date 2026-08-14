import type { ImageResult } from "../types";
import { cached, fetchJson } from "../http";

type CommonsResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        index?: number;
        imageinfo?: {
          url?: string;
          thumburl?: string;
          descriptionurl?: string;
          mime?: string;
        }[];
      }
    >;
  };
};

type WikiPagesResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        index?: number;
        canonicalurl?: string;
        thumbnail?: { source?: string };
        original?: { source?: string };
      }
    >;
  };
};

export async function searchImages(query: string, limit = 24): Promise<ImageResult[]> {
  return cached(`img:${limit}:${query}`, 120_000, async () => {
    const [commons, pages] = await Promise.all([
      fetchJson<CommonsResponse>(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
          `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${Math.min(limit, 24)}` +
          `&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=640&format=json`,
      ).catch(() => ({}) as CommonsResponse),
      fetchJson<WikiPagesResponse>(
        `https://en.wikipedia.org/w/api.php?action=query&generator=search` +
          `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=12` +
          `&prop=pageimages|info&piprop=thumbnail|original&pithumbsize=640&inprop=url&format=json`,
      ).catch(() => ({}) as WikiPagesResponse),
    ]);

    const out: ImageResult[] = [];
    const seen = new Set<string>();

    const wikiPages = Object.values(pages.query?.pages ?? {}).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    for (const page of wikiPages) {
      const thumb = page.thumbnail?.source ?? page.original?.source;
      if (!thumb || seen.has(thumb)) continue;
      seen.add(thumb);
      out.push({
        title: page.title ?? query,
        url: page.original?.source ?? thumb,
        thumb,
        sourceUrl: page.canonicalurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title ?? "").replace(/ /g, "_"))}`,
        source: "Wikipedia",
      });
    }

    const files = Object.values(commons.query?.pages ?? {}).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    for (const file of files) {
      const info = file.imageinfo?.[0];
      const mime = info?.mime ?? "";
      if (mime && !mime.startsWith("image/")) continue;
      const thumb = info?.thumburl ?? info?.url;
      if (!thumb || seen.has(thumb)) continue;
      seen.add(thumb);
      out.push({
        title: (file.title ?? "").replace(/^File:/, ""),
        url: info?.url ?? thumb,
        thumb,
        sourceUrl: info?.descriptionurl ?? "https://commons.wikimedia.org",
        source: "Wikimedia Commons",
      });
    }

    return out.slice(0, limit);
  });
}
