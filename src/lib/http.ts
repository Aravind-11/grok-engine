const UA = "GrokEngine/1.0 (local meta-search; educational)";

const cache = new Map<string, { exp: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function ttlFor(data: unknown, ttlMs: number): number {
  if (Array.isArray(data) && data.length === 0) return Math.min(ttlMs, 8_000);
  if (data == null) return Math.min(ttlMs, 8_000);
  return ttlMs;
}

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.data as T);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const run = fn()
    .then((data) => {
      cache.set(key, { exp: Date.now() + ttlFor(data, ttlMs), data });
      if (cache.size > 400) {
        const now = Date.now();
        for (const [k, v] of cache) {
          if (v.exp < now) cache.delete(k);
        }
      }
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, run);
  return run;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = 7000,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        "Api-User-Agent": UA,
        Accept: "*/*",
        ...init.headers,
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 7000,
): Promise<T> {
  const text = await fetchText(
    url,
    {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    },
    timeoutMs,
  );
  return JSON.parse(text) as T;
}

export function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function stripTags(value: string): string {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function displayPath(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean).slice(0, 3);
    return parts.length ? `${host} › ${parts.map((p) => decodeURIComponent(p)).join(" › ")}` : host;
  } catch {
    return url;
  }
}

export function faviconFor(url: string): string {
  const host = hostnameOf(url);
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

export function clampQuery(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
}
