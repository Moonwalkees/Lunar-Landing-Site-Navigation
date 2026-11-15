// Pure helpers for the board UI (doc/style.md). Every value here is derived from POST /analyze.

import type { Analysis } from "../types";

export interface BoardSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  custom: boolean;
}

export interface MissionWindow {
  startDate: string; // YYYY-MM-DD
  days: number;
  stepHours: number;
}

export type SiteResult =
  | { status: "loading"; key: string }
  | { status: "ready"; key: string; analysis: Analysis }
  | { status: "error"; key: string; error: string };

// One analysis covers one site over one window. A result is stale when this key changes.
export const resultKey = (s: BoardSite, w: MissionWindow) =>
  [s.lat, s.lon, w.startDate, w.days, w.stepHours].join("|");

// ---------- state words (doc/style.md > Status words) ----------

export type State = "both" | "sunonly" | "comms" | "dark";
export const STATE_LABEL: Record<State, string> = {
  both: "LIT·AOS",
  sunonly: "LIT·LOS",
  comms: "DARK·AOS",
  dark: "DARK·LOS",
};

// Lit: any of the Sun's disc above the skyline. AOS: Earth not blocked (marginal still counts).
export const isLit = (a: Analysis, i: number) => (a.sun.fraction[i] ?? 0) > 0;
export const isAos = (a: Analysis, i: number) => a.comms[i] !== undefined && a.comms[i] !== "blocked";

export function stateAt(a: Analysis, i: number): State {
  const lit = isLit(a, i), aos = isAos(a, i);
  return lit && aos ? "both" : lit ? "sunonly" : aos ? "comms" : "dark";
}

// ---------- score ----------

// The board's ranking score, 0-100: 40% sunlit time, 30% Earth-visible time, 30% time with both.
// Weights come from the approved mock (doc/style.md > Board); inputs are the backend's metrics.
export function score(a: Analysis): number | null {
  const { pctSunlit, pctEarthVisible, pctPowerAndComms } = a.metrics;
  if (pctSunlit === null || pctEarthVisible === null || pctPowerAndComms === null) return null;
  return Math.round(0.4 * pctSunlit + 0.3 * pctEarthVisible + 0.3 * pctPowerAndComms);
}

export type SortKey = "score" | "sun" | "com" | "both";

export interface Row {
  site: BoardSite;
  result: SiteResult | undefined;
  analysis: Analysis | null;
  score: number | null;
  state: State | null;
}

// Ranked rows. Sites without an analysis yet sink to the bottom in their original order.
export function rankRows(rows: Row[], key: SortKey): Row[] {
  const value = (r: Row): number | null => {
    const m = r.analysis?.metrics;
    if (!m) return null;
    switch (key) {
      case "score": return r.score;
      case "sun": return m.pctSunlit;
      case "com": return m.pctEarthVisible;
      case "both": return m.pctPowerAndComms;
    }
  };
  return rows
    .map((r, order) => ({ r, order, v: value(r) }))
    .sort((a, b) => (a.v === null ? (b.v === null ? a.order - b.order : 1) : b.v === null ? -1 : b.v - a.v || a.order - b.order))
    .map((x) => x.r);
}

// ---------- 6-hour cells for the dot chart and the dock (doc/style.md > Dot chart, Time dock) ----------

export const CELL_HOURS = 6;
export const cellSteps = (stepHours: number) => Math.max(1, Math.round(CELL_HOURS / stepHours));

export interface Cells {
  steps: number; // analysis time steps per cell
  sun: boolean[];
  earth: boolean[];
  both: boolean[];
  power: number[]; // mean W over the cell
  battery: number[]; // mean Wh over the cell
}

// A cell is on when the condition holds for at least half of its steps.
export function toCells(a: Analysis): Cells {
  const steps = cellSteps(a.stepHours);
  const n = a.times.length;
  const out: Cells = { steps, sun: [], earth: [], both: [], power: [], battery: [] };
  for (let s = 0; s < n; s += steps) {
    const e = Math.min(n, s + steps);
    let sun = 0, earth = 0, both = 0, power = 0, battery = 0;
    for (let i = s; i < e; i++) {
      const l = isLit(a, i), c = isAos(a, i);
      sun += +l; earth += +c; both += +(l && c);
      power += a.powerW[i] ?? 0; battery += a.batteryWh[i] ?? 0;
    }
    const k = e - s;
    out.sun.push(sun / k >= 0.5);
    out.earth.push(earth / k >= 0.5);
    out.both.push(both / k >= 0.5);
    out.power.push(power / k);
    out.battery.push(battery / k);
  }
  return out;
}

// ---------- geometry ----------

const RAD = Math.PI / 180;
export const MOON_RADIUS_M = 1737400;

// Where `to` lies from `from` on the surface, in metres east and north (azimuthal equidistant,
// the same projection as the GET /terrain grid).
export function offsetM(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const p1 = from.lat * RAD, p2 = to.lat * RAD, dl = (to.lon - from.lon) * RAD;
  const cosArc = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  const arc = Math.acos(Math.min(1, Math.max(-1, cosArc)));
  const bearing = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  const d = arc * MOON_RADIUS_M;
  return { east: d * Math.sin(bearing), north: d * Math.cos(bearing) };
}

// ---------- formatting ----------

// A site name and its trailing qualifier: "Peak near Shackleton (Artemis III, 2022)" gives
// ["Peak near Shackleton", "Artemis III" + newline + "2022 list"], one part per line (a bare year is
// NASA's list of that year). The board shows the qualifier as a small tag, so the name fits its column.
export function splitName(name: string): [string, string | null] {
  const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(name);
  if (!m) return [name, null];
  const parts = m[2].split(/,\s*/).map((p) => (/^\d{4}$/.test(p) ? p + " list" : p));
  return [m[1], parts.join("\n")];
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toFixed(1));
export const hours = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Math.round(v) + "h");
export const stamp = (iso: string | undefined) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");
export const signedDeg = (v: number | undefined) =>
  v === undefined ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2).padStart(5, "0") + "°";
export const azDeg = (v: number | undefined) =>
  v === undefined ? "—" : (((v % 360) + 360) % 360).toFixed(1).padStart(5, "0") + "°";
