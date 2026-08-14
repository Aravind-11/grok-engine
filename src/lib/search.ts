import { buildExtractiveOverview } from "./ai";
import { applyCrawl, crawlExpand } from "./crawl";
import { cached, clampQuery, withTimeout } from "./http";
import { definitionQuery, tryCalc, tryConvert, tryTime, weatherPlace } from "./instant";
import { isRelevant, parseQuery, type ParsedQuery } from "./query";
import { rankAndDedupe } from "./rank";
import { searchBingMany } from "./sources/bing";
import { searchWeb, searchWebMany, suggest } from "./sources/ddg";
import { displayPath, faviconFor, hostnameOf } from "./http";
import { defineWord } from "./sources/dictionary";
import { searchHn } from "./sources/hn";
import { searchImages } from "./sources/images";
import { searchNews } from "./sources/news";
import { searchVideos } from "./sources/videos";
import { getWeather } from "./sources/weather";
import { getKnowledge, wikiAsResults, wikiSearch } from "./sources/wikipedia";
import type { InstantAnswer, PeopleAlsoAsk, SearchResponse, Tab, WebResult } from "./types";

export const PAGE_SIZE = 20;

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

async function relatedSearches(query: string, parsed: ParsedQuery): Promise<string[]> {
  const [ac, wiki] = await Promise.all([
    withTimeout(suggest(parsed.search), 2500, [] as string[]),
    withTimeout(wikiSearch(parsed.search, 12), 2500, [] as { title: string; snippet: string }[]),
  ]);
  const out: string[] = [];
  const seen = new Set([query.toLowerCase()]);
  for (const item of [...ac, ...wiki.map((w) => w.title)]) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    if (parsed.contentTokens.length && !isRelevant(parsed.contentTokens, item)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 12) break;
  }
  return out;
}

function peopleAlsoAsk(
  query: string,
  parsed: ParsedQuery,
  knowledge: SearchResponse["knowledge"],
  wiki: { title: string; snippet: string }[],
): PeopleAlsoAsk[] {
  const items: PeopleAlsoAsk[] = [];
  if (parsed.intent === "local" && parsed.place) {
    const topic = parsed.topic || "places";
    if (parsed.localKind === "poi") {
      items.push(
        {
          question: `Where is ${topic} in ${parsed.place}?`,
          answer: `Check official ${topic} location pages and maps in the results for pods or lots in ${parsed.place}.`,
        },
        {
          question: `How do I reserve ${topic} near ${parsed.place}?`,
          answer: `Open the official app or site from the results to see live availability around ${parsed.place}.`,
        },
      );
      return items;
    }
    items.push(
      {
        question: `What are the best ${topic} in ${parsed.place}?`,
        answer: `See the guides and lists below for current ${topic} in ${parsed.place}.`,
      },
      {
        question: `Where should I go for ${topic} in ${parsed.place}?`,
        answer: `Neighborhood guides, critic lists, and review sites in the results are the most reliable starting points.`,
      },
    );
    return items;
  }
  if (knowledge?.extract && isRelevant(parsed.contentTokens, knowledge.title, knowledge.extract)) {
    items.push({
      question: `What is ${knowledge.title}?`,
      answer: knowledge.extract,
    });
  }
  for (const row of wiki) {
    if (!row.snippet) continue;
    if (knowledge && row.title === knowledge.title) continue;
    if (!isRelevant(parsed.contentTokens, row.title, row.snippet)) continue;
    items.push({
      question: `What is ${row.title}?`,
      answer: row.snippet,
    });
    if (items.length >= 8) break;
  }
  if (!items.length) {
    items.push({
      question: `What is ${query}?`,
      answer: `Open the results below for current pages about ${query}.`,
    });
  }
  return items.slice(0, 8);
}

type Gathered = Omit<SearchResponse, "page" | "results" | "resultCount"> & {
  allResults: WebResult[];
};

async function gather(query: string, tab: Tab): Promise<Gathered> {
  const started = Date.now();
  const wantAll = tab === "all";
  const parsed = parseQuery(query);
  const lookup = parsed.search;

  const instantP = resolveInstant(query);
  const knowledgeP =
    wantAll || tab === "images" ? withTimeout(getKnowledge(lookup, parsed), 4500, null) : Promise.resolve(null);
  const variants =
    parsed.intent === "local" && parsed.place
      ? Array.from(
          new Set(
            parsed.localKind === "poi"
              ? [lookup, `${parsed.topic || lookup} locations ${parsed.place}`, `${lookup} los angeles`]
              : [lookup, `best ${lookup}`, query],
          ),
        )
      : [lookup];
  const localSites =
    parsed.intent === "local" && parsed.place
      ? parsed.localKind === "poi"
        ? [parsed.brandHost ? `${parsed.brand} ${parsed.place} site:${parsed.brandHost}` : "", `${lookup} site:maps.google.com`]
            .filter(Boolean)
        : ["yelp.com", "eater.com", "infatuation.com", "timeout.com", "tripadvisor.com"].map(
            (site) => `${lookup} site:${site}`,
          )
      : [];
  const webP =
    tab === "all"
      ? Promise.all(
          [...variants, ...localSites].map((v) => withTimeout(searchWebMany(v, v.includes("site:") ? 1 : 3), 8000, [])),
        ).then((rows) => rows.flat())
      : Promise.resolve([]);
  const bingP =
    tab === "all"
      ? Promise.all(variants.map((v) => withTimeout(searchBingMany(v), 8000, []))).then((rows) => rows.flat())
      : Promise.resolve([]);
  const hnP =
    tab === "all" && parsed.intent !== "local" ? withTimeout(searchHn(lookup), 4500, []) : Promise.resolve([]);
  const wikiP =
    parsed.intent === "local" && parsed.localKind === "dining"
      ? Promise.resolve([])
      : withTimeout(wikiAsResults(parsed.brand || lookup, parsed), 5000, []);
  const wikiRawP =
    parsed.intent === "local" && parsed.localKind === "dining"
      ? Promise.resolve([])
      : withTimeout(wikiSearch(parsed.brand || lookup, 12), 4500, []);
  const imagesP =
    tab === "all" || tab === "images"
      ? withTimeout(searchImages(parsed.image, tab === "images" ? 48 : 12), 7000, []).then((rows) => {
          const topicBits = parsed.contentTokens.filter(
            (t) => t !== "los" && t !== "angeles" && !(parsed.place ?? "").includes(t),
          );
          const filtered = rows.filter((img) => {
            if (parsed.brand && !img.title.toLowerCase().includes(parsed.brand)) return false;
            return isRelevant(topicBits.length ? topicBits : parsed.contentTokens, img.title);
          });
          const picked = (filtered.length ? filtered : parsed.brand ? [] : rows).slice(0, tab === "images" ? 48 : 12);
          return picked;
        })
      : Promise.resolve([]);
  const newsP =
    tab === "all" || tab === "news"
      ? withTimeout(searchNews(lookup, tab === "news" ? 40 : 8), 7000, []).then((rows) => {
          const filtered = parsed.brand
            ? rows.filter((row) => isRelevant([parsed.brand!], row.title, row.snippet))
            : rows;
          return (filtered.length ? filtered : parsed.localKind === "poi" ? [] : rows).slice(
            0,
            tab === "news" ? 40 : 6,
          );
        })
      : Promise.resolve([]);
  const videosP =
    tab === "videos" || tab === "all"
      ? withTimeout(searchVideos(lookup), 9000, [])
      : Promise.resolve([]);
  const relatedP = relatedSearches(query, parsed);

  const [instant, knowledge, web, bing, hn, wiki, wikiRaw, images, news, videos, related] = await Promise.all([
    instantP,
    knowledgeP,
    webP,
    bingP,
    hnP,
    wikiP,
    wikiRawP,
    imagesP,
    newsP,
    videosP,
    relatedP,
  ]);

  if (!web.length && !bing.length && instant && (instant.kind === "weather" || instant.kind === "time")) {
    const place = instant.kind === "weather" ? instant.place.split(",")[0] : instant.place;
    const extra = await withTimeout(searchWebMany(place, 2), 6000, []);
    web.push(...extra);
  }

  const newsAsWeb =
    parsed.intent === "local"
      ? news.map((item) => ({
          title: item.title,
          url: item.url,
          displayUrl: displayPath(item.url),
          snippet: item.snippet || item.source,
          favicon: faviconFor(item.url),
          source: hostnameOf(item.url),
        }))
      : [];
  const seed = [...web, ...bing, ...hn, ...wiki, ...newsAsWeb];
  let pool = seed;

  if (wantAll && seed.length) {
    const { enriched, discovered } = await withTimeout(
      crawlExpand(lookup, seed, 14),
      7000,
      { enriched: new Map(), discovered: [] as Omit<WebResult, "score">[] },
    );
    const extra = discovered.filter((row) => isRelevant(parsed.contentTokens, row.title, row.url, row.snippet));
    pool = [...applyCrawl(seed, enriched), ...extra];
  }

  const merged = rankAndDedupe(lookup, pool, parsed);

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
      ? buildExtractiveOverview(query, knowledge, merged.slice(0, 8), parsed)
      : null;

  return {
    query,
    tab,
    tookMs: Date.now() - started,
    instant: finalInstant,
    knowledge,
    images,
    news,
    videos: videos.slice(0, tab === "videos" ? 24 : 6),
    related,
    peopleAlsoAsk: tab === "all" ? peopleAlsoAsk(query, parsed, knowledge, wikiRaw) : [],
    overview,
    allResults: merged,
  };
}

export async function runSearch(rawQuery: string, tab: Tab = "all", page = 1): Promise<SearchResponse> {
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

  const gathered = await cached(`search:v9:${tab}:${query}`, 45_000, () => gather(query, tab));
  const start = (safePage - 1) * PAGE_SIZE;
  const { allResults, ...rest } = gathered;

  return {
    ...rest,
    page: safePage,
    results: allResults.slice(start, start + PAGE_SIZE),
    resultCount: allResults.length,
  };
}
