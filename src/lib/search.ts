import { buildExtractiveOverview } from "./ai";
import { cached, clampQuery, withTimeout } from "./http";
import { definitionQuery, tryCalc, tryConvert, tryTime, weatherPlace } from "./instant";
import { rankAndDedupe } from "./rank";
import { searchWeb, suggest } from "./sources/ddg";
import { defineWord } from "./sources/dictionary";
import { searchImages } from "./sources/images";
import { searchNews } from "./sources/news";
import { searchVideos } from "./sources/videos";
import { getWeather } from "./sources/weather";
import { getKnowledge, wikiAsResults, wikiSearch } from "./sources/wikipedia";
import type { InstantAnswer, PeopleAlsoAsk, SearchResponse, Tab } from "./types";

const PAGE_SIZE = 10;

async function resolveInstant(query: string): Promise<InstantAnswer | null> {
  const calc = tryCalc(query);
  if (calc) return calc;
  const convert = tryConvert(query);
  if (convert) return convert;
  const time = tryTime(query);
  if (time) return time;
  const place = weatherPlace(query);
  if (place) return getWeather(place);
  const explicitDefine = /^(define|definition of|meaning of|what does)\b/i.test(query);
  const word = definitionQuery(query);
  if (word && explicitDefine) return defineWord(word);
  return null;
}

async function relatedSearches(query: string): Promise<string[]> {
  const [ac, wiki] = await Promise.all([
    withTimeout(suggest(query), 2500, [] as string[]),
    withTimeout(wikiSearch(query, 6), 2500, [] as { title: string; snippet: string }[]),
  ]);
  const out: string[] = [];
  const seen = new Set([query.toLowerCase()]);
  for (const item of [...ac, ...wiki.map((w) => w.title)]) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 8) break;
  }
  return out;
}

function peopleAlsoAsk(
  query: string,
  knowledge: SearchResponse["knowledge"],
  wiki: { title: string; snippet: string }[],
): PeopleAlsoAsk[] {
  const items: PeopleAlsoAsk[] = [];
  if (knowledge?.extract) {
    items.push({
      question: `What is ${knowledge.title}?`,
      answer: knowledge.extract,
    });
  }
  for (const row of wiki) {
    if (!row.snippet) continue;
    if (knowledge && row.title === knowledge.title) continue;
    items.push({
      question: `What is ${row.title}?`,
      answer: row.snippet,
    });
    if (items.length >= 5) break;
  }
  if (!items.length) {
    items.push({
      question: `What is ${query}?`,
      answer: `Open the results below for current pages about ${query}.`,
    });
  }
  return items.slice(0, 5);
}

export async function runSearch(rawQuery: string, tab: Tab = "all", page = 1): Promise<SearchResponse> {
  const started = Date.now();
  const query = clampQuery(rawQuery);
  const safePage = Number.isFinite(page) && page > 0 ? Math.min(page, 20) : 1;

  if (!query) {
    return {
      query: "",
      tab,
      page: 1,
      tookMs: 0,
      instant: null,
      knowledge: null,
      results: [],
      images: [],
      news: [],
      videos: [],
      related: [],
      peopleAlsoAsk: [],
      overview: null,
      resultCount: 0,
    };
  }

  return cached(`search:v3:${tab}:${safePage}:${query}`, 45_000, async () => {
    const offset = (safePage - 1) * PAGE_SIZE;
    const wantAll = tab === "all";

    const instantP = resolveInstant(query);
    const knowledgeP = wantAll || tab === "images" ? withTimeout(getKnowledge(query), 4500, null) : Promise.resolve(null);
    const webP =
      tab === "all" ? withTimeout(searchWeb(query, offset), 8000, []) : Promise.resolve([]);
    const wikiP = withTimeout(wikiAsResults(query), 4500, []);
    const wikiRawP = withTimeout(wikiSearch(query, 6), 4500, []);
    const imagesP =
      tab === "all" || tab === "images"
        ? withTimeout(searchImages(query, 28), 7000, []).then((rows) =>
            tab === "images" ? rows : rows.slice(0, 8),
          )
        : Promise.resolve([]);
    const newsP =
      tab === "all" || tab === "news"
        ? withTimeout(searchNews(query, 24), 7000, []).then((rows) =>
            tab === "news" ? rows : rows.slice(0, 4),
          )
        : Promise.resolve([]);
    const videosP =
      tab === "videos" || tab === "all"
        ? withTimeout(searchVideos(query), 8000, [])
        : Promise.resolve([]);
    const relatedP = relatedSearches(query);

    const [instant, knowledge, web, wiki, wikiRaw, images, news, videos, related] = await Promise.all([
      instantP,
      knowledgeP,
      webP,
      wikiP,
      wikiRawP,
      imagesP,
      newsP,
      videosP,
      relatedP,
    ]);

    if (!web.length && instant && (instant.kind === "weather" || instant.kind === "time")) {
      const place = instant.kind === "weather" ? instant.place.split(",")[0] : instant.place;
      const extra = await withTimeout(searchWeb(place), 6000, []);
      web.push(...extra);
    }

    const merged = rankAndDedupe(query, tab === "all" ? [...web, ...wiki.slice(0, 3)] : web);
    const results = merged.slice(0, PAGE_SIZE);

    let finalInstant = instant;
    if (!finalInstant && !knowledge) {
      const word = definitionQuery(query);
      if (word && query.split(" ").length === 1) {
        finalInstant = await defineWord(word);
      }
    }

    const skipOverview = Boolean(finalInstant);
    const overview =
      tab === "all" && !skipOverview
        ? buildExtractiveOverview(query, knowledge, results)
        : null;

    return {
      query,
      tab,
      page: safePage,
      tookMs: Date.now() - started,
      instant: finalInstant,
      knowledge,
      results,
      images,
      news,
      videos: videos.slice(0, tab === "videos" ? 16 : 4),
      related,
      peopleAlsoAsk: tab === "all" ? peopleAlsoAsk(query, knowledge, wikiRaw) : [],
      overview,
      resultCount: Math.max(merged.length, images.length, news.length, videos.length),
    };
  });
}
