"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialQuery?: string;
  size?: "hero" | "bar";
  autoFocus?: boolean;
};

export function SearchBox({ initialQuery = "", size = "bar", autoFocus }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    function onSlash(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as [string, string[]];
        setItems(Array.isArray(data[1]) ? data[1] : []);
        setActive(-1);
      } catch {
        /* ignore */
      }
    }, 120);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(value = q, lucky = false) {
    const term = value.trim();
    if (!term) return;
    setOpen(false);
    router.push(lucky ? `/lucky?q=${encodeURIComponent(term)}` : `/search?q=${encodeURIComponent(term)}`);
  }

  const wide = size === "hero";

  return (
    <form
      ref={boxRef}
      action="/search"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        go(active >= 0 ? items[active] : q);
      }}
      className={`relative w-full ${wide ? "max-w-[640px]" : "max-w-[720px]"}`}
    >
      <div className={`search-shell flex items-center gap-3 rounded-full px-4 ${wide ? "h-14" : "h-11"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--faint)]">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16.5L20.5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(-1, i - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
          }}
          placeholder="Search the web"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && items.length > 0}
          className="h-full w-full bg-transparent text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setQ("");
              setItems([]);
              inputRef.current?.focus();
            }}
            className="text-[var(--faint)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        )}
      </div>

      {open && items.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] py-2 shadow-[var(--shadow)]"
        >
          {items.map((item, i) => (
            <li key={item}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                  i === active ? "bg-[var(--bg-hover)]" : ""
                }`}
              >
                <span className="text-[var(--faint)]">⌕</span>
                <span>{item}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {wide && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-ink)] transition hover:brightness-110"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => go(q, true)}
            className="rounded-full border border-[var(--line)] bg-[var(--bg-elev)] px-5 py-2.5 text-sm text-[var(--text)] transition hover:border-[var(--accent)]"
          >
            I&apos;m Feeling Lucky
          </button>
        </div>
      )}
    </form>
  );
}
