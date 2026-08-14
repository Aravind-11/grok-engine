import type { KnowledgeFact } from "../types";
import { cached, fetchJson, withTimeout } from "../http";

const LABELS: Record<string, string> = {
  P31: "Type",
  P571: "Founded",
  P577: "Published",
  P569: "Born",
  P570: "Died",
  P19: "Birthplace",
  P27: "Citizenship",
  P106: "Occupation",
  P39: "Position",
  P108: "Employer",
  P169: "CEO",
  P112: "Founded by",
  P159: "Headquarters",
  P17: "Country",
  P36: "Capital",
  P856: "Website",
  P1082: "Population",
  P2046: "Area",
  P2048: "Height",
  P2067: "Mass",
  P2218: "Net worth",
  P452: "Industry",
  P127: "Owned by",
  P361: "Part of",
  P50: "Author",
  P57: "Director",
  P175: "Performer",
  P86: "Composer",
  P170: "Creator",
};

type Entity = {
  labels?: { en?: { value?: string } };
  claims?: Record<string, Claim[]>;
};

type Claim = {
  mainsnak?: {
    datatype?: string;
    datavalue?: {
      type?: string;
      value?: unknown;
    };
  };
};

type EntitiesResponse = { entities?: Record<string, Entity> };

function timeValue(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const time = (raw as { time?: string }).time;
  if (!time) return null;
  const m = time.match(/^([+-]?\d+)-(\d{2})-(\d{2})/);
  if (!m) return time;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month === 0) return String(Math.abs(year)) + (year < 0 ? " BCE" : "");
  const d = new Date(Date.UTC(Math.abs(year), Math.max(0, month - 1), Math.max(1, day)));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function quantityValue(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const amount = Number((raw as { amount?: string }).amount);
  if (!Number.isFinite(amount)) return null;
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
}

export async function wikidataFacts(qid: string): Promise<KnowledgeFact[]> {
  return withTimeout(
    cached(`wd:${qid}`, 6 * 60 * 60_000, async () => {
      const url =
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}` +
        `&props=labels|claims&languages=en&format=json`;
      const data = await fetchJson<EntitiesResponse>(url, {}, 4000);
      const entity = data.entities?.[qid];
      if (!entity?.claims) return [];

      const wanted = Object.keys(LABELS);
      const refIds = new Set<string>();
      const rawFacts: { label: string; raw: string; needsLabel: boolean }[] = [];

      for (const pid of wanted) {
        const claim = entity.claims[pid]?.[0]?.mainsnak;
        if (!claim?.datavalue) continue;
        const { type, value } = claim.datavalue;
        if (type === "wikibase-entityid" && value && typeof value === "object" && "id" in value) {
          const id = String((value as { id: string }).id);
          refIds.add(id);
          rawFacts.push({ label: LABELS[pid], raw: id, needsLabel: true });
        } else if (type === "time") {
          const t = timeValue(value);
          if (t) rawFacts.push({ label: LABELS[pid], raw: t, needsLabel: false });
        } else if (type === "quantity") {
          const q = quantityValue(value);
          if (q) rawFacts.push({ label: LABELS[pid], raw: q, needsLabel: false });
        } else if (type === "string" || type === "url" || type === "monolingualtext") {
          const text =
            typeof value === "string"
              ? value
              : value && typeof value === "object" && "text" in value
                ? String((value as { text: string }).text)
                : "";
          if (text) rawFacts.push({ label: LABELS[pid], raw: text.replace(/^https?:\/\//, ""), needsLabel: false });
        }
      }

      let labels: Record<string, string> = {};
      if (refIds.size) {
        const ids = [...refIds].slice(0, 20).join("|");
        const labUrl =
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}` +
          `&props=labels&languages=en&format=json`;
        const labData = await fetchJson<EntitiesResponse>(labUrl, {}, 4000);
        labels = Object.fromEntries(
          Object.entries(labData.entities ?? {}).map(([id, e]) => [id, e.labels?.en?.value ?? id]),
        );
      }

      const facts: KnowledgeFact[] = [];
      const seen = new Set<string>();
      for (const fact of rawFacts) {
        const value = fact.needsLabel ? (labels[fact.raw] ?? fact.raw) : fact.raw;
        const key = `${fact.label}:${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        facts.push({ label: fact.label, value });
        if (facts.length >= 8) break;
      }
      return facts;
    }),
    2500,
    [],
  );
}
