export type Tab = "all" | "images" | "news" | "videos";

export type WebResult = {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  favicon: string;
  source: string;
  score: number;
};

export type ImageResult = {
  title: string;
  url: string;
  thumb: string;
  sourceUrl: string;
  source: string;
};

export type NewsResult = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
};

export type VideoResult = {
  title: string;
  url: string;
  videoId: string;
  thumb: string;
  snippet: string;
  source: string;
};

export type KnowledgeFact = {
  label: string;
  value: string;
};

export type KnowledgePanel = {
  title: string;
  description: string;
  extract: string;
  url: string;
  thumbnail?: string;
  type?: string;
  facts: KnowledgeFact[];
};

export type InstantAnswer =
  | { kind: "calc"; expression: string; result: string }
  | {
      kind: "define";
      word: string;
      phonetic?: string;
      partOfSpeech: string;
      definition: string;
      example?: string;
    }
  | {
      kind: "convert";
      fromValue: number;
      fromUnit: string;
      toValue: number;
      toUnit: string;
    }
  | { kind: "time"; place: string; time: string; date: string; tz: string }
  | {
      kind: "weather";
      place: string;
      tempC: number;
      tempF: number;
      condition: string;
      windKmh: number;
    };

export type PeopleAlsoAsk = {
  question: string;
  answer: string;
};

export type SearchResponse = {
  query: string;
  tab: Tab;
  page: number;
  tookMs: number;
  instant: InstantAnswer | null;
  knowledge: KnowledgePanel | null;
  results: WebResult[];
  images: ImageResult[];
  news: NewsResult[];
  videos: VideoResult[];
  related: string[];
  peopleAlsoAsk: PeopleAlsoAsk[];
  overview: {
    text: string;
    source: "grok" | "extractive";
    pending: boolean;
  } | null;
  resultCount: number;
};

export function isTab(value: string | undefined): value is Tab {
  return value === "all" || value === "images" || value === "news" || value === "videos";
}
