// Forecast overlay maths (ticket 7.7). No React or worker API, so the worker and Node can both use it.

import { commsField, marginField, powerField } from "./terrain2d";
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
  deltaAt: Uint8Array; // steps after i by which half of that change has happened
  dip: Float32Array; // min(V[i..i+steps]) - V(i), always <= 0
  dipAt: Uint8Array; // steps after i at which that minimum first falls
}

// k, cut short at the last step. Capped at 255 because dipAt is a byte.
export function forecastSteps(i: number, k: number, stepCount: number): number {
  return Math.max(0, Math.min(Math.floor(k), stepCount - 1 - i, 255));
}

// Early warning counts ground within this many degrees of the horizon (see marginField).
export const EARLY_BAND_DEG = 3;

// The time steps a window i..i+steps is sampled at: both ends, plus multiples of a stride in
// between so no window needs more than maxFrames fields. Sampling on multiples (not i + j*stride)
// means the next window reuses them: one step on costs at most two new frames.
// A dip shorter than the stride can be missed on long windows.
export function sampleSteps(i: number, steps: number, maxFrames = 13): number[] {
  const stride = Math.max(1, Math.ceil(steps / (maxFrames - 1)));
  const out = [i];
  for (let t = (Math.floor(i / stride) + 1) * stride; t < i + steps; t += stride) out.push(t);
  if (steps > 0) out.push(i + steps);
  return out;
}

// LRU cache of per-step fields. Neighbouring windows overlap, so one step on costs one new frame.
export class FrameCache {
  private frames = new Map<string, Float32Array>();
  private grid: ForecastGrid;
  private tracks: ForecastTracks;
  private capacity: number;
  computed = 0;

  constructor(grid: ForecastGrid, tracks: ForecastTracks, capacity = 64) {
    this.grid = grid;
    this.tracks = tracks;
    this.capacity = capacity;
  }

  has(body: ForecastBody, step: number, early = false): boolean {
    return this.frames.has(body + (early ? ":e:" : ":") + step);
  }

  // The returned array is shared with the cache: read-only.
  frame(body: ForecastBody, step: number, early = false): Float32Array {
    const key = body + (early ? ":e:" : ":") + step;
    const hit = this.frames.get(key);
    if (hit) {
      this.frames.delete(key);
      this.frames.set(key, hit);
      return hit;
    }
    const t = this.tracks, grid = this.grid as TerrainGrid;
    const sun = { az: t.sunAz[step], el: t.sunEl[step] }, earth = { az: t.earthAz[step], el: t.earthEl[step] };
    const made = early
      ? marginField(grid, body === "power" ? sun : earth, EARLY_BAND_DEG, t.mastM)
      : body === "power"
        ? powerField(grid, sun, t.behindEarth[step], t.mastM)
        : commsField(grid, earth, t.mastM);
    this.computed++;
    this.frames.set(key, made);
    if (this.frames.size > this.capacity) this.frames.delete(this.frames.keys().next().value!);
    return made;
  }
}

// frames[0] is now, the last one is the far end of the window. offsets[s] is how many steps
// after now frames[s] is; left out, frames are one step apart.
export function combine(frames: Float32Array[], offsets?: number[]): ForecastArrays {
  const first = frames[0], last = frames[frames.length - 1], n = first.length;
  const now = Float32Array.from(first);
  const delta = new Float32Array(n), dip = new Float32Array(n), dipAt = new Uint8Array(n);
  for (let c = 0; c < n; c++) delta[c] = last[c] - first[c];
  // Walk back from the end: the last overwrite is the earliest frame already halfway to the final
  // value. The final frame always qualifies.
  const deltaAt = new Uint8Array(n);
  for (let s = frames.length - 1; s >= 1; s--) {
    const f = frames[s], at = offsets ? offsets[s] : s;
    for (let c = 0; c < n; c++) {
      const d = delta[c];
      if (d !== 0 && (f[c] - first[c]) * (d < 0 ? -1 : 1) >= 0.5 * Math.abs(d)) deltaAt[c] = at;
    }
  }
  // dip holds the running minimum, then becomes the difference from now.
  dip.set(first);
  for (let s = 1; s < frames.length; s++) {
    const f = frames[s];
    for (let c = 0; c < n; c++) {
      if (f[c] < dip[c]) {
        dip[c] = f[c];
        dipAt[c] = offsets ? offsets[s] : s;
      }
    }
  }
  for (let c = 0; c < n; c++) dip[c] -= first[c];
  return { now, delta, deltaAt, dip, dipAt };
}
