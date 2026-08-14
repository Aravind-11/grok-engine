import type { InstantAnswer } from "@/lib/types";

export function InstantCard({ answer }: { answer: InstantAnswer }) {
  return (
    <section className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-5">
      {answer.kind === "calc" && (
        <div>
          <p className="text-sm text-[var(--muted)]">{answer.expression} =</p>
          <p className="mt-1 font-serif text-5xl tracking-tight">{answer.result}</p>
        </div>
      )}
      {answer.kind === "convert" && (
        <div>
          <p className="text-sm text-[var(--muted)]">
            {answer.fromValue} {answer.fromUnit} =
          </p>
          <p className="mt-1 font-serif text-5xl tracking-tight">
            {answer.toValue}{" "}
            <span className="text-2xl text-[var(--muted)]">{answer.toUnit}</span>
          </p>
        </div>
      )}
      {answer.kind === "define" && (
        <div>
          <p className="font-serif text-3xl italic">{answer.word}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {answer.phonetic} · {answer.partOfSpeech}
          </p>
          <p className="mt-3 leading-relaxed">{answer.definition}</p>
          {answer.example && (
            <p className="mt-2 text-sm italic text-[var(--muted)]">“{answer.example}”</p>
          )}
        </div>
      )}
      {answer.kind === "time" && (
        <div>
          <p className="text-sm text-[var(--muted)]">Time in {answer.place}</p>
          <p className="mt-1 font-serif text-5xl tracking-tight">{answer.time}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {answer.date} · {answer.tz}
          </p>
        </div>
      )}
      {answer.kind === "weather" && (
        <div>
          <p className="text-sm text-[var(--muted)]">{answer.place}</p>
          <p className="mt-1 font-serif text-5xl tracking-tight">
            {answer.tempC}°
            <span className="ml-2 text-2xl text-[var(--muted)]">{answer.tempF}°F</span>
          </p>
          <p className="mt-2 text-[var(--muted)]">
            {answer.condition} · wind {answer.windKmh} km/h
          </p>
        </div>
      )}
    </section>
  );
}
