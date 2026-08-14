import type { InstantAnswer } from "../types";
import { cached, fetchJson } from "../http";

type DictEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string }[];
  }[];
};

export async function defineWord(word: string): Promise<InstantAnswer | null> {
  return cached(`def:${word.toLowerCase()}`, 24 * 60 * 60_000, async () => {
    try {
      const data = await fetchJson<DictEntry[] | { title?: string }>(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        {},
        5000,
      );
      if (!Array.isArray(data) || !data[0]) return null;
      const entry = data[0];
      const meaning = entry.meanings?.[0];
      const def = meaning?.definitions?.[0];
      if (!def?.definition) return null;
      return {
        kind: "define",
        word: entry.word ?? word,
        phonetic: entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text,
        partOfSpeech: meaning?.partOfSpeech ?? "word",
        definition: def.definition,
        example: def.example,
      };
    } catch {
      return null;
    }
  });
}
