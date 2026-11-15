import type { Preset } from "./types";

// The presets themselves come from GET /sites (backend/app/sites.py).
// These are only used before that answers, or if the backend is down.

// Mirrors the first south pole preset in backend/app/sites.py, so the app opens on it offline too.
export const FALLBACK_SITE: Preset = { name: "Connecting Ridge (Artemis III, 2022)", lat: -89.45, lon: 222.7 };

// Always offered last: picking it keeps the typed lat/lon.
export const CUSTOM = "Custom";

// The site the app opens on: the first south pole preset, else the first preset.
export function defaultSite(presets: Preset[]): Preset {
  return presets.find((p) => p.lat <= -80) ?? presets[0] ?? FALLBACK_SITE;
}
