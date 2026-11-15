// Shading and shadows for the 2D terrain map (see doc/2d-view.md). Pure functions over the
// GET /terrain grid: row 0 is the north edge, column 0 the west edge, `spacingM` between cells.

import type { TerrainGrid } from "./types";

const MOON_RADIUS_M = 1737400;
const SUN_RADIUS_DEG = 0.267;
const RAD = Math.PI / 180;

// Fixed cartographic light from the north-west: shapes read the right way round (craters as
// hollows) whatever the Sun is doing.
const NORTH_WEST_AZ = 315;

// Unit surface normals per cell (east, north, up), worked out once per grid and reused for every
// Sun position. The slope is exaggerated a little so gentle terrain still reads.
const normalCache = new WeakMap<TerrainGrid, Float32Array>();
function normals(grid: TerrainGrid): Float32Array {
  const hit = normalCache.get(grid);
  if (hit) return hit;
  const { size: n, spacingM: s, heights: h } = grid;
  const exaggerate = 2.5;
  const out = new Float32Array(n * n * 3);
  for (let i = 0; i < n; i++) {
    const up = Math.max(i - 1, 0), down = Math.min(i + 1, n - 1);
    for (let j = 0; j < n; j++) {
      const left = Math.max(j - 1, 0), right = Math.min(j + 1, n - 1);
      const dzEast = ((h[i * n + right] - h[i * n + left]) / ((right - left) * s)) * exaggerate;
      const dzNorth = ((h[up * n + j] - h[down * n + j]) / ((down - up) * s)) * exaggerate;
      const norm = Math.hypot(dzEast, dzNorth, 1);
      const k = (i * n + j) * 3;
      out[k] = -dzEast / norm;
      out[k + 1] = -dzNorth / norm;
      out[k + 2] = 1 / norm;
    }
  }
  normalCache.set(grid, out);
  return out;
}

// Hillshade, 0 (dark) to 1 (bright). With a Sun azimuth, the relief is lit mostly from the Sun so
// slopes agree with the cast shadows, with some north-west light kept so crater shapes don't flip
// into domes when the Sun is in the south. About 1 ms for 241 x 241 once the normals are cached,
// so it follows the scrubber.
export function relief(grid: TerrainGrid, sunAz?: number): Float32Array {
  const nrm = normals(grid);
  const out = new Float32Array(grid.size * grid.size);
  const lights: [number, number][] =
    sunAz === undefined ? [[NORTH_WEST_AZ, 1]] : [[sunAz, 0.65], [NORTH_WEST_AZ, 0.35]];
  // Each light is 30° up. Two lights at most; a missing second one has zero weight.
  const lightEl = 30 * RAD;
  const dir = (az: number) => [
    Math.sin(az * RAD) * Math.cos(lightEl),
    Math.cos(az * RAD) * Math.cos(lightEl),
    Math.sin(lightEl),
  ];
  const [ax, ay, az] = dir(lights[0][0]), wa = lights[0][1];
  const [bx, by, bz] = lights[1] ? dir(lights[1][0]) : [0, 0, 0], wb = lights[1]?.[1] ?? 0;
  // Stretch contrast about flat ground (which shades to sin(lightEl)), so slopes stand out.
  const flat = Math.sin(lightEl), contrast = 1.5, flatTo = 0.55;
  for (let k = 0; k < out.length; k++) {
    const e = nrm[k * 3], nn = nrm[k * 3 + 1], u = nrm[k * 3 + 2];
    const shade = wa * Math.max(0, e * ax + nn * ay + u * az) + wb * Math.max(0, e * bx + nn * by + u * bz);
    out[k] = Math.min(1, Math.max(0, flatTo + (shade - flat) * contrast));
  }
  return out;
}

// Ambient occlusion, about 0.75 (hollow) to 1 (open). Ground lower than its surroundings within
// about 600 m sees less sky, so crater floors and the feet of slopes darken and depth reads.
// Computed once per grid with a box average from a summed-area table.
export function occlusion(grid: TerrainGrid): Float32Array {
  const { size: n, heights: h } = grid;
  const sum = new Float64Array((n + 1) * (n + 1)); // sum[(i+1)(n+1) + j+1] = total of h[0..i][0..j]
  for (let i = 0; i < n; i++) {
    let row = 0;
    for (let j = 0; j < n; j++) {
      row += h[i * n + j];
      sum[(i + 1) * (n + 1) + j + 1] = sum[i * (n + 1) + j + 1] + row;
    }
  }
  const radius = Math.max(2, Math.round(600 / grid.spacingM));
  const out = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - radius), i1 = Math.min(n, i + radius + 1);
    for (let j = 0; j < n; j++) {
      const j0 = Math.max(0, j - radius), j1 = Math.min(n, j + radius + 1);
      const total =
        sum[i1 * (n + 1) + j1] - sum[i0 * (n + 1) + j1] - sum[i1 * (n + 1) + j0] + sum[i0 * (n + 1) + j0];
      const mean = total / ((i1 - i0) * (j1 - j0));
      out[i * n + j] = 0.875 + 0.125 * Math.tanh((h[i * n + j] - mean) / 60);
    }
  }
  return out;
}

// Steps a cell marches itself before handing over to the shared far-field hull. Close in, the
// shared line can pass up to half a cell beside the cell's own ray, which at a grazing Sun is
// enough to cast false shadows, so the near field is followed exactly. Each extra step costs about
// 1 ms on the 241 x 241 grid; past 4 the shadows barely change.
const NEAR_STEPS = 4;

// Tangent of the terrain horizon each cell sees looking along azimuth `az` (degrees), over the
// curved surface, from `eyeM` above the ground; -Infinity where nothing inside the grid lies that
// way.
//
// Near field: each cell marches its own ray for NEAR_STEPS steps.
// Far field: the grid is cut into lines parallel to `az`, one step along the longer axis at a time
// (heights interpolated across), and every cell is served by the line passing nearest to it. Each
// line is swept once from its far (`az`) end, keeping the upper convex hull of the terrain from
// NEAR_STEPS onward; the highest point a cell sees is where its tangent touches that hull, found by
// binary search. That is O(n² log n) for the whole grid at any Sun elevation (BUG-010: the old
// per-cell march was O(n³) at low Sun, ~80 ms at the polar sites).
//
// Curvature: a point d metres ahead sits d²/2R lower. With heights recast as h - x²/2R (x along
// the line), slopes on the recast profile are the true ones minus x0/R, a constant per cell, so
// the hull works on the recast heights and x0/R is added back.
function horizonTangent(grid: TerrainGrid, az: number, eyeM: number): Float32Array {
  const { size: n, spacingM: s, heights: h } = grid;
  const dCol = Math.sin(az * RAD); // toward `az`, in cells
  const dRow = -Math.cos(az * RAD);
  const alongCols = Math.abs(dCol) >= Math.abs(dRow); // each step moves one column (else one row)
  const lead = alongCols ? dCol : dRow;
  const ratio = (alongCols ? dRow : dCol) / Math.abs(lead); // cross-axis cells per step toward `az`
  const stepM = s * Math.hypot(1, ratio);
  const twoR = 2 * MOON_RADIUS_M;

  // Grid index of step q (counted toward `az` from the opposite edge) at cross cell 0, and the
  // index stride from one cross cell to the next.
  const base = new Int32Array(n);
  for (let q = 0; q < n; q++) base[q] = (lead > 0 ? q : n - 1 - q) * (alongCols ? 1 : n);
  const crossStride = alongCols ? n : 1;
  // Height at step q and fractional cross position f, interpolated across.
  const heightAt = (q: number, f: number) => {
    const f0 = f >= n - 1 ? n - 2 : f | 0; // f >= 0 here
    const a = base[q] + f0 * crossStride;
    return h[a] + (h[a + crossStride] - h[a]) * (f - f0);
  };

  const out = new Float32Array(n * n).fill(-Infinity);
  const hullX = new Float64Array(n), hullY = new Float64Array(n);
  const shift = new Int32Array(n);
  for (let q = 0; q < n; q++) shift[q] = Math.round(q * ratio);

  // Line c runs through cross position c + q·ratio; the cell nearest it at step q is c + shift[q].
  for (let c = -(n - 1); c < 2 * n - 1; c++) {
    let top = 0;
    for (let q = n - 1; q >= 0; q--) {
      // Far field: the line's point NEAR_STEPS ahead joins the hull.
      const qf = q + NEAR_STEPS, ff = c + qf * ratio;
      if (qf < n && ff >= 0 && ff <= n - 1) {
        const x = qf * stepM, y = heightAt(qf, ff) - (x * x) / twoR;
        while (top >= 2 && (hullY[top - 1] - y) * (hullX[top - 2] - x) <= (hullY[top - 2] - y) * (hullX[top - 1] - x)) top--;
        hullX[top] = x;
        hullY[top] = y;
        top++;
      }

      const cross = c + shift[q];
      if (cross < 0 || cross >= n) continue;
      const k = base[q] + cross * crossStride;
      const h0 = h[k] + eyeM;
      let best = -Infinity;

      // Near field: this cell's own ray.
      for (let d = 1; d < NEAR_STEPS && q + d < n; d++) {
        const f = cross + d * ratio;
        if (f < 0 || f > n - 1) break;
        const dist = d * stepM;
        const t = (heightAt(q + d, f) - h0 - (dist * dist) / twoR) / dist;
        if (t > best) best = t;
      }

      // Far field: slope from this cell to the hull rises then falls along it; find the peak.
      if (top > 0) {
        const x0 = q * stepM, y0 = h0 - (x0 * x0) / twoR;
        let lo = 0, hi = top - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          // slope(mid) < slope(mid + 1), cross-multiplied (both runs are positive)
          if ((hullY[mid] - y0) * (hullX[mid + 1] - x0) < (hullY[mid + 1] - y0) * (hullX[mid] - x0)) lo = mid + 1;
          else hi = mid;
        }
        const t = (hullY[lo] - y0) / (hullX[lo] - x0) + x0 / MOON_RADIUS_M;
        if (t > best) best = t;
      }
      out[k] = best;
    }
  }
  return out;
}

// Terrain horizon elevation in degrees each cell sees looking along azimuth `az`, over the curved

export function horizonToward(grid: TerrainGrid, az: number, eyeM = 0): Float32Array {
  const tan = horizonTangent(grid, az, eyeM);
  for (let k = 0; k < tan.length; k++) tan[k] = tan[k] === -Infinity ? -90 : Math.atan(tan[k]) / RAD;
  return tan;
}

// Clearance in degrees of a distant body (Sun or Earth, at `az` / `el` as seen from the site at
// the centre of the grid) above each cell's horizon, seen from `eyeM` above the ground. The body
// stands a little higher for cells nearer to it than the site and lower for those further away,
// because the ground tilts with the Moon's curvature.
function clearance(grid: TerrainGrid, az: number, el: number, eyeM: number): Float32Array {
  const n = grid.size, s = grid.spacingM;
  const out = horizonToward(grid, az, eyeM);
  const dCol = Math.sin(az * RAD), dRow = -Math.cos(az * RAD);
  const centre = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const towardM = ((j - centre) * dCol - (i - centre) * dRow) * s;
      out[i * n + j] = el + (towardM / MOON_RADIUS_M) / RAD - out[i * n + j];
    }
  }
  return out;
}

// How much of the Sun's disc each cell sees, 0 to 1, for a Sun at `az` / `el` (degrees) as seen
// from the site at the centre of the grid, from `eyeM` above the ground (0, the ground itself, for
// the map's shadows). Only terrain inside the grid can cast a shadow.
// About 12-15 ms for the 241 x 241 grid at any Sun elevation, so it can follow the scrubber.
export function sunlight(grid: TerrainGrid, az: number, el: number, eyeM = 0): Float32Array {
  const lit = clearance(grid, az, el, eyeM);
  for (let k = 0; k < lit.length; k++) lit[k] = Math.min(1, Math.max(0, lit[k] / (2 * SUN_RADIUS_DEG) + 0.5));
  return lit;
}

// Earth clearance below which the link counts as marginal (scope.md > Core 4; the backend's
// MARGINAL_COMMS_CLEARANCE_RADIANS).
export const MARGINAL_COMMS_DEG = 0.5;

// Earth link quality per cell, 0 to 1, for the Earth at `az` / `el` (degrees) as seen from the
// site, from `eyeM` above the ground: 0 is blocked (Earth's centre below the horizon), 1 is clear
// (MARGINAL_COMMS_DEG or more above it), and the marginal band in between ramps linearly, so a
// link that is getting worse shows before it drops.
export function earthLink(grid: TerrainGrid, az: number, el: number, eyeM = 0): Float32Array {
  const link = clearance(grid, az, el, eyeM);
  for (let k = 0; k < link.length; k++) link[k] = Math.min(1, Math.max(0, link[k] / MARGINAL_COMMS_DEG));
  return link;
}

// Height of the rover's panel and antenna above the ground, the same as the observer height POST
// /analyze uses (backend MAST_M, returned as site.mastM). Close-in terrain is very sensitive to it:
// 2 m against a cell 100 m away is over a degree.
export const MAST_M = 2;

// Per-cell power for a rover standing on each cell, 0 to 1: the share of the Sun's disc it sees,
// less what the Earth covers during a lunar eclipse (`behindEarth`, from POST /analyze, the same
// for the whole grid). The panel's cos(el) and constants are left out: they are the same for every
// cell.
export function powerField(grid: TerrainGrid, sun: { az: number; el: number }, behindEarth = 0, eyeM = MAST_M): Float32Array {
  const lit = sunlight(grid, sun.az, sun.el, eyeM);
  if (behindEarth > 0) for (let k = 0; k < lit.length; k++) lit[k] *= 1 - behindEarth;
  return lit;
}

// Per-cell comms for a rover standing on each cell, 0 to 1 (see earthLink).
export function commsField(grid: TerrainGrid, earth: { az: number; el: number }, eyeM = MAST_M): Float32Array {
  return earthLink(grid, earth.az, earth.el, eyeM);
}

// Colour ramps, dark end then bright end, as [r, g, b].
const NEUTRAL = [[40, 40, 43], [226, 226, 229]]; // before the Sun is known
const SUNLIT = [[34, 31, 28], [246, 238, 220]]; // warm regolith
const SHADOW = [[8, 10, 24], [84, 98, 146]]; // deep cool blue, relief still readable

// How many image pixels per grid cell. Upsampling here, with smooth interpolation, is what keeps
// the map from showing 100 m squares and staircase shadow edges when zoomed in.
export const UPSAMPLE = 2;

// Grid cell and bilinear weight for each image row / column (the same for both axes).
function upsampleAxis(n: number): { cell: Int32Array; frac: Float32Array } {
  const m = n * UPSAMPLE;
  const cell = new Int32Array(m), frac = new Float32Array(m);
  for (let p = 0; p < m; p++) {
    const g = Math.min(n - 1, Math.max(0, (p + 0.5) / UPSAMPLE - 0.5));
    cell[p] = Math.min(n - 2, Math.floor(g));
    frac[p] = g - cell[p];
  }
  return { cell, frac };
}

// RGBA pixels for the map, UPSAMPLE x the grid's size: relief times ambient occlusion, warm where
// the Sun reaches and deep blue where it doesn't. `lit` is null when the Sun's position isn't known
// yet; the relief is then shown in neutral grey. Values between cells are interpolated bilinearly,
// and the shadow edge is then sharpened with a smoothstep so it is crisp but not stepped.
export function paint(shade: Float32Array, ao: Float32Array, lit: Float32Array | null): ImageData {
  const n = Math.round(Math.sqrt(shade.length));
  const m = n * UPSAMPLE;
  const image = new ImageData(m, m);
  const px = image.data;
  const { cell, frac } = upsampleAxis(n);
  // Brightness per cell (relief times occlusion), interpolated per pixel below.
  const bright = new Float32Array(n * n);
  for (let k = 0; k < bright.length; k++) bright[k] = shade[k] * ao[k];

  // Each channel is base + g·slope + s·(gap + g·gapSlope), with g the brightness and s the share of
  // sunlight: the shadow ramp, blended toward the sunlit ramp. No Sun: the neutral ramp, s = 0.
  const lo = lit ? SHADOW : NEUTRAL, hi = SUNLIT;
  const base = [0, 1, 2].map((ch) => lo[0][ch]);
  const slope = [0, 1, 2].map((ch) => lo[1][ch] - lo[0][ch]);
  const gap = [0, 1, 2].map((ch) => hi[0][ch] - lo[0][ch]);
  const gapSlope = [0, 1, 2].map((ch) => hi[1][ch] - hi[0][ch] - slope[ch]);
  const [b0, b1, b2] = base, [s0, s1, s2] = slope, [p0, p1, p2] = gap, [q0, q1, q2] = gapSlope;

  let o = 0;
  for (let y = 0; y < m; y++) {
    const row = cell[y] * n, fy = frac[y];
    for (let x = 0; x < m; x++) {
      const k = row + cell[x], fx = frac[x];
      const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
      const g = bright[k] * w00 + bright[k + 1] * w01 + bright[k + n] * w10 + bright[k + n + 1] * w11;
      let s = 0;
      if (lit) {
        s = ((lit[k] * w00 + lit[k + 1] * w01 + lit[k + n] * w10 + lit[k + n + 1] * w11) - 0.25) * 2;
        s = s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s); // smoothstep(0.25, 0.75, lit)
      }
      px[o] = b0 + g * s0 + s * (p0 + g * q0);
      px[o + 1] = b1 + g * s1 + s * (p1 + g * q1);
      px[o + 2] = b2 + g * s2 + s * (p2 + g * q2);
      px[o + 3] = 255;
      o += 4;
    }
  }
  return image;
}

// Forecast overlay colours (ticket 7.8): a diverging pair, checked for colour-blind separation.
// No change is transparent, so the terrain itself is the neutral midpoint.
export const DELTA_LOSS = [240, 89, 94]; // #f0595e
export const DELTA_GAIN = [51, 136, 238]; // #3388ee
export const DELTA_DEADBAND = 0.02; // |Δ| at or below this stays clear, so noise doesn't tint the map

// Overlay strength, 0 to 1, for a change `d` in -1..1: 0 inside the dead-band, a short fade-in so
// edges aren't hard, then rising with |d|. Small changes start at 35% so they are still visible.
export function deltaAlpha(d: number): number {
  const a = Math.abs(d);
  if (a <= DELTA_DEADBAND) return 0;
  const fade = Math.min(1, (a - DELTA_DEADBAND) / 0.06);
  return fade * (0.35 + 0.65 * Math.min(1, a));
}

// The map image with a change field (-1 to 1 per grid cell) blended over it: DELTA_LOSS where the
// value falls, DELTA_GAIN where it rises. The base is first turned grey, so colour only ever means
// change and the map's own warm / blue tints can't be mistaken for it. Returns a new image.
export function paintDelta(base: ImageData, delta: Float32Array, opacity = 0.8): ImageData {
  const n = Math.round(Math.sqrt(delta.length));
  const m = base.width;
  const out = new ImageData(m, m);
  const src = base.data, px = out.data;
  const { cell, frac } = upsampleAxis(n);
  let o = 0;
  for (let y = 0; y < m; y++) {
    const row = cell[y] * n, fy = frac[y];
    for (let x = 0; x < m; x++) {
      const k = row + cell[x], fx = frac[x];
      const d =
        (delta[k] * (1 - fx) + delta[k + 1] * fx) * (1 - fy) +
        (delta[k + n] * (1 - fx) + delta[k + n + 1] * fx) * fy;
      const grey = 0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2];
      const a = opacity * deltaAlpha(d);
      const c = d < 0 ? DELTA_LOSS : DELTA_GAIN;
      px[o] = grey + (c[0] - grey) * a;
      px[o + 1] = grey + (c[1] - grey) * a;
      px[o + 2] = grey + (c[2] - grey) * a;
      px[o + 3] = 255;
      o += 4;
    }
  }
  return out;
}
