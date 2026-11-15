# Tech Stack

Agreed stack for the Lunar Landing Site Navigator. Scope and requirements live in [scope.md](scope.md).

## Principles
- **Thin first.** Build only the Core items (1-6 in scope.md) with the simplest design that works.
- **No caching for now.** Every request computes live.
- **Deferred:** feasibility finder, landing ellipse risk, Horizons validation, preset precompute/caching.

## Stack
| Layer | Choice | Why |
|---|---|---|
| Ephemeris | `spiceypy` + NAIF kernels: `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `naif0012.tls`, `pck00011.tpc` | Offline, fast, any lat/lon; libration included |
| Terrain | LOLA DEMs via `rasterio` + `numpy`: cropped `LDEM_85S_20M` near the pole, global `LDEM_64` elsewhere and for the far horizon | Horizon lines need terrain out to ~100+ km; multi-resolution keeps memory small |
| Horizon algo | Ray-march 720 azimuths (0.5°) and take the max elevation angle, with lunar curvature | Simple, ~1 s per site |
| Model | numpy functions straight from the scope.md Model section | One place for all the metric math |
| API | FastAPI + pydantic. `GET /sites` (hardcoded presets), `POST /analyze` | Typed, minimal |
| Frontend | React + Vite + TS, plain `useState`. Two UIs, switched at runtime by a top-right button (choice remembered; `?ui=` overrides; `VITE_UI` sets the default): `board` (default, `src/board/`, the dot-matrix design in [style.md](style.md), with `three` for the 3D map, canvas dot charts, and `qrcode-generator` for the mission card's QR code) and `classic` (`App.tsx`, `react-plotly.js` for the panorama). Site picker: dropdown + lat/lon inputs | Team knows React; three.js added 2026-11-15 for the approved 3D map |
| Hosting | Backend: Docker image on Render or Fly (kernels + cropped DEMs inside). Frontend: Vercel | Public URL for the judges |
| Caching | None for now | Keep it thin |

## Current model defaults

The demo uses a constant 100 W load and a 100 Wh battery capacity. Replace these temporary values when a mission power budget is available.

## Repo layout
```
backend/
  app/constants.py        physical constants
  app/ephemeris.py        Sun/Earth az/el
  app/horizon.py          DEM load + skyline
  app/main.py             routes
  app/model.py            model schemas
  app/sites.py            preset list
  app/utils.py            shared model calculations
  scripts/fetch_data.py   download kernels + DEMs, crop
  tests/
  requirements.txt
  Dockerfile
frontend/
  src/main.tsx            picks the UI (src/uiChoice.ts: ?ui=, saved choice, VITE_UI)
  src/board/              dot-matrix board UI (default)
  src/App.tsx             classic UI (BOARD VIEW / CLASSIC VIEW button, src/UiSwitch.tsx)
  src/components/{SiteForm,MetricCards,Panorama,TimeSeries,Compare}.tsx
doc/
  scope.md
  tech-stack.md
```

## Build order
Ticket numbers in `LarpBucket/` follow these steps (e.g. `2.1` is the first ticket of step 2).

1. **Data + ephemeris**: `fetch_data.py`, `ephemeris.py`
2. **Horizon**: `horizon.py`, working for one south pole site first
3. **Model + API**: `model.py`, `GET /sites`, `POST /analyze`
4. **Frontend**: site form → metric cards → panorama → time series with a slider scrubber → compare (up to 4 sites, kept in client state)
5. **Deploy**: backend on Render/Fly, frontend on Vercel

## Verification
- `pytest`: disc fraction at x = -1 / 0 / 1, battery clamping, flat DEM → horizon ≈ 0°.
- A south pole rim site shows a high % sunlit (~80%+).
- On the hosted URL: run a preset and a custom site, drag the scrubber, compare 2-3 sites.
