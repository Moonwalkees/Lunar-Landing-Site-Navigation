# Lunar Landing Site Navigator
 
NASA Space Apps 2026. Challenge: *Lunar Landing Site Navigator*.
 
Pick a spot on the Moon and a date range. See when the Sun (power) and Earth (direct-to-Earth comms) are above the real terrain horizon, quantified, and compare sites. Then go one step further: find which site and date combinations actually work for a mission, and how robust they are to landing error.
 
## Scope
 
### Core (must ship)
1. **Observer placement**: pick a preset site (Artemis III regions, Apollo, CLPS targets) or click/type any lat/lon.
2. **Date range**: start date + window length (default one lunar month), adjustable time step.
3. **Horizon panorama**: 360° terrain skyline (LOLA) with Sun and Earth positions and tracks.
4. **Metrics**
   - Power: W (vertical Sun-tracking panel), Wh/day, % time sunlit
   - Longest night, battery minimum, survives yes/no
   - Comms: Earth clearance above skyline (deg), % time visible, longest blackout
   - Countdown to next sunset / Earthset
   - % time with both power and comms
5. **Time series**: power, battery, comms state over the window, linked to the panorama by a time scrubber.
6. **Compare**: 2 to 4 observers side by side, best value per metric highlighted.
### Differentiators (Sunday)
7. **Feasibility finder**: enter mission constraints (battery, load, min comms hours/day, duration, earliest date). Get ranked feasible site x date windows.
8. **Landing ellipse risk**: sample touchdown points around the target, report the spread of outcomes (e.g. "90% of touchdowns survive the longest night").
### Out of scope
3D globe, rover path planning, thermal, dust, full link budget.
 
## Minimum user interaction
 
1. Open the app. A default south pole site and today's date are loaded.
2. Choose a site (dropdown or click/type coordinates).
3. Set a date range.
4. Read the headline cards, panorama and time series. Drag the scrubber to move through time.
5. Click **Add to compare** to pin the site; repeat for up to 4 sites.
## Data
| Source | Use |
|---|---|
| JPL Horizons API | Sun/Earth azimuth and elevation from a lunar surface point (DE441, libration included) |
| LOLA DEM (NASA PDS): `LDEM_85S_20M` polar, global DEM elsewhere | Terrain skyline per observer |
| LROC Quickmap, Moon Trek | Validation of illumination results |
 
Preset sites are precomputed and cached so the demo runs offline.
 
## Model
- Sun disc fraction above skyline: `f = 1 - (acos(x) - x*sqrt(1 - x^2)) / pi`, `x = (sun_el - skyline_el) / 0.267°`
- Power: `P = 1361 * area * efficiency * cos(sun_el) * f`
- Battery: `charge += (P - load) * dt`, clamped to [0, capacity]
- Comms margin: `earth_el - skyline_el(earth_az)`; blocked < 0°, marginal < 0.5°, clear above
