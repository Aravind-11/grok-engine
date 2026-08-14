import { NextResponse } from "next/server";
import { grokOverview } from "@/lib/ai";
import { clampQuery } from "@/lib/http";
import type { KnowledgePanel, WebResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    knowledge?: KnowledgePanel | null;
    results?: WebResult[];
  };
  const query = clampQuery(body.query);
  if (!query) return NextResponse.json({ text: "", source: "extractive" });

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({
      text: "",
      source: "extractive",
      missingKey: true,
    });
  }

  try {
    const text = await grokOverview(query, body.knowledge ?? null, body.results ?? []);
    return NextResponse.json({ text, source: "grok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "overview failed";
    return NextResponse.json({ text: "", source: "extractive", error: message }, { status: 502 });
  }
}
