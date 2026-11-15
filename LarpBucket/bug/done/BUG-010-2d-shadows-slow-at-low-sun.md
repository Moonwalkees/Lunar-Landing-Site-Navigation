# BUG-010 2D map shadow pass is slow when the Sun is near the horizon

Status: done
Owner: Tony Pham
Note: done. `sunlight()` now uses a near-field march plus a per-line convex-hull sweep: 12-18 ms at any Sun elevation (was 55-180 ms at low Sun), and closer to an exact ray-march than before.
Severity: medium
Affects: frontend 2D bird's-eye map and board hero map (shared `sunlight()`)

## Summary
`sunlight()` takes about 80 ms per Sun position at low Sun elevations, so scrubbing stutters at the polar presets, where the Sun is almost always low.

## Description
Found while timing 4.27. Run `sunlight()` on the `GET /terrain` grid for Shackleton (-89.67, 129.78) with the Sun at az 200°, el +1.2°. It takes about 80-88 ms per call. For Apollo 11 with the Sun at el +25° it takes about 13 ms, which matches the 10-15 ms in `doc/2d-view.md`. The polar presets are the main use case, and their Sun stays within a few degrees of the horizon, so the slow case is the common one there. This was the same before 4.27; 4.27 did not change `sunlight()`.

## Intended behaviour
Under about 15-20 ms per Sun position at any elevation, so shadows follow the scrubber smoothly.

## Where it happens
`sunlight()` in `frontend/src/terrain2d.ts`. It is called on every scrubber step by `TerrainMap.tsx`, and by `board/HeroMap.tsx`.

## Cause
Each cell marches toward the Sun until terrain hides the whole disc or nothing further out can rise above the ray. With the Sun under ~2°, the early-exit test `(top - h0 - drop) / d <= max(best, tanBottom)` rarely passes, so most rays run to the grid edge: up to ~240 steps for each of 58k cells. Leads: march along whole grid lines in the Sun direction, carrying a running horizon (O(n²) in total). Or compute at half resolution when el < ~3° and let the 2x paint interpolate. Or move it to a Web Worker so it doesn't block the UI.

## File
`frontend/src/terrain2d.ts:100`

## Solution
**Chosen:** `sunlight()` in `frontend/src/terrain2d.ts` now calls a new internal `horizonTangent(grid, az)`, which gives every cell's horizon tangent toward the Sun. The lit-fraction formula afterwards is unchanged. `horizonTangent` works in two parts:
- **Far field:** the grid is cut into lines parallel to the Sun's azimuth, one cell per step along the longer axis, with heights interpolated across the line. Each line is swept once from its Sun end, keeping the upper convex hull of the terrain already passed. Each cell is served by the nearest line and finds its horizon by binary search on that hull.
- **Curvature:** handled exactly by recasting heights as `h − x²/2R`. Slopes on the recast profile differ from the true ones by the constant `x0/R`, which is added back.
- **Near field:** the first `NEAR_STEPS = 4` cells of each ray are marched per cell along the exact ray, with interpolated heights. This is because the shared line can pass up to half a cell beside the cell's own ray.

Measured in Node on the real 241×241 grids for Shackleton (-89.67, 129.78) and Apollo 11:

| | Old | New |
|---|---|---|
| Time per Sun position | 55-180 ms at low Sun, 10-45 ms high | 12-18 ms at any elevation |

Accuracy was checked against a fine reference: a per-cell march with bilinear heights at quarter-cell steps and no early exit. Cells that flip lit/unlit vs that reference:

| Grid | Old | New |
|---|---|---|
| Shackleton | 0.5-3.6% | 0.3-0.5% |
| Apollo 11 | 0-0.9% | 0-0.06% |

**Strengths**
- Cost no longer depends on Sun elevation, so the polar presets scrub as smoothly as equatorial sites.
- More accurate than the old nearest-cell march: heights are interpolated across, and the near field follows the exact ray.
- `horizonTangent` takes any azimuth, so 7.6 can reuse it for per-cell Earth visibility.
- No new libraries, no worker, and the same output type, so `TerrainMap.tsx` and `board/HeroMap.tsx` are unchanged.

**Limitations**
- Beyond `NEAR_STEPS` the far field comes from the nearest parallel line, up to half a cell sideways from the cell's true ray. That is the same order of error as the old rounding, and it matters little at that distance.
- At a high Sun the old early exit made it about 11 ms, and the new pass is about 13 ms. The total cost is now flat, not lower everywhere.
- It still runs on the main thread. 7.7 moves the multi-frame forecast work to a Web Worker.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Hull sweep only, snapping cells to lines (no near march) | Up to 6.9% of cells wrong at grazing Sun on flat ground (Apollo 11), against 0.9% for the old code | About 6 ms, so 2-3× faster, but less accurate than the old code in some cases |
| Half-resolution pass when el < 3° | Blurs shadow edges exactly where the polar sites live | Simpler, but loses detail |
| Web Worker around the old march | Still about 80 ms of CPU per frame, just off the main thread | Doesn't fix the cost the 7.x forecast needs, where k+1 frames are computed per scrub |
| `NEAR_STEPS = 8` | About 1 ms more per step with barely any accuracy gain (0.20% vs 0.27% flips at Shackleton) | Slightly more accurate, about 4 ms slower |
