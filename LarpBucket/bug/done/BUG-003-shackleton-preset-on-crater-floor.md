# BUG-003 Shackleton preset sits on the crater floor, not the rim

Status: done
Owner: Aiken
Severity: medium
Affects: site presets (frontend placeholder list, later GET /sites)
Note: done by changing the default, not the coordinates. The app now opens on Connecting Ridge; the Shackleton preset stays on the crater floor as the permanently dark case.

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
**Chosen:** Connecting Ridge is now the first south pole preset in `backend/app/sites.py`, so both UIs open on it (`defaultSite` in `frontend/src/sites.ts` takes the first south pole preset; `FALLBACK_SITE` matches for when the backend is down). The Shackleton preset keeps its coordinates. This was the team member's call: fix what the bug cost, which was a first screen of zeros, and keep the crater floor as an example of a site that never sees the Sun.

**Strengths**
- The first thing anyone sees after opening the app is a site with sunlight, power and Earth contact.
- Connecting Ridge is also the 3D view's built-in terrain, so the first 3D view loads without fetching another area.
- The crater floor stays on the board as a useful contrast: 0% sunlit, ranked last.

**Limitations**
- The intended behaviour written above is not met by this preset: it is still the crater's centre. It has since been renamed "Shackleton crater floor" and a lit rim-area site, "Peak near Shackleton", added (ticket 3.7).
- The backend rule in tech-stack.md > Verification ("a south pole rim site shows a high % sunlit") is covered by Connecting Ridge, not by this preset.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Move the preset onto the rim, with coordinates from a published study | Not done today; needs a source for the coordinates | Meets the intended behaviour |
| Rename it "Shackleton crater floor" | Changes a name other code and tests select by | Honest label with no new coordinates |
| Remove the preset | The dark case is worth showing | A board with no all-zero row |
