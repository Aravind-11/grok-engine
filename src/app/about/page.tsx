import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="starfield min-h-screen">
      <header className="flex items-center justify-between px-5 py-4">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Home
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="font-serif text-4xl italic">About Grok Engine</h1>
        <p className="mt-4 leading-relaxed text-[var(--muted)]">
          Grok Engine is a local meta-search engine. It looks and behaves like a classic web
          search product: a homepage, ranked results, knowledge cards, images, news, videos,
          instant answers, and related questions.
        </p>
        <p className="mt-4 leading-relaxed text-[var(--muted)]">
          It does not crawl the entire web the way Google does. It fans out to public sources
          on every query, then ranks and presents them:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
          <li>Web results from DuckDuckGo HTML</li>
          <li>Knowledge cards from Wikipedia and Wikidata</li>
          <li>Images from Wikipedia and Wikimedia Commons</li>
          <li>News from Google News RSS</li>
          <li>Videos via YouTube results</li>
          <li>Instant answers for math, units, time, weather, and definitions</li>
          <li>Optional Grok overview when <code className="text-[var(--text)]">XAI_API_KEY</code> is set</li>
        </ul>
        <p className="mt-6 leading-relaxed text-[var(--muted)]">
          Add it as a browser search engine through the OpenSearch description at{" "}
          <code className="text-[var(--text)]">/opensearch.xml</code>.
        </p>
      </main>
    </div>
  );
}
