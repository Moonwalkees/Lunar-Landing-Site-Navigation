// Shapes the panels expect. Placeholder only: the backend will fill these later.

export interface SiteInput {
  name: string;
  lat: number;
  lon: number;
  startDate: string; // YYYY-MM-DD
  days: number;
  stepHours: number;
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

export interface PinnedSite {
  site: SiteInput;
  metrics: Metrics;
}
