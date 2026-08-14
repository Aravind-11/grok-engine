import { NextResponse } from "next/server";
import { clampQuery } from "@/lib/http";
import { runSearch } from "@/lib/search";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = clampQuery(searchParams.get("q"));
  if (!q) return NextResponse.redirect(new URL("/", req.url));
  const data = await runSearch(q, "all", 1);
  const dest = data.results[0]?.url ?? data.knowledge?.url;
  return NextResponse.redirect(dest || new URL(`/search?q=${encodeURIComponent(q)}`, req.url));
}
