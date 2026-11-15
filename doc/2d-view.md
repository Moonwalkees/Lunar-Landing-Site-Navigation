# Bird's-eye view (2D terrain map)

The terrain panel's default view, next to **Orbit view** and **Surface view**: a top-down, north-up map of the 24 km square around the site, with the ground out of the Sun shaded blue-dark and arrows toward the Sun and the Earth. It is the light alternative to the [3D view](3d-view.md): about 100 kB per site, no GPU needed, and the 55 MB Unity build is never downloaded unless the user picks orbit or surface.

This view is not in [scope.md](scope.md) yet (ticket 4.11).

## Where things are

| What | Where |
|---|---|
| Panel with the view buttons | `frontend/src/components/TerrainView.tsx` |
| The map (canvas, pan, zoom, arrows) | `frontend/src/components/TerrainMap.tsx` |
| Relief and shadow maths | `frontend/src/terrain2d.ts` |
| Height grid | `GET /terrain` in `backend/app/main.py`, `terrain_grid()` in `backend/app/horizon.py` |

## `GET /terrain?lat=&lon=`

Returns a 241 x 241 grid of heights (metres above the 1737.4 km sphere), one every 100 m, centred on the site. Row 0 is the north edge, column 0 the west edge. Distances are measured along the surface from the site, the same way `skyline()` walks out, so north and the Sun and Earth azimuths line up with the panorama. Heights come from the 20 m polar map where it covers the site and from the global 474 m map elsewhere (`sourceM` says which). The response is about 320 kB of JSON, about 96 kB gzipped.

## What it shows

- **Relief**: hillshade with light ambient occlusion (hollows darker), so the shape reads before any analysis. Before Analyze it is neutral grey lit from the north-west; after, it is lit 65% from the Sun's azimuth and 35% from the north-west, so slopes agree with the shadows while craters still read as hollows.
- **Shadows**: after Analyze, each cell looks toward the Sun over the curved surface for terrain in the way, and gets the share of the Sun's disc it sees. Sunlit ground is warm grey, shadow is deep blue with the relief still visible. About 10-15 ms per Sun position with the Sun well up (slower near the horizon, see BUG-010).
- **Smooth at any zoom**: the image is painted at 2x the grid with bilinear interpolation, and the shadow edge is sharpened with a smoothstep, so there are no 100 m blocks or stepped shadow edges. The canvas matches its box's real width and height (no stretching) and opens zoomed to fill the box; zoom out to see the whole square. About 13 ms per Sun position on top of the shadows.
- **Sun and Earth**: glowing arrows from the site toward each azimuth, labelled with azimuth and elevation (dark halo, always kept inside the map). Dashed with a hollow disc when the body is below the level plane.

Like the 3D view, it only displays the Sun and Earth angles from `POST /analyze` at the scrubber index; it never computes them.

## Limits

- Only terrain inside the 24 km square casts shadows. Far ridges that the panorama sees (out to 150 km) are missed, so ground near the edge of the map can show as lit when it is not. At the site itself the map agreed with the analysis at 99-100% of time steps for all five presets over a month.
- Ground is treated as 0 m high (the analysis uses a 2 m mast).
- 100 m cells: features smaller than a few hundred metres don't show. Away from the pole the source map is 474 m, so the map is blurrier there.
- No pinch zoom on phones yet; one-finger drag pans.
