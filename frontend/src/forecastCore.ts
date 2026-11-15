// Forecast overlay maths (ticket 7.7). No React or worker API, so the worker and Node can both use it.

import { commsField, powerField } from "./terrain2d";
import type { TerrainGrid } from "./types";

export type ForecastBody = "power" | "comms";

export type ForecastGrid = Pick<TerrainGrid, "size" | "spacingM" | "heights">;

// Per time step, degrees, as seen from the site (POST /analyze).
export interface ForecastTracks {
  sunAz: ArrayLike<number>;
  sunEl: ArrayLike<number>;
  behindEarth: ArrayLike<number>;
  earthAz: ArrayLike<number>;
  earthEl: ArrayLike<number>;
  mastM: number;
}

// One value per cell, row by row from the north edge.
export interface ForecastArrays {
  now: Float32Array; // V(i), 0 to 1
  delta: Float32Array; // V(i + steps) - V(i)
  dip: Float32Array; // min(V[i..i+steps]) - V(i), always <= 0
  dipAt: Uint8Array; // steps after i at which that minimum first falls
}

// k, cut short at the last step. Capped at 255 because dipAt is a byte.
export function forecastSteps(i: number, k: number, stepCount: number): number {
  return Math.max(0, Math.min(Math.floor(k), stepCount - 1 - i, 255));
}

// LRU cache of per-step fields. Neighbouring windows overlap, so one step on costs one new frame.
export class FrameCache {
  private frames = new Map<string, Float32Array>();
  private grid: ForecastGrid;
  private tracks: ForecastTracks;
  private capacity: number;
  computed = 0;

  constructor(grid: ForecastGrid, tracks: ForecastTracks, capacity = 40) {
    this.grid = grid;
    this.tracks = tracks;
    this.capacity = capacity;
  }

  has(body: ForecastBody, step: number): boolean {
    return this.frames.has(body + ":" + step);
  }

  // The returned array is shared with the cache: read-only.
  frame(body: ForecastBody, step: number): Float32Array {
    const key = body + ":" + step;
    const hit = this.frames.get(key);
    if (hit) {
      this.frames.delete(key);
      this.frames.set(key, hit);
      return hit;
    }
    const t = this.tracks, grid = this.grid as TerrainGrid;
    const made = body === "power"
      ? powerField(grid, { az: t.sunAz[step], el: t.sunEl[step] }, t.behindEarth[step], t.mastM)
      : commsField(grid, { az: t.earthAz[step], el: t.earthEl[step] }, t.mastM);
    this.computed++;
    this.frames.set(key, made);
    if (this.frames.size > this.capacity) this.frames.delete(this.frames.keys().next().value!);
    return made;
  }
}

// frames[0] is now, the last one is the far end of the window.
export function combine(frames: Float32Array[]): ForecastArrays {
  const first = frames[0], last = frames[frames.length - 1], n = first.length;
  const now = Float32Array.from(first);
  const delta = new Float32Array(n), dip = new Float32Array(n), dipAt = new Uint8Array(n);
  for (let c = 0; c < n; c++) delta[c] = last[c] - first[c];
  // dip holds the running minimum, then becomes the difference from now.
  dip.set(first);
  for (let s = 1; s < frames.length; s++) {
    const f = frames[s];
    for (let c = 0; c < n; c++) {
      if (f[c] < dip[c]) {
        dip[c] = f[c];
        dipAt[c] = s;
      }
    }
  }
  for (let c = 0; c < n; c++) dip[c] -= first[c];
  return { now, delta, dip, dipAt };
}
