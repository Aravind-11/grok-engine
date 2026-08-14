import { NextResponse } from "next/server";
import { runSearch } from "@/lib/search";
import { isTab } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const tab = searchParams.get("tab") ?? "all";
  const page = Number(searchParams.get("page") ?? "1");
  const data = await runSearch(q, isTab(tab) ? tab : "all", page);
  return NextResponse.json(data);
}
