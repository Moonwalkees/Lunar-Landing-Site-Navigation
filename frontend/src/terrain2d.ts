// Shading and shadows for the 2D terrain map (see doc/2d-view.md). Pure functions over the
// GET /terrain grid: row 0 is the north edge, column 0 the west edge, `spacingM` between cells.

import type { TerrainGrid } from "./types";

const MOON_RADIUS_M = 1737400;
const SUN_RADIUS_DEG = 0.267;
const RAD = Math.PI / 180;

// Grey relief lit from the north-west, 0 (dark) to 1 (bright). Computed once per grid.
export function relief(grid: TerrainGrid): Float32Array {
  const { size: n, spacingM: s, heights: h } = grid;
  const out = new Float32Array(n * n);
  // Light from azimuth 315°, 45° up; the slope is exaggerated a little so gentle terrain still reads.
  const lx = Math.sin(315 * RAD) * Math.cos(45 * RAD);
  const ly = Math.cos(315 * RAD) * Math.cos(45 * RAD);
  const lz = Math.sin(45 * RAD);
  const exaggerate = 2;
  for (let i = 0; i < n; i++) {
    const up = Math.max(i - 1, 0), down = Math.min(i + 1, n - 1);
    for (let j = 0; j < n; j++) {
      const left = Math.max(j - 1, 0), right = Math.min(j + 1, n - 1);
      const dzEast = ((h[i * n + right] - h[i * n + left]) / ((right - left) * s)) * exaggerate;
      const dzNorth = ((h[up * n + j] - h[down * n + j]) / ((down - up) * s)) * exaggerate;
      const norm = Math.hypot(dzEast, dzNorth, 1);
      const shade = (-dzEast * lx - dzNorth * ly + lz) / norm;
      out[i * n + j] = Math.min(1, Math.max(0, shade));
    }
  }
  return out;
}

// How much of the Sun's disc each cell sees, 0 to 1, for a Sun at `az` / `el` (degrees) as seen
// from the site at the centre of the grid. Each cell looks along the Sun's azimuth over the curved
// surface for the highest terrain in the way. Only terrain inside the grid can cast a shadow.
// About 10-15 ms for the 241 x 241 grid on a laptop, so it can follow the scrubber.
export function sunlight(grid: TerrainGrid, az: number, el: number): Float32Array {
  const { size: n, spacingM: s, heights: h } = grid;
  let top = -Infinity;
  for (let k = 0; k < h.length; k++) if (h[k] > top) top = h[k];

  const dCol = Math.sin(az * RAD); // one step toward the Sun, in cells
  const dRow = -Math.cos(az * RAD);
  const centre = (n - 1) / 2;
  const lit = new Float32Array(n * n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const h0 = h[i * n + j];
      // The Sun stands a little higher for cells nearer to it than the site, lower for those further away.
      const towardSunM = ((j - centre) * dCol - (i - centre) * dRow) * s;
      const elHere = el + (towardSunM / MOON_RADIUS_M) / RAD;
      const tanTop = Math.tan((elHere + SUN_RADIUS_DEG) * RAD);
      const tanBottom = Math.tan((elHere - SUN_RADIUS_DEG) * RAD);

      let best = -Infinity; // tangent of the highest terrain angle seen toward the Sun
      for (let step = 1; ; step++) {
        const r = Math.round(i + dRow * step), c = Math.round(j + dCol * step);
        if (r < 0 || r >= n || c < 0 || c >= n) break;
        const d = step * s;
        const drop = (d * d) / (2 * MOON_RADIUS_M); // the surface curves away below the level plane
        const t = (h[r * n + c] - h0 - drop) / d;
        if (t > best) {
          best = t;
          if (best >= tanTop) break; // the whole disc is hidden
        }
        // Nothing further out can rise above what is already known.
        if ((top - h0 - drop) / d <= Math.max(best, tanBottom)) break;
      }
      const horizonDeg = best === -Infinity ? -90 : Math.atan(best) / RAD;
      lit[i * n + j] = Math.min(1, Math.max(0, (elHere - horizonDeg) / (2 * SUN_RADIUS_DEG) + 0.5));
    }
  }

  return lit;
}

// RGBA pixels for the map: grey relief, with ground out of the Sun darkened and tinted blue.
// `lit` is null when the Sun's position isn't known yet; the relief is then shown on its own.
export function paint(shade: Float32Array, lit: Float32Array | null): ImageData {
  const n = Math.round(Math.sqrt(shade.length));
  const image = new ImageData(n, n);
  const px = image.data;
  for (let k = 0; k < shade.length; k++) {
    const grey = 50 + shade[k] * 170;
    const sun = lit ? lit[k] : 1;
    const dark = 0.32 + 0.68 * sun;
    px[k * 4] = grey * dark;
    px[k * 4 + 1] = grey * dark;
    px[k * 4 + 2] = grey * dark + (1 - sun) * 28;
    px[k * 4 + 3] = 255;
  }
  return image;
}
