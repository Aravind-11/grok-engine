import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SearchBox } from "@/components/SearchBox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trendingQueries } from "@/lib/sources/trending";

export const dynamic = "force-dynamic";

export default async function Home() {
  const trending = await trendingQueries();

  return (
    <div className="starfield flex min-h-screen flex-col">
      <header className="flex items-center justify-end gap-3 px-4 py-4">
        <Link href="/about" className="hidden text-sm text-[var(--muted)] hover:text-[var(--text)] sm:inline">
          About
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-24 pt-10 sm:pt-20">
        <Logo size="lg" />
        <p className="mt-5 max-w-md text-center text-[var(--muted)]">
          Search the web. Get the answer.
        </p>
        <div className="mt-10 w-full">
          <div className="mx-auto flex justify-center">
            <SearchBox size="hero" autoFocus />
          </div>
        </div>

        <section className="mt-14 w-full max-w-xl">
          <h2 className="mb-3 text-center text-[11px] uppercase tracking-[0.22em] text-[var(--faint)]">
            Trending now
          </h2>
          <div className="flex max-w-full flex-wrap justify-center gap-2">
            {trending.map((item) => (
              <Link
                key={item}
                href={`/search?q=${encodeURIComponent(item)}`}
                className="max-w-full rounded-full border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                {item}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] px-5 py-4 text-center text-xs text-[var(--faint)]">
        Grok Engine · a local meta-search · press / to search
      </footer>
    </div>
  );
}
