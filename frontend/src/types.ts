import type { RoverSpec } from "./rovers";

// Shapes the panels expect. Placeholder only: the backend will fill these later.

// One entry from GET /sites.
export interface Preset {
  name: string;
  lat: number;
  lon: number; // degrees east
}

export interface SiteInput {
  name: string;
  lat: number;
  lon: number;
  startDate: string; // YYYY-MM-DD
  days: number;
  stepHours: number;
  rover?: RoverSpec; // left out, the backend uses VIPER
}

export interface Metrics {
  powerW: number | null;
  whPerDay: number | null;
  pctSunlit: number | null;
  longestNightH: number | null;
  batteryMinWh: number | null;
  survives: boolean | null;
  earthClearanceDeg: number | null;
  pctEarthVisible: number | null;
  longestBlackoutH: number | null;
  nextSunset: string | null;
  nextEarthset: string | null;
  pctPowerAndComms: number | null;
}

export const EMPTY_METRICS: Metrics = {
  powerW: null,
  whPerDay: null,
  pctSunlit: null,
  longestNightH: null,
  batteryMinWh: null,
  survives: null,
  earthClearanceDeg: null,
  pctEarthVisible: null,
  longestBlackoutH: null,
  nextSunset: null,
  nextEarthset: null,
  pctPowerAndComms: null,
};

// What POST /analyze returns. Arrays run over the time steps unless noted.
export interface Analysis {
  site: { lat: number; lon: number; heightM: number; mastM: number };
  times: string[]; // ISO UTC
  stepHours: number;
  rover: { solarW: number; batteryWh: number; loadW: number }; // the numbers the analysis used
  skyline: { az: number[]; el: number[] }; // 720 values, one every half degree
  sun: { az: number[]; el: number[]; fraction: number[]; behindEarth: number[] };
  earth: { az: number[]; el: number[]; margin: number[] };
  powerW: number[];
  batteryWh: number[];
  comms: ("blocked" | "marginal" | "clear")[];
  metrics: Metrics;
}

export interface PinnedSite {
  site: SiteInput;
  metrics: Metrics;
}

// GET /terrain: a north-up height grid around a site for the 2D map.
export interface TerrainGrid {
  lat: number;
  lon: number;
  size: number; // cells per side
  spacingM: number; // metres between neighbouring cells
  sourceM: number; // pixel size of the elevation map behind the heights (20 m polar or ~474 m global)
  heights: number[]; // metres, row by row from the north edge, west to east
}
