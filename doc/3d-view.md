# 3D terrain view

A panel that shows the real terrain around the selected site in 3D, at true scale, with the Sun casting shadows and the Earth in the sky. It is a pre-built Unity WebGL view embedded in the React app. It only displays what it is told; it never computes where the Sun or Earth are.

This view is not in [scope.md](scope.md) yet (see ticket 4.9).

## Where things are

| What | Where |
|---|---|
| React panel | `frontend/src/components/TerrainView.tsx` |
| Which areas have terrain | `frontend/src/terrain.ts` |
| The built view (68 MB) | `frontend/public/unity/` |

`frontend/public/unity/` holds two folders that must stay together:

- `Build/` (25 MB) is the view itself, downloaded when the page opens.
- `StreamingAssets/` (43 MB) is terrain the view downloads only when it needs it: the surroundings of the starting area (1.6 MB), each other area (about 5 MB), and the high-detail versions (about 12 MB each).

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

Updates are cheap, so the props can change on every scrubber step. The orbit and surface views and the **High detail** button are inside the panel.

## Areas with terrain

| Area | South polar stereographic metres | Source |
|---|---|---|
| Connecting Ridge | X -18998 to -3002, Y -19998 to -4002 | LOLA 5 m, with high detail |
| Shackleton rim | X -8998 to 6998, Y -14998 to 998 | LOLA 5 m, with high detail |
| Shackleton crater | X -296 to 15696, Y -14396 to 1596 | LOLA 20 m, no high detail |
| Malapert Massif | X -1856 to 14136, Y 113184 to 129176 | LOLA 20 m, no high detail |

Each is a 16 km square wrapped in coarser terrain out to 160 km. A site in another area makes the view download and switch to it (about 5 MB). A site outside all of them shows a message in the panel and the view stays where it was. Areas overlap; the view stays on the current one while it covers the site.

The three south pole presets in `sites.ts` all have 3D terrain. The Apollo presets do not.

## What the picture can and can't tell you

- The terrain is true scale with no vertical exaggeration, and the Moon's curvature is applied, so distant ground sits where it would really appear.
- Its shadows were checked against a direct calculation from the height data: they agree over about 96% of the detailed area, and the differences are soft bands along shadow edges. Mountains in the surrounding terrain shade the detailed area too.
- When the Earth is in front of the Sun (a lunar eclipse), the sunlight dims by the share of the Sun that is covered.
- The surrounding terrain is coarse (125 m to 500 m between samples). Use the backend's skyline for visibility numbers, and this view to show them.
- The dim bluish light on shadowed ground is a fill light so the terrain stays readable. It is not a calculation of earthshine.

## Changing the view itself

The Unity project that produces `frontend/public/unity/` is not in this repository. To change the view, rebuild it there and copy the new `Build/` and `StreamingAssets/` folders over the old ones.
