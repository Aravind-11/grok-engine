# Grok Engine

Live: [https://grok-engine.vercel.app](https://grok-engine.vercel.app)

A search engine with a Google-like flow: homepage, ranked web results, knowledge cards, images, news, videos, instant answers, and an optional Grok overview.

This is a **meta-search + query-time crawler**, not a from-scratch index of the whole web. Each query fans out to DuckDuckGo, Bing, Wikipedia, and Hacker News, then crawls the top pages for richer snippets and extra links.

## Run

```bash
cd grok-engine
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional AI overviews

Set `XAI_API_KEY` from [console.x.ai](https://console.x.ai) in `.env.local` (local) or in the Vercel project env vars (production). Overviews then use Grok (`grok-4.6`) via `https://api.x.ai/v1`. Without a key, the page still shows a Quick answer built from Wikipedia and top snippets.

## What it searches

| Surface | Source |
| --- | --- |
| Web | DuckDuckGo HTML + Wikipedia |
| Knowledge | Wikipedia + Wikidata |
| Images | Wikipedia page images + Wikimedia Commons |
| News | Google News RSS |
| Videos | YouTube matches |
| Suggest | DuckDuckGo autocomplete |
| Weather | Open-Meteo |
| Definitions | Free Dictionary API |
| Math / units / time | Built in |

## Browser search box

The app ships an OpenSearch description at `/opensearch.xml`. In Chrome/Firefox you can add Grok Engine as a search engine from the address bar while the app is open.
