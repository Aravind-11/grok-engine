export default function Loading() {
  return (
    <div className="starfield min-h-screen px-6 py-10">
      <div className="mx-auto max-w-3xl animate-pulse space-y-6">
        <div className="h-11 rounded-full bg-[var(--bg-elev)]" />
        <div className="h-4 w-40 rounded bg-[var(--bg-elev)]" />
        <div className="h-28 rounded-2xl bg-[var(--bg-elev)]" />
        <div className="space-y-4">
          <div className="h-16 rounded bg-[var(--bg-elev)]" />
          <div className="h-16 rounded bg-[var(--bg-elev)]" />
          <div className="h-16 rounded bg-[var(--bg-elev)]" />
        </div>
      </div>
    </div>
  );
}
