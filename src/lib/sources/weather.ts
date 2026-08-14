import type { InstantAnswer } from "../types";
import { cached, fetchJson } from "../http";
import { titleCase } from "../instant";

type GeoResponse = {
  results?: { name: string; country?: string; latitude: number; longitude: number; timezone?: string }[];
};

type Forecast = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
};

const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

export async function getWeather(place: string): Promise<InstantAnswer | null> {
  return cached(`wx:${place.toLowerCase()}`, 10 * 60_000, async () => {
    try {
      const geo = await fetchJson<GeoResponse>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`,
        {},
        5000,
      );
      const loc = geo.results?.[0];
      if (!loc) return null;
      const wx = await fetchJson<Forecast>(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
          `&current=temperature_2m,weather_code,wind_speed_10m`,
        {},
        5000,
      );
      const tempC = wx.current?.temperature_2m;
      if (tempC == null) return null;
      const code = wx.current?.weather_code ?? 0;
      return {
        kind: "weather",
        place: loc.country ? `${loc.name}, ${loc.country}` : titleCase(loc.name),
        tempC: Math.round(tempC),
        tempF: Math.round((tempC * 9) / 5 + 32),
        condition: WMO[code] ?? "Conditions unavailable",
        windKmh: Math.round(wx.current?.wind_speed_10m ?? 0),
      };
    } catch {
      return null;
    }
  });
}
