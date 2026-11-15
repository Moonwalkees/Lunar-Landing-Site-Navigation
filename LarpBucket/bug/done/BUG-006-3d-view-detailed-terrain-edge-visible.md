# BUG-006 The edge of the detailed terrain is easy to see in the 3D view

Status: done
Owner: Aiken
Severity: low
Affects: frontend / 3D terrain view (orbit and surface views)
Note: done. The 3D view now draws a band of 31 m terrain around the detailed square and blends the square's outer rows into it. New build and four `*_near.raw` files in `frontend/public/unity/`.

## Summary
In orbit view, zoomed out, the 16 km square of detailed terrain ends in a straight line, with smoother and slightly brighter ground beyond it.

## Description
Pick Connecting Ridge, press Analyze, open Orbit view and scroll out. The square with small craters stops dead at a straight edge. Past the edge the ground has no small craters and reads a little brighter, so the square looks pasted on.

## Intended behaviour
Detail should fall away gradually with distance, with no visible line where one level of terrain meets the next.

## Where it happens
The Unity WebGL build in `frontend/public/unity/`, at the edge of every terrain tile.

## Cause
Two things.

- The tile has a height every 8 m and the first ring around it had one every 125 m, a 16 times step. Under a Sun about 1° up, small craters cast long shadows, so ground with them looks rougher and darker than ground without.
- NASA's LOLA 5 m site tiles flatten out in their last few rows. Row-to-row height change averages 0.10 m in the outermost pair of rows against 0.65 m further in. Under a grazing Sun that strip shades differently and shows as a thin line along the tile's edge.

## File
`frontend/public/unity/Build/` (the Unity project that builds it is not in this repository, see `doc/3d-view.md`)

## Solution
**Chosen:** A third level of surrounding terrain, `<tile>_near.raw` in `frontend/public/unity/StreamingAssets/`: 32 km across (the tile plus 8 km on every side), a height every 31 m, cut from `ldem_85s_20m_crop.tif`. Detail now steps 8 m, 31 m, 125 m, 500 m. The outer 12 rows of the tile (about 90 m) are faded into that level, so the two meet exactly and the flattened border rows of the 5 m tiles are replaced. The band carries the same surface grain as the tile.

**Strengths**
- Real terrain, not added noise: the band comes from the same 20 m map the backend uses, and agrees with the tile to 1 to 2 m RMS where they overlap.
- Ridges in the band now cast shadows from 31 m data, where they used the 125 m ring before.
- Unity's shadows still agree with the independent horizon calculation over about 96% of the tile, the same as before.
- A tile with no `_near.raw` still works; the 125 m ring then runs up to it.

**Limitations**
- Costs frame rate on weak graphics. On a low-end integrated chip: about 114 to 79 frames per second in a normal window, and 46 to 37 on a 2x display. No measurable change on a discrete card.
- Adds 8.4 MB to the repository (2.1 MB per tile) and about 2 MB to the download for each area.
- From within a few hundred metres of the tile's edge a hairline is still visible where the two meshes meet. It is not visible from normal orbit distance.
- The outer 90 m of each tile is now smoothed toward 31 m data.
- The step from 31 m to 125 m at 16 km from the tile's centre remains, and can be seen when zoomed far out.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Only fade the tile's edge into the 125 m ring | The tile would still be a detailed patch in smooth ground, just with soft edges | No extra download or frame-rate cost |
| A normal map on the 125 m ring, baked from the 20 m map | More build steps and a custom material, and small craters would still cast no shadows | Fewer triangles |
| Added noise or a crater texture on the ring | It would be invented terrain in a tool about real terrain | Cheapest |
| A 62 m band | Only twice as fine as the ring, so the step at the tile's edge stays obvious | A quarter of the triangles |
