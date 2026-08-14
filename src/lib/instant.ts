import type { InstantAnswer } from "./types";

const FUNCTIONS: Record<string, (n: number) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  const src = expr.replace(/\s+/g, "");
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if ("+-*/^%(),".includes(ch)) {
      tokens.push(ch);
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      tokens.push(src.slice(i, j));
      i = j;
      continue;
    }
    if (/[a-z]/i.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[a-z]/i.test(src[j])) j += 1;
      tokens.push(src.slice(i, j).toLowerCase());
      i = j;
      continue;
    }
    throw new Error("bad char");
  }
  return tokens;
}

function evalTokens(tokens: string[]): number {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (t?: string) => {
    if (t && tokens[pos] !== t) throw new Error("expected " + t);
    return tokens[pos++];
  };

  const parsePrimary = (): number => {
    const t = peek();
    if (t === "(") {
      eat("(");
      const v = parseAdd();
      eat(")");
      return v;
    }
    if (t === "-") {
      eat("-");
      return -parsePrimary();
    }
    if (t === "+") {
      eat("+");
      return parsePrimary();
    }
    if (t === "pi") {
      eat();
      return Math.PI;
    }
    if (t === "e") {
      eat();
      return Math.E;
    }
    if (t && FUNCTIONS[t]) {
      const fn = FUNCTIONS[t];
      eat();
      eat("(");
      const v = parseAdd();
      eat(")");
      return fn(v);
    }
    if (t && /^[0-9.]+$/.test(t)) {
      eat();
      const n = Number(t);
      if (!Number.isFinite(n)) throw new Error("bad number");
      return n;
    }
    throw new Error("bad primary");
  };

  const parsePow = (): number => {
    let left = parsePrimary();
    while (peek() === "^") {
      eat("^");
      left = left ** parsePrimary();
    }
    return left;
  };

  const parseMul = (): number => {
    let left = parsePow();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = eat();
      const right = parsePow();
      if (op === "*") left *= right;
      else if (op === "/") left /= right;
      else left %= right;
    }
    return left;
  };

  const parseAdd = (): number => {
    let left = parseMul();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      const right = parseMul();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const value = parseAdd();
  if (pos !== tokens.length) throw new Error("trailing");
  if (!Number.isFinite(value)) throw new Error("nan");
  return value;
}

function formatNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  const s = n.toPrecision(12).replace(/\.?0+$/, "");
  return s;
}

const PERCENT_OF = /^(?:what(?:'s| is)\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:of|×|x)\s*(\d+(?:\.\d+)?)\??$/i;
const MATHY =
  /^(?:what(?:'s| is)\s+)?([0-9a-z.+*/^%()\s,-]+(?:sqrt|sin|cos|tan|log|ln|abs|pi|e)[0-9a-z.+*/^%()\s,-]*|[0-9.+*/^%()\s-]+)=?\??$/i;

export function tryCalc(query: string): InstantAnswer | null {
  const q = query.trim();
  const pct = q.match(PERCENT_OF);
  if (pct) {
    const a = Number(pct[1]);
    const b = Number(pct[2]);
    return {
      kind: "calc",
      expression: `${pct[1]}% of ${pct[2]}`,
      result: formatNumber((a / 100) * b),
    };
  }
  if (!MATHY.test(q) || !/[+\-*/^%=]|sqrt|sin|cos|tan|log|ln/.test(q)) return null;
  const cleaned = q
    .replace(/^what(?:'s| is)\s+/i, "")
    .replace(/=?\??$/, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .trim();
  if (cleaned.length < 3) return null;
  try {
    const result = evalTokens(tokenize(cleaned));
    return { kind: "calc", expression: cleaned, result: formatNumber(result) };
  } catch {
    return null;
  }
}

type UnitTable = Record<string, { dim: string; toBase: number; aliases: string[] }>;

const UNIT_TABLE: UnitTable = {
  m: { dim: "length", toBase: 1, aliases: ["meter", "meters", "metre", "metres"] },
  km: { dim: "length", toBase: 1000, aliases: ["kilometer", "kilometers", "kilometre", "kilometres"] },
  cm: { dim: "length", toBase: 0.01, aliases: ["centimeter", "centimeters"] },
  mm: { dim: "length", toBase: 0.001, aliases: ["millimeter", "millimeters"] },
  mi: { dim: "length", toBase: 1609.344, aliases: ["mile", "miles"] },
  ft: { dim: "length", toBase: 0.3048, aliases: ["foot", "feet"] },
  in: { dim: "length", toBase: 0.0254, aliases: ["inch", "inches"] },
  yd: { dim: "length", toBase: 0.9144, aliases: ["yard", "yards"] },
  kg: { dim: "mass", toBase: 1, aliases: ["kilogram", "kilograms"] },
  g: { dim: "mass", toBase: 0.001, aliases: ["gram", "grams"] },
  lb: { dim: "mass", toBase: 0.45359237, aliases: ["lbs", "pound", "pounds"] },
  oz: { dim: "mass", toBase: 0.028349523125, aliases: ["ounce", "ounces"] },
  t: { dim: "mass", toBase: 1000, aliases: ["tonne", "tonnes", "metric ton"] },
  l: { dim: "volume", toBase: 1, aliases: ["liter", "liters", "litre", "litres"] },
  ml: { dim: "volume", toBase: 0.001, aliases: ["milliliter", "milliliters"] },
  gal: { dim: "volume", toBase: 3.785411784, aliases: ["gallon", "gallons"] },
  qt: { dim: "volume", toBase: 0.946352946, aliases: ["quart", "quarts"] },
  cup: { dim: "volume", toBase: 0.2365882365, aliases: ["cups"] },
  s: { dim: "time", toBase: 1, aliases: ["sec", "second", "seconds"] },
  min: { dim: "time", toBase: 60, aliases: ["minute", "minutes"] },
  h: { dim: "time", toBase: 3600, aliases: ["hr", "hour", "hours"] },
  day: { dim: "time", toBase: 86400, aliases: ["days"] },
  kph: { dim: "speed", toBase: 1, aliases: ["km/h", "kmh"] },
  mph: { dim: "speed", toBase: 1.609344, aliases: ["mi/h"] },
};

const TEMP: Record<string, string[]> = {
  C: ["c", "celsius", "°c"],
  F: ["f", "fahrenheit", "°f"],
  K: ["k", "kelvin"],
};

function lookupUnit(name: string): { key: string; dim: string; toBase: number } | null {
  const n = name.toLowerCase().replace(/s$/, "");
  for (const [key, meta] of Object.entries(UNIT_TABLE)) {
    if (key === name.toLowerCase() || key === n || meta.aliases.some((a) => a === name.toLowerCase() || a.replace(/s$/, "") === n)) {
      return { key, dim: meta.dim, toBase: meta.toBase };
    }
  }
  return null;
}

function lookupTemp(name: string): "C" | "F" | "K" | null {
  const n = name.toLowerCase().replace("°", "");
  for (const [k, aliases] of Object.entries(TEMP)) {
    if (aliases.includes(n) || aliases.includes(name.toLowerCase())) return k as "C" | "F" | "K";
  }
  return null;
}

function convertTemp(value: number, from: "C" | "F" | "K", to: "C" | "F" | "K"): number {
  let c = value;
  if (from === "F") c = (value - 32) * (5 / 9);
  if (from === "K") c = value - 273.15;
  if (to === "C") return c;
  if (to === "F") return c * (9 / 5) + 32;
  return c + 273.15;
}

const CONVERT_RE =
  /^(\d+(?:\.\d+)?)\s*([a-z°/]+)\s+(?:to|in|into)\s+([a-z°/]+)$/i;

export function tryConvert(query: string): InstantAnswer | null {
  const q = query.replace(/^convert\s+/i, "").trim();
  const m = q.match(CONVERT_RE);
  if (!m) return null;
  const value = Number(m[1]);
  const fromT = lookupTemp(m[2]);
  const toT = lookupTemp(m[3]);
  if (fromT && toT) {
    return {
      kind: "convert",
      fromValue: value,
      fromUnit: fromT === "C" ? "°C" : fromT === "F" ? "°F" : "K",
      toValue: Number(convertTemp(value, fromT, toT).toFixed(2)),
      toUnit: toT === "C" ? "°C" : toT === "F" ? "°F" : "K",
    };
  }
  const from = lookupUnit(m[2]);
  const to = lookupUnit(m[3]);
  if (!from || !to || from.dim !== to.dim) return null;
  const converted = (value * from.toBase) / to.toBase;
  return {
    kind: "convert",
    fromValue: value,
    fromUnit: from.key,
    toValue: Number(Number(converted.toPrecision(6)).toString()),
    toUnit: to.key,
  };
}

const TIMEZONES: Record<string, string> = {
  tokyo: "Asia/Tokyo",
  london: "Europe/London",
  paris: "Europe/Paris",
  berlin: "Europe/Berlin",
  nyc: "America/New_York",
  "new york": "America/New_York",
  "los angeles": "America/Los_Angeles",
  la: "America/Los_Angeles",
  chicago: "America/Chicago",
  denver: "America/Denver",
  seattle: "America/Los_Angeles",
  miami: "America/New_York",
  toronto: "America/Toronto",
  mexico: "America/Mexico_City",
  "mexico city": "America/Mexico_City",
  sao: "America/Sao_Paulo",
  "sao paulo": "America/Sao_Paulo",
  sydney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  auckland: "Pacific/Auckland",
  dubai: "Asia/Dubai",
  singapore: "Asia/Singapore",
  "hong kong": "Asia/Hong_Kong",
  shanghai: "Asia/Shanghai",
  beijing: "Asia/Shanghai",
  seoul: "Asia/Seoul",
  mumbai: "Asia/Kolkata",
  delhi: "Asia/Kolkata",
  "new delhi": "Asia/Kolkata",
  kolkata: "Asia/Kolkata",
  istanbul: "Europe/Istanbul",
  moscow: "Europe/Moscow",
  cairo: "Africa/Cairo",
  johannesburg: "Africa/Johannesburg",
  lagos: "Africa/Lagos",
  utc: "UTC",
  gmt: "UTC",
};

export function tryTime(query: string): InstantAnswer | null {
  const m = query.trim().match(/^(?:what(?:'s| is)\s+the\s+)?time(?:\s+in\s+|\s+at\s+)(.+?)\??$/i);
  if (!m) return null;
  const place = m[1].trim().toLowerCase().replace(/[.,]/g, "");
  const tz = TIMEZONES[place];
  if (!tz) return null;
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  return { kind: "time", place: titleCase(place), time, date, tz };
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const DEFINE_RE = /^(?:define|definition of|meaning of|what does)\s+(.+?)(?:\s+mean)?\??$/i;

export function definitionQuery(query: string): string | null {
  const m = query.trim().match(DEFINE_RE);
  if (m) return m[1].trim();
  if (/^[a-z][a-z-]{2,22}$/i.test(query.trim()) && !/^(who|what|where|when|why|how|the|and)$/i.test(query.trim())) {
    return query.trim();
  }
  return null;
}

const WEATHER_RE = /^(?:weather|forecast|temperature)(?:\s+in\s+|\s+for\s+)(.+?)\??$/i;

export function weatherPlace(query: string): string | null {
  const m = query.trim().match(WEATHER_RE);
  return m ? m[1].trim() : null;
}
