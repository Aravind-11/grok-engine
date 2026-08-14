"use client";

import { useEffect, useState } from "react";
import type { KnowledgePanel, WebResult } from "@/lib/types";

function renderText(text: string) {
  return text.split("\n").map((line, i) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const content = bullet ? bullet[1] : line;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{part}</span>;
    });
    if (!content.trim()) return <div key={i} className="h-2" />;
    if (bullet) {
      return (
        <li key={i} className="ml-4 list-disc">
          {parts}
        </li>
      );
    }
    return (
      <p key={i} className="leading-relaxed">
        {parts}
      </p>
    );
  });
}

export function OverviewCard({
  query,
  initialText,
  pending,
  knowledge,
  results,
}: {
  query: string;
  initialText: string;
  pending: boolean;
  knowledge: KnowledgePanel | null;
  results: WebResult[];
}) {
  const [text, setText] = useState(initialText);
  const [source, setSource] = useState<"grok" | "extractive">("extractive");
  const [loading, setLoading] = useState(pending);

  useEffect(() => {
    setText(initialText);
    setSource("extractive");
    setLoading(pending);
  }, [query, initialText, pending]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, knowledge, results: results.slice(0, 6) }),
        });
        const data = (await res.json()) as { text?: string; source?: "grok" | "extractive" };
        if (!cancelled && data.text) {
          setText(data.text);
          setSource(data.source ?? "grok");
        }
      } catch {
        /* keep extractive */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, query, knowledge, results]);

  if (!text) return null;

  return (
    <section className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
        <span>✦</span>
        <span>{source === "grok" ? "Grok overview" : "Quick answer"}</span>
        {loading && <span className="normal-case tracking-normal text-[var(--faint)]">refining…</span>}
      </div>
      <div className="space-y-2 break-words text-[15px]">{renderText(text)}</div>
    </section>
  );
}
