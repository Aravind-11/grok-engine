import { NextResponse } from "next/server";
import { clampQuery } from "@/lib/http";
import { suggest } from "@/lib/sources/ddg";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = clampQuery(searchParams.get("q"));
  const items = q ? await suggest(q).catch(() => []) : [];
  return NextResponse.json([q, items]);
}
