import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Home from "@/app/page";
import { ResultsView } from "@/components/ResultsView";
import { runSearch } from "@/lib/search";
import { isTab } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Props = {
  searchParams: Promise<{ q?: string; tab?: string; page?: string; lucky?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q?.trim() ? q : "Grok Engine" };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  if (!q) return <Home />;

  const tab = isTab(params.tab) ? params.tab : "all";
  const page = Number(params.page ?? "1");
  const data = await runSearch(q, tab, page);

  if (params.lucky === "1") {
    const dest = data.results[0]?.url ?? data.knowledge?.url;
    if (dest) redirect(dest);
  }

  return <ResultsView data={data} />;
}
