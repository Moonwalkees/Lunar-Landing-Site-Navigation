# 3D terrain view

A panel that shows the real terrain around the selected site in 3D, at true scale, with the Sun casting shadows and the Earth in the sky. It is a pre-built Unity WebGL view embedded in the React app. It only displays what it is told; it never computes where the Sun or Earth are.

This view is not in [scope.md](scope.md) yet (see ticket 4.9). The terrain panel has three views: **Bird's-eye view** (the default, a light 2D map, see [2d-view.md](2d-view.md)), **Orbit view** and **Surface view**. The 3D view and its download start only when the user picks orbit or surface.

## Where things are

| What | Where |
|---|---|
| React panel (view buttons) | `frontend/src/components/TerrainView.tsx` |
| 3D view inside the panel | `frontend/src/components/TerrainView3D.tsx` |
| Which areas have terrain | `frontend/src/terrain.ts` |
| The built view (63 MB) | `frontend/public/unity/` |

`frontend/public/unity/` holds two folders that must stay together:

- `Build/` (25 MB) is the view itself, downloaded when the page opens.
- `StreamingAssets/` (37 MB) is terrain the view downloads only when it needs it: the surroundings of the starting area (3.7 MB) and each other area (about 7.5 MB).

The files are gzip-compressed and unpack themselves in the browser, so any static host works with no server settings.

## Using the panel

```tsx
<TerrainView
  lat={site.lat}
  lon={site.lon}
  sun={{ az: 135.0, el: 1.2 }}      // or null
  earth={{ az: 137.3, el: 4.5 }}    // or null
/>
```

| Prop | Meaning |
|---|---|
| `lat`, `lon` | The site, degrees. Latitude is negative in the south; longitude is east-positive. |
| `sun`, `earth` | Where each is in the sky from the site: `az` in degrees clockwise from local north, `el` in degrees above the local level plane. Negative `el` is below it. Pass `null` when unknown; the view keeps its last angles. |

Updates are cheap, so the props can change on every scrubber step. The view buttons are inside the panel.

## Areas with terrain

| Area | South polar stereographic metres | Source |
|---|---|---|
| Connecting Ridge | X -18998 to -3002, Y -19998 to -4002 | LOLA 5 m, shown at about 8 m |
| Shackleton rim | X -8998 to 6998, Y -14998 to 998 | LOLA 5 m, shown at about 8 m |
| Shackleton crater | X -296 to 15696, Y -14396 to 1596 | LOLA 20 m |
| Peak near Shackleton | X 22004 to 37996, Y -27996 to -12004 | LOLA 5 m (NASA PGDA Site07), shown at about 8 m |
| Malapert Massif | X -10995 to 9995, Y 111005 to 131995 | LOLA 5 m (NASA PGDA Site23), shown at about 10 m; 21 km square |

Each is a 16 km square (Malapert 21 km; a height every 8 to 10 m) wrapped in three coarser levels: every 31 m out to 16 km from its centre, every 125 m out to 40 km, and every 500 m out to 160 km. The 31 m level is there so detail does not stop dead at the square's edge. A site in another area makes the view download and switch to it (about 5 MB). A site outside all of them shows a message in the panel and the view stays where it was. Areas overlap; the view stays on the current one while it covers the site.

The four south pole presets in `backend/app/sites.py` (served by `GET /sites`) all have 3D terrain. The Apollo presets do not: both UIs mark such sites as 2D only and switch their 3D tabs off (ticket 4.28), using `terrainTileFor` in `frontend/src/terrain.ts`.

## What the picture can and can't tell you

- The terrain is true scale with no vertical exaggeration, and the Moon's curvature is applied, so distant ground sits where it would really appear.
- Its shadows were checked against a direct calculation from the height data: they agree over about 96% of the detailed area, and the differences are soft bands along shadow edges. Mountains in the surrounding terrain shade the detailed area too.
- When the Earth is in front of the Sun (a lunar eclipse), the sunlight dims by the share of the Sun that is covered, and the sky shows it: the Earth's dark disc covers the Sun, ringed in orange, and the Sun's glare is turned down while the two are close (BUG-011).
- A rover stands at the site at its real size, under the red pin. It is NASA's Perseverance model standing in for a lunar rover, it does not move, and it is only drawn within 3 km of the camera. **Zoom to rover** in orbit view takes the camera to it; from the page that is `unity.SendMessage("Bridge", "SetOrbitDistance", 14)` (metres from the site; 9000 is the usual overview).
- The Earth is NASA's Blue Marble map on a sphere, 1.9° across, lit from the Sun's side, so its phase is right for the two directions it is given. One fixed side of it faces the Moon (the real Earth turns once a day), its night side is drawn faintly so it can still be found, and it has no clouds.
- Beyond 16 km from the centre of the detailed square the terrain is coarse (125 m to 500 m between samples), and the outer 90 m of the square is blended into the 31 m level around it. Use the backend's skyline for visibility numbers, and this view to show them.
- The dim bluish light on shadowed ground is a fill light so the terrain stays readable. It is not a calculation of earthshine.

## Changing the view itself

The Unity project that produces `frontend/public/unity/` is not in this repository. To change the view, rebuild it there and copy the new `Build/` and `StreamingAssets/` folders over the old ones.
