# BUG-003 Shackleton preset sits on the crater floor, not the rim

Status: open
Owner:
Severity: medium
Affects: site presets (frontend placeholder list, later GET /sites)

## Summary
The "Shackleton crater (Artemis III)" preset is the crater's centre, a permanently shadowed floor, so it will show almost no sunlight.

## Description
The preset is `(-89.67, 129.78)`, the published centre coordinates of Shackleton crater. The LOLA 20 m DEM (ticket 1.3) puts that point at -2789 m, and everything within 3 km of it lies between -2872 m and -1984 m. That is the crater floor, about 4 km below the rim. Artemis III candidate regions are on the rim and nearby ridges, and tech-stack.md > Verification expects "a south pole rim site shows a high % sunlit (~80%+)". Once the skyline and power model are wired up, this preset will report near 0% sunlit and a failed night survival.

Reproduce: `python scripts/fetch_data.py dems`, then read `data/dem/ldem_85s_20m_crop.tif` at (-89.67, 129.78), as in `backend/tests/test_dems.py`.

## Intended behaviour
The Shackleton preset should sit on the illuminated rim, for example the rim near the pole (the pole itself is on the rim at about +1290 m), using coordinates from a published Artemis III or rim illumination study.

## Where it happens
The preset list shown in the site dropdown.

## Cause
The placeholder list uses the crater's catalogue centre coordinates rather than a rim landing site.

## File
`backend/app/sites.py:7` (served by `GET /sites`)

## Solution
_Filled in when the ticket is done. See "Solution section" below._
