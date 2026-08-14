import { NextResponse } from "next/server";
import { clampQuery } from "@/lib/http";
import { isRelevant, parseQuery } from "@/lib/query";
import { suggest } from "@/lib/sources/ddg";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = clampQuery(searchParams.get("q"));
  if (!q) return NextResponse.json([q, []]);
  const parsed = parseQuery(q);
  const [raw, rewritten] = await Promise.all([
    suggest(q).catch(() => [] as string[]),
    parsed.search !== q ? suggest(parsed.search).catch(() => [] as string[]) : Promise.resolve([] as string[]),
  ]);
  const preferred: string[] = [];
  if (parsed.brand && parsed.place) {
    preferred.push(`${parsed.brand} ${parsed.place}`);
    preferred.push(`${parsed.brand} locations ${parsed.place}`);
    if (parsed.place === "westwood") preferred.push(`${parsed.brand} westwood los angeles`);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of [...preferred, ...rewritten, ...raw]) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    if (parsed.brand && !item.toLowerCase().includes(parsed.brand)) continue;
    if (parsed.contentTokens.length >= 2 && !isRelevant(parsed.contentTokens, item)) continue;
    seen.add(key);
    out.push(item);
  }
  return NextResponse.json([q, out.slice(0, 8)]);
}
