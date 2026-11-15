# Bird's-eye view (2D terrain map)

The terrain panel's default view, next to **Orbit view** and **Surface view**: a top-down, north-up map of the 24 km square around the site, with the ground out of the Sun shaded blue-dark and arrows toward the Sun and the Earth. It is the light alternative to the [3D view](3d-view.md): about 100 kB per site, no GPU needed, and the 63 MB Unity build is never downloaded unless the user picks orbit or surface.

This view is not in [scope.md](scope.md) yet (ticket 4.11).

## Where things are

| What | Where |
|---|---|
| Panel with the view buttons | `frontend/src/components/TerrainView.tsx` |
| The map (canvas, pan, zoom, arrows) | `frontend/src/components/TerrainMap.tsx` |
| Relief and shadow maths | `frontend/src/terrain2d.ts` |
| Forecast overlay: per-cell fields and colours | `powerField`, `commsField`, `marginField`, `paintDelta` in `frontend/src/terrain2d.ts` |
| Forecast overlay: change over a window, frame cache | `frontend/src/forecastCore.ts` |
| Forecast overlay: background worker and its hook | `frontend/src/forecast.worker.ts`, `useForecast` in `frontend/src/forecast.ts` |
| Forecast overlay: legend | `frontend/src/components/ForecastLegend.tsx` |
| Height grid | `GET /terrain` in `backend/app/main.py`, `terrain_grid()` in `backend/app/horizon.py` |

## `GET /terrain?lat=&lon=`

Returns a 241 x 241 grid of heights (metres above the 1737.4 km sphere), one every 100 m, centred on the site. Row 0 is the north edge, column 0 the west edge. Distances are measured along the surface from the site, the same way `skyline()` walks out, so north and the Sun and Earth azimuths line up with the panorama. Heights come from the 20 m polar map where it covers the site and from the global 474 m map elsewhere (`sourceM` says which). The response is about 320 kB of JSON, about 96 kB gzipped.

## What it shows

- **Relief**: hillshade with light ambient occlusion (hollows darker), so the shape reads before any analysis. Before Analyze it is neutral grey lit from the north-west; after, it is lit 65% from the Sun's azimuth and 35% from the north-west, so slopes agree with the shadows while craters still read as hollows.
- **Shadows**: after Analyze, each cell looks toward the Sun over the curved surface for terrain in the way, and gets the share of the Sun's disc it sees. Sunlit ground is warm grey, shadow is deep blue with the relief still visible. About 12-18 ms per Sun position at any Sun elevation (BUG-010): each cell follows its own ray for the first few cells, and the rest of the terrain is swept once per line parallel to the Sun's azimuth, keeping a convex hull of the ground already passed.
- **Smooth at any zoom**: the image is painted at 2x the grid with bilinear interpolation, and the shadow edge is sharpened with a smoothstep, so there are no 100 m blocks or stepped shadow edges. The canvas matches its box's real width and height (no stretching) and opens zoomed to fill the box; zoom out to see the whole square. About 13 ms per Sun position on top of the shadows.
- **Sun and Earth**: glowing arrows from the site toward each azimuth, labelled with azimuth and elevation (dark halo, always kept inside the map). Dashed with a hollow disc when the body is below the level plane.

Like the 3D view, it only displays the Sun and Earth angles from `POST /analyze` at the scrubber index; it never computes them.

## Forecast overlay

A heatmap over the map that shows where power (sunlight) or comms (the Earth link) is about to change, so a route can be planned on what the ground will be like, not only on what it is like now. It is off by default. Tickets 7.6 to 7.10; not in [scope.md](scope.md).

The whole overlay is computed in the browser, in a Web Worker. There is no backend endpoint for it: it uses the `GET /terrain` grid and the Sun and Earth angles for every time step that `POST /analyze` already returned.

### Controls

Under the view buttons, once an analysis for the site is in:

| Control | Choices | What it does |
|---|---|---|
| Forecast | Off, Power, Comms | Which value to forecast. Off shows the normal map. |
| Show | Change, Worst dip | Change is the value at the end of the span less the value now. Worst dip is the lowest value during the span less the value now, so it also catches a drop that recovers before the end. |
| Show | Early warning | Also colours ground that is close to changing. See below. |
| Ahead | 3, 6 and 12 time steps, then 1, 3 and 7 days | How far ahead to look. The buttons are labelled in hours or days: 6 steps is 12 h in the board UI (2 h steps) and 6 h in the classic UI (1 h steps). |

### What is computed

For each cell, a value from 0 to 1 at each time step, for a rover standing on that cell with its panel and antenna 2 m up (`mastM`, the same as the analysis):

- **Power**: the share of the Sun's disc the cell sees above its local horizon, times `1 - behindEarth` during a lunar eclipse. The panel's `cos(el)` and constants are left out, because they are the same for every cell.
- **Comms**: 0 when the Earth's centre is below the cell's horizon, 1 when it is 0.5° or more above, and a straight ramp between. These are the blocked, marginal and clear thresholds from [scope.md](scope.md).
- **Early warning** (either one): `0.5 + clearance / (2 x 3°)`, clamped to 0 to 1, where clearance is the Sun's or Earth's elevation less the cell's horizon. 0.5 is the body on the horizon; 0 and 1 are 3° below and above it.

The local horizon comes from the same sweep as the shadows (`horizonToward`), pointed at the Sun or the Earth. The Sun and Earth angles are the site's, applied to the whole map, with only the tilt of the ground from the Moon's curvature added per cell.

From those values over the span, per cell:

- **Change**: value at the end less value now, from -1 to 1.
- **Worst dip**: lowest value in the span less value now, 0 or below.
- **When**: for Change, the step by which half of the change has happened; for Worst dip, the step of the lowest value.

### How it is drawn

- With a forecast on, the map is plain grey relief lit from the north-west, with no shadows, so colour only ever means change.
- Red is losing, blue is gaining, and no change is clear. A change of 0.02 or less is left clear so noise does not tint the map. The colour covers the terrain more strongly the bigger the change.
- Each colour has shades: vivid for a change that comes soon, pale for one late in the span. Soon is `#e23a41` and `#2271e0`, late is `#f08f8b` and `#88b6f0`; both pairs were checked for colour-blind separation.
- The legend (bottom right) names the value, the mode and the span, and shows both colour bars from "soon" to the end of the span. Hovering a cell adds a line such as "Here 1.00 → 0.00 · changes at +8 h". With early warning on, that line is in degrees of clearance.
- At the end of the analysis window the span is cut short, and the legend says so.

### Speed

- One field is about 13 ms. Fields are cached per time step (64 of them), so moving one step on costs one or two new fields.
- Spans over 12 steps are sampled at about 13 moments, on multiples of a stride so that neighbouring spans share them. A 7-day span costs at most 14 fields from cold.
- **Rough while moving, sharp when still** (ticket 7.12): each change of time step is first answered on every second cell of the grid (200 m, 121 x 121), about 4 ms a field, and drawn through the same smooth upscaling so it lines up. Once nothing has changed for 200 ms the full 100 m field replaces it. The rough field agrees with the sharp one on losing, gaining or no change at 96 to 98% of cells; it is more optimistic on ridges, so it is only ever a preview.
- The worker checks for a newer request after each field and drops the old one, so a fast scrub only finishes the last position. The last heatmap stays up until the next arrives.
- Painting the overlay is about 19 ms on the main thread.

### Limits of the overlay

- **Only terrain inside the 24 km map is counted.** The analysis looks out to 150 km. A far ridge that covers the whole area at once shows in the site's time series, not as a change on the map. Over a year at Malapert Massif, this was the cause of every disagreement between the centre cell and the analysis (6% of steps).
- **Ridges and peaks read too clear.** The 100 m grid misses small rises within about 100 m of the rover that the backend's 20 m data sees, so the horizon is 0.5 to 0.8° too low at Peak near Shackleton and Connecting Ridge. The centre cell agreed with the analysis on comms at 96% and 86% of steps there. The pattern of gaining and losing ground is still right; values near the marginal band are optimistic. A 50 m grid roughly halves this (proposed ticket 7.11).
- **Little changes in a short span.** A cell is either lit or not, so at 12 h only the strips where a shadow edge moves are coloured: 4 to 7% of the map for power, 1 to 4% for comms. Longer spans and early warning are there to show more (at Peak near Shackleton, 7 days with early warning colours 62% for power).
- **Early warning changes what colour means.** Red is "the margin is shrinking", not "power will drop in this span".
- **Worst dip on long spans can miss a short drop**, because the span is sampled: anything shorter than the gap between samples, up to 14 h on a 7-day span.
- **Short spans have few shades.** A 6-step span has 6 possible times.
- **Cells on the outer edge** have no terrain beyond them to be blocked by, and can show a false strip of colour.
- It is an aid for choosing a route, not a path planner. Rover path planning is out of scope; ticket 7.1 is the route tracer.

## Limits

- Only terrain inside the 24 km square casts shadows. Far ridges that the panorama sees (out to 150 km) are missed, so ground near the edge of the map can show as lit when it is not. At the site itself the map agreed with the analysis at 99-100% of time steps for all five presets over a month.
- Ground is treated as 0 m high for the shadows (the analysis uses a 2 m mast, and so does the forecast overlay).
- 100 m cells: features smaller than a few hundred metres don't show. Away from the pole the source map is 474 m, so the map is blurrier there.
- No pinch zoom on phones yet; one-finger drag pans.
