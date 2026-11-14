# Tech stack plan: Lunar Landing Site Navigator (thin core)

## Context
`doc/scope.md` defines the app. For now, build only the **Core** items (1-6) with the thinnest design that works. Agreed stack: Python + FastAPI backend, React + TS frontend, local SPICE for ephemeris, hosted at a public URL. **No caching for now**: every request computes live. Stretch goals (feasibility finder, landing ellipse) and Horizons validation are deferred.

## Stack
| Layer | Choice | Why |
|---|---|---|
| Ephemeris | `spiceypy` + NAIF kernels: `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `naif0012.tls`, `pck00011.tpc` | Offline, fast, any lat/lon; libration included |
| Terrain | LOLA DEMs via `rasterio` + `numpy`: cropped `LDEM_85S_20M` near the pole, global `LDEM_64` elsewhere and for the far horizon | Horizon lines need terrain out to ~100+ km; multi-resolution keeps memory small |
| Horizon algo | Ray-march 720 azimuths (0.5°) and take the max elevation angle, with lunar curvature | Simple, ~1 s per site |
| Model | numpy functions straight from the scope.md Model section | One place for all the metric math |
| API | FastAPI + pydantic. `GET /sites` (hardcoded presets), `POST /analyze` | Typed, minimal |
| Frontend | React + Vite + TS, `react-plotly.js` for the panorama and time series, plain `useState`. Site picker: dropdown + lat/lon inputs | Team knows React; Plotly gives hover and zoom for free |
| Hosting | Backend: Docker image on Render or Fly (kernels + cropped DEMs inside). Frontend: Vercel | Public URL as required |
| Caching | None for now; every request computes live | Keep it thin |

## Files
```
backend/
  app/main.py        routes
  app/ephemeris.py   sun/earth az/el
  app/horizon.py     DEM load + skyline
  app/model.py       power, battery, comms metrics
  app/sites.py       preset list
  scripts/fetch_data.py   download kernels + DEMs, crop
  requirements.txt
  Dockerfile
frontend/
  src/App.tsx
  src/components/{SiteForm,MetricCards,Panorama,TimeSeries,Compare}.tsx
```

## Build order (core 1-6)
1. `fetch_data.py`, `ephemeris.py`
2. `horizon.py` for one south pole site
3. `model.py` + `POST /analyze`
4. Frontend: site form → metric cards → panorama → time series with a slider scrubber → compare (up to 4, kept in client state)
5. Deploy

## Verification
- A few `pytest` checks: disc fraction at x=-1/0/1, battery clamping, flat DEM → horizon ≈ 0°.
- A south pole rim site shows a high % sunlit (~80%+).
- On the hosted URL: run a preset and a custom site, drag the scrubber, compare 2-3 sites.
