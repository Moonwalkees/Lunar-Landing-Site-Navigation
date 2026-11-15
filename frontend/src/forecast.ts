// useForecast (ticket 7.7): per-cell change in power or comms over the next few time steps.
// Computed in forecast.worker.ts; the last answer stays up until the next one arrives.

import { useEffect, useRef, useState } from "react";
import type { ForecastBody } from "./forecastCore";
import type { ReplyMessage, RequestMessage, SetupMessage } from "./forecast.worker";
import type { Analysis, TerrainGrid } from "./types";

export type { ForecastBody };

// Arrays hold one value per cell, row by row from the north edge.
export interface Forecast {
  body: ForecastBody;
  early: boolean; // early-warning field (see marginField) in place of power / comms
  rough: boolean; // half-resolution preview, shown while the timeline is moving
  size: number; // cells per side of the arrays: the grid's, or about half of it when rough
  index: number;
  steps: number; // k, or fewer at the end of the window
  hours: number;
  now: Float32Array; // 0 to 1
  delta: Float32Array; // V(index + steps) - now
  deltaAt: Uint8Array; // steps after index by which half of that change has happened
  dip: Float32Array; // min over the span - now, always <= 0
  dipAt: Uint8Array; // steps after index at which the minimum falls
}

export interface ForecastState {
  forecast: Forecast | null; // may be for an earlier step while pending
  pending: boolean;
  failed: boolean;
}

const IDLE: ForecastState = { forecast: null, pending: false, failed: false };

// How long the timeline must be still before the sharp field is asked for.
const SETTLE_MS = 200;

// body null turns it off. grid and analysis must be for the same site.
export function useForecast(
  grid: TerrainGrid | null,
  analysis: Analysis | null,
  index: number,
  k: number,
  body: ForecastBody | null,
  early = false,
): ForecastState {
  const [state, setState] = useState<ForecastState>(IDLE);
  const worker = useRef<Worker | null>(null);
  const latest = useRef(0);
  const stepHours = useRef(1);
  const active = body !== null && grid !== null && analysis !== null;

  useEffect(() => {
    if (!active) return;
    let w: Worker;
    try {
      w = new Worker(new URL("./forecast.worker.ts", import.meta.url), { type: "module" });
    } catch (e) {
      console.error("The forecast worker could not start:", e);
      setState({ forecast: null, pending: false, failed: true });
      return;
    }
    w.onmessage = ({ data }: MessageEvent<ReplyMessage>) => {
      if (data.id !== latest.current) return; // stale reply
      const { id: _id, i, ...rest } = data;
      // Still pending after a rough answer: the sharp one follows.
      setState({ forecast: { ...rest, index: i, hours: rest.steps * stepHours.current }, pending: rest.rough, failed: false });
    };
    w.onerror = (e) => {
      console.error("The forecast worker failed:", e.message);
      setState({ forecast: null, pending: false, failed: true });
    };
    worker.current = w;
    return () => {
      w.terminate();
      worker.current = null;
      latest.current++;
      setState(IDLE);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !worker.current) return;
    stepHours.current = analysis.stepHours;
    const message: SetupMessage = {
      type: "setup",
      grid: { size: grid.size, spacingM: grid.spacingM, heights: grid.heights },
      tracks: {
        sunAz: analysis.sun.az,
        sunEl: analysis.sun.el,
        behindEarth: analysis.sun.behindEarth,
        earthAz: analysis.earth.az,
        earthEl: analysis.earth.el,
        mastM: analysis.site.mastM,
      },
    };
    worker.current.postMessage(message);
    setState((s) => (s.forecast ? { ...s, forecast: null } : s));
  }, [active, grid, analysis]);

  // Must stay after the setup effect: on a new site the worker needs the setup first.
  useEffect(() => {
    if (!active || !worker.current) return;
    // Rough at once, so the map follows the scrubber; sharp once nothing has changed for a moment.
    const ask = (rough: boolean) => {
      const message: RequestMessage = { type: "request", id: ++latest.current, body, i: index, k, early, rough };
      worker.current?.postMessage(message);
    };
    ask(true);
    const settle = setTimeout(() => ask(false), SETTLE_MS);
    setState((s) => (s.pending ? s : { ...s, pending: true }));
    return () => clearTimeout(settle);
  }, [active, grid, analysis, index, k, body, early]);

  return state;
}
