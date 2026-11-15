# BUG-008 Tapping a map pin selects or opens the wrong site

Status: done
Owner: Maddie
Severity: high
Affects: board frontend: 3D hero map pins
Note: done (fix not yet confirmed in a browser). Screen-space pin picking in `HeroMap.tsx` replaces the 3D raycast against invisible hit spheres.

## Summary
With several sites close together on the map, tapping one pin selects a neighbour, or opens the detail view of the already-selected site.

## Description
Add two or three custom sites a few km apart (for example "Frewlandia", "Frewlandia 2", "Frewlandia 3") so their pins share the 24 km hero map. Tap a pin that isn't selected. Often a different pin gets selected. If the selected pin is the neighbour in front, the surface view opens for the selected site instead.

## Intended behaviour
The tapped pin (or its label) is the one selected. Tapping the already-selected pin opens its detail view.

## Where it happens
`HeroMap.tsx`, the "tap a pin" handler (`onUp`).

## Cause
Each pin carried an invisible `SphereGeometry(0.75)` hit mesh, about 1.5 map units across. That is large next to the spacing of nearby sites at the map's scale (24 km across the map). The tap raycast took `intersectObjects(...)[0]`, the sphere nearest the camera along the ray, so an overlapping neighbour in front won. The selected pin's sphere took the tap, and the branch for tapping the selected pin opened the detail view.

## File
`frontend/src/board/HeroMap.tsx:204-222` (before the fix)

## Solution
**Chosen:** `pickPin()` in `frontend/src/board/HeroMap.tsx` picks in screen space. A tap inside a visible pin label picks that pin. Otherwise each pin is projected to an on-screen segment from its foot to its label anchor, and the nearest one within 20 px wins. The hit spheres are removed.

**Strengths**
- What you tap is what you get: the decision uses what is drawn on screen, and pins no longer shadow each other.
- Labels (rank and name) are now tappable targets too.

**Limitations**
- Not yet confirmed in a browser. The headless test couldn't drive the map's render loop, so the pin labels were never positioned. Build passes.
- If two pins overlap on screen, the closer segment wins. Zooming in separates them.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Smaller hit spheres | Still wrong when pins overlap in depth, and harder to hit on touch | Least code |
| Raycast, then pick the hit closest to the ray rather than the camera | Still a 3D proxy for what's on screen | Keeps the raycaster |
