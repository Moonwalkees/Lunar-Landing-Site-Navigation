# BUG-010 2D map shadow pass is slow when the Sun is near the horizon

Status: open
Owner:
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
_Filled in when the ticket is done. See "Solution section" in CLAUDE.md._
