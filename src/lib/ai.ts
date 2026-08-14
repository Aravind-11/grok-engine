import { isRelevant, type ParsedQuery } from "./query";
import type { KnowledgePanel, WebResult } from "./types";

function extractiveOverview(
  query: string,
  knowledge: KnowledgePanel | null,
  results: WebResult[],
  parsed?: ParsedQuery,
): string {
  const tokens = parsed?.contentTokens ?? [];
  if (
    knowledge?.extract &&
    (!tokens.length || isRelevant(tokens, knowledge.title, knowledge.description, knowledge.extract))
  ) {
    return knowledge.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
  }
  const top = results
    .filter((r) => r.snippet && (!tokens.length || isRelevant(tokens, r.title, r.snippet)))
    .slice(0, 4);
  if (!top.length) return "";
  if (parsed?.intent === "local" && parsed.place) {
    const titles = top.map((r) => r.title.replace(/\s+[-|].*$/, "")).slice(0, 4);
    const label = parsed.localKind === "poi" ? "Locations" : "Guides";
    return `${label} for ${parsed.topic || query} in ${parsed.place}: ${titles.join("; ")}.`;
  }
  return top.map((r) => r.snippet).join(" ");
}

export function buildExtractiveOverview(
  query: string,
  knowledge: KnowledgePanel | null,
  results: WebResult[],
  parsed?: ParsedQuery,
) {
  const text = extractiveOverview(query, knowledge, results, parsed);
  if (!text) return null;
  return {
    text,
    source: "extractive" as const,
    pending: Boolean(process.env.XAI_API_KEY),
  };
}

export async function grokOverview(
  query: string,
  knowledge: KnowledgePanel | null,
  results: WebResult[],
): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) return extractiveOverview(query, knowledge, results);

  const sources = results
    .slice(0, 6)
    .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`)
    .join("\n\n");

  const input = [
    `Write a concise web-search overview for: ${query}`,
    `Use only the sources. 2–4 sentences, then up to 3 short bullets.`,
    `Plain text. No preamble. No invented facts.`,
    knowledge ? `Knowledge card: ${knowledge.title}. ${knowledge.extract}` : "",
    `Sources:\n${sources || "(none)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4.6",
      input,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`xAI ${res.status} ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };

  if (data.output_text?.trim()) return data.output_text.trim();

  const chunks =
    data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((c) => c.type === "output_text" || c.text)
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? "";

  return chunks || extractiveOverview(query, knowledge, results);
}
