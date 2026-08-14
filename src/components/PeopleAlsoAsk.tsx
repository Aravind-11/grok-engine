"use client";

import { useState } from "react";
import type { PeopleAlsoAsk as Item } from "@/lib/types";

export function PeopleAlsoAsk({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!items.length) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-medium">People also ask</h2>
      <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)]">
        {items.map((item, i) => {
          const expanded = open === i;
          return (
            <div key={item.question}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
              >
                <span>{item.question}</span>
                <span className="text-[var(--faint)]">{expanded ? "–" : "+"}</span>
              </button>
              {expanded && (
                <p className="px-4 pb-4 text-sm leading-relaxed text-[var(--muted)]">{item.answer}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
