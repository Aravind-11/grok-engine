import type { KnowledgePanel as Knowledge } from "@/lib/types";

export function KnowledgePanel({ data }: { data: Knowledge }) {
  return (
    <aside className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-5">
      {data.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.thumbnail}
          alt=""
          className="mb-4 h-40 w-full rounded-xl object-cover"
        />
      )}
      <h2 className="font-serif text-2xl leading-tight">{data.title}</h2>
      {data.description && (
        <p className="mt-1 text-sm text-[var(--muted)]">{data.description}</p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">{data.extract}</p>
      {data.facts.length > 0 && (
        <dl className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
          {data.facts.map((fact) => (
            <div key={fact.label} className="grid grid-cols-[96px_1fr] gap-2 text-sm">
              <dt className="text-[var(--muted)]">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <a
        href={data.url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-sm text-[var(--link)] hover:underline"
      >
        Wikipedia
      </a>
    </aside>
  );
}
