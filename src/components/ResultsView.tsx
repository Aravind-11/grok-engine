import Link from "next/link";
import type { SearchResponse, Tab } from "@/lib/types";
import { formatNewsDate } from "@/lib/sources/news";
import { InstantCard } from "./InstantCard";
import { KnowledgePanel } from "./KnowledgePanel";
import { Logo } from "./Logo";
import { OverviewCard } from "./OverviewCard";
import { PeopleAlsoAsk } from "./PeopleAlsoAsk";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "news", label: "News" },
  { id: "videos", label: "Videos" },
];

function hrefFor(query: string, tab: Tab, page = 1) {
  const params = new URLSearchParams({ q: query, tab });
  if (page > 1) params.set("page", String(page));
  return `/search?${params.toString()}`;
}

export function ResultsView({ data }: { data: SearchResponse }) {
  const { query, tab } = data;

  return (
    <div className="starfield min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="hidden sm:block">
            <Logo size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <SearchBox initialQuery={query} />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/about" className="hidden text-sm text-[var(--muted)] hover:text-[var(--text)] sm:inline">
              About
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <Link
                key={item.id}
                href={hrefFor(query, item.id)}
                className={`border-b-2 px-3 py-2.5 text-sm ${
                  active
                    ? "border-[var(--accent)] text-[var(--text)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main
        className={`mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-6 ${
          tab === "all" && data.knowledge ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""
        }`}
      >
        <div className="min-w-0 max-w-full overflow-hidden">
          <p className="mb-4 text-xs text-[var(--faint)]">
            About {Math.max(data.resultCount, data.results.length)} results ({(data.tookMs / 1000).toFixed(2)} seconds)
          </p>

          {tab === "all" && data.instant && <InstantCard answer={data.instant} />}

          {tab === "all" && data.overview && (
            <OverviewCard
              query={query}
              initialText={data.overview.text}
              pending={data.overview.pending}
              knowledge={data.knowledge}
              results={data.results}
            />
          )}

          {tab === "all" && data.images.length > 0 && (
            <section className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm text-[var(--muted)]">Images</h2>
                <Link href={hrefFor(query, "images")} className="text-sm text-[var(--link)] hover:underline">
                  More images
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {data.images.slice(0, 6).map((img) => (
                  <a
                    key={img.thumb}
                    href={img.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-lg bg-[var(--bg-elev)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumb} alt={img.title} className="h-20 w-full object-cover" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {tab === "all" && data.news.length > 0 && (
            <section className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm text-[var(--muted)]">Top stories</h2>
                <Link href={hrefFor(query, "news")} className="text-sm text-[var(--link)] hover:underline">
                  More news
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {data.news.slice(0, 3).map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 hover:border-[var(--accent)]"
                  >
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {item.source}
                      {item.publishedAt ? ` · ${formatNewsDate(item.publishedAt)}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            </section>
          )}

          {tab === "all" && (
            <>
              {data.results.length === 0 ? (
                data.instant || data.news.length || data.images.length ? null : <Empty query={query} />
              ) : (
                <ol className="space-y-7">
                  {data.results.map((result) => (
                    <li key={result.url}>
                      <a href={result.url} target="_blank" rel="noreferrer" className="group block">
                        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={result.favicon} alt="" width={16} height={16} className="rounded-sm" />
                          <span>{result.displayUrl}</span>
                        </div>
                        <h3 className="link-title mt-1 text-xl leading-snug">{result.title}</h3>
                      </a>
                      <p className="snippet mt-1 text-sm leading-relaxed text-[var(--muted)]">{result.snippet}</p>
                    </li>
                  ))}
                </ol>
              )}

              <PeopleAlsoAsk items={data.peopleAlsoAsk} />
              <Pager data={data} />
            </>
          )}

          {tab === "images" && (
            data.images.length ? (
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
                {data.images.map((img) => (
                  <a
                    key={img.thumb}
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-3 block break-inside-avoid overflow-hidden rounded-xl bg-[var(--bg-elev)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumb} alt={img.title} className="w-full object-cover" />
                    <p className="px-2 py-2 text-xs text-[var(--muted)]">{img.title}</p>
                  </a>
                ))}
              </div>
            ) : (
              <Empty query={query} kind="images" />
            )
          )}

          {tab === "news" && (
            data.news.length ? (
              <ol className="space-y-5">
                {data.news.map((item) => (
                  <li key={item.url} className="border-b border-[var(--line)] pb-5">
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <p className="text-xs text-[var(--muted)]">
                        {item.source}
                        {item.publishedAt ? ` · ${formatNewsDate(item.publishedAt)}` : ""}
                      </p>
                      <h3 className="link-title mt-1 text-xl">{item.title}</h3>
                    </a>
                    {item.snippet && (
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.snippet}</p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <Empty query={query} kind="news" />
            )
          )}

          {tab === "videos" && (
            data.videos.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.videos.map((video) => (
                  <a
                    key={video.videoId}
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={video.thumb} alt="" className="aspect-video w-full object-cover" />
                    <div className="p-3">
                      <h3 className="font-medium leading-snug">{video.title}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{video.source}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <Empty query={query} kind="videos" />
            )
          )}

          {data.related.length > 0 && tab !== "images" && (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-medium">Related searches</h2>
              <div className="flex flex-wrap gap-2">
                {data.related.map((item) => (
                  <Link
                    key={item}
                    href={hrefFor(item, tab)}
                    className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="hidden lg:block">
          {tab === "all" && data.knowledge && <KnowledgePanel data={data.knowledge} />}
        </div>

        {tab === "all" && data.knowledge && (
          <div className="lg:hidden">
            <KnowledgePanel data={data.knowledge} />
          </div>
        )}
      </main>
    </div>
  );
}

function Empty({ query, kind = "pages" }: { query: string; kind?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-[var(--muted)]">
      No {kind} found for “{query}”. Try a shorter query or another spelling.
    </div>
  );
}

function Pager({ data }: { data: SearchResponse }) {
  if (data.results.length < 8 && data.page === 1) return null;
  return (
    <div className="mt-10 flex items-center gap-3">
      {data.page > 1 && (
        <Link
          href={hrefFor(data.query, "all", data.page - 1)}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm hover:border-[var(--accent)]"
        >
          Previous
        </Link>
      )}
      <span className="text-sm text-[var(--faint)]">Page {data.page}</span>
      {data.results.length >= 8 && (
        <Link
          href={hrefFor(data.query, "all", data.page + 1)}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm hover:border-[var(--accent)]"
        >
          Next
        </Link>
      )}
    </div>
  );
}
