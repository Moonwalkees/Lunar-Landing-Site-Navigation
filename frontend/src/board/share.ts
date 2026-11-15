import { CUSTOM_ROVER, DEFAULT_ROVER, ROVER_PRESETS, ROVER_RULES, type RoverSpec } from "../rovers";
import type { MissionWindow } from "./data";

// A link that opens the board on one site, mission window, rover and time (ticket 8.1). Plain
// query parameters, so the link is readable and needs nothing stored on a server:
//   site, lat, lon       the site: a preset when lat/lon match one, otherwise added as a custom site
//   start, days, step    the mission window
//   solar, batt, use     the rover's three numbers (W, Wh, W)
//   t                    the time step
// BoardApp reads them once at load, then takes them out of the address bar.

const KEYS = ["site", "lat", "lon", "start", "days", "step", "solar", "batt", "use", "t"];

export interface Shared {
  site: { name: string; lat: number; lon: number } | null;
  window: { startDate: string; days: number; stepHours: number } | null;
  rover: RoverSpec | null;
  t: number | null;
}

export function shareUrl(site: { name: string; lat: number; lon: number }, win: MissionWindow, t: number): string {
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  const p = u.searchParams;
  p.set("ui", "board");
  p.set("site", site.name);
  p.set("lat", String(site.lat));
  p.set("lon", String(site.lon));
  p.set("start", win.startDate);
  p.set("days", String(win.days));
  p.set("step", String(win.stepHours));
  p.set("solar", String(win.rover.solarW));
  p.set("batt", String(win.rover.batteryWh));
  p.set("use", String(win.rover.loadW));
  p.set("t", String(t));
  return u.toString();
}

// What a link asks for. Each part is checked with the same rules as the forms; a part that
// fails is left out (null) and the board uses its usual default for it.
export function readShared(search: string): Shared | null {
  const p = new URLSearchParams(search);
  if (!KEYS.some((k) => p.has(k))) return null;
  const num = (k: string) => {
    const v = p.get(k);
    return v === null || v.trim() === "" ? NaN : Number(v);
  };

  const lat = num("lat"), lon = num("lon");
  const site = lat >= -90 && lat <= 90 && Number.isFinite(lon)
    ? { name: (p.get("site") ?? "").trim().slice(0, 80) || "Shared site", lat, lon }
    : null;

  const start = p.get("start") ?? "", days = num("days"), step = num("step");
  const window = /^\d{4}-\d{2}-\d{2}$/.test(start) && days > 0 && days <= 400 && step > 0 && step <= 24
    ? { startDate: start, days, stepHours: step }
    : null;

  const solarW = num("solar"), batteryWh = num("batt"), loadW = num("use");
  let rover: RoverSpec | null = null;
  if (ROVER_RULES.solarW.ok(solarW) && ROVER_RULES.batteryWh.ok(batteryWh) && ROVER_RULES.loadW.ok(loadW)) {
    const preset = ROVER_PRESETS.find((r) => r.solarW === solarW && r.batteryWh === batteryWh && r.loadW === loadW);
    rover = preset ? { name: preset.name, solarW, batteryWh, loadW } : { name: CUSTOM_ROVER, solarW, batteryWh, loadW };
  }

  const t = num("t");
  return { site, window, rover, t: Number.isInteger(t) && t >= 0 ? t : null };
}

// The board's window for a link: its window and rover where given, the defaults otherwise.
export function sharedWindow(s: Shared | null, fallback: MissionWindow): MissionWindow {
  return { ...fallback, ...(s?.window ?? {}), rover: s?.rover ?? fallback.rover ?? DEFAULT_ROVER };
}

// Same place on the Moon: within about 2 m, with longitudes compared round the circle.
export function samePlace(a: { lat: number; lon: number }, b: { lat: number; lon: number }): boolean {
  const dLon = Math.abs((((a.lon - b.lon) % 360) + 540) % 360 - 180);
  return Math.abs(a.lat - b.lat) < 1e-4 && dLon < 1e-4;
}

// Take the link's parameters out of the address bar, so a reload doesn't apply them again
// over whatever the user has changed since. Other parameters (?ui=) stay.
export function clearShared(): void {
  const u = new URL(window.location.href);
  if (!KEYS.some((k) => u.searchParams.has(k))) return;
  for (const k of KEYS) u.searchParams.delete(k);
  history.replaceState(history.state, "", u);
}
