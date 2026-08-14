import Link from "next/link";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale =
    size === "lg" ? "text-7xl sm:text-8xl" : size === "sm" ? "text-3xl" : "text-4xl";
  const engine =
    size === "lg"
      ? "text-[11px] tracking-[0.55em]"
      : size === "sm"
        ? "text-[8px] tracking-[0.42em]"
        : "text-[9px] tracking-[0.48em]";

  return (
    <Link href="/" aria-label="Grok Engine home" className="group inline-flex flex-col items-center no-underline">
      <span className={`relative font-serif italic leading-none text-[var(--text)] ${scale}`}>
        grok
        <span className="absolute -right-2 top-0 text-[0.28em] not-italic text-[var(--accent)]" aria-hidden>
          ✦
        </span>
      </span>
      <span className={`mt-1 font-medium uppercase text-[var(--accent)] ${engine}`}>
        engine
      </span>
    </Link>
  );
}
