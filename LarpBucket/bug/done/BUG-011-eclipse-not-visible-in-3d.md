# BUG-011 The eclipse can't be seen in the 3D view

Status: done
Owner: Aiken
Severity: medium
Affects: frontend / 3D terrain view (surface and orbit views)
Note: done. The Earth is drawn in front of the Sun, gets a backlit orange rim while it covers it, and the Sun's glare is turned down while the two are close; new Unity build in `frontend/public/unity/`.

## Summary
During a lunar eclipse (seen from the Moon, the Earth passing in front of the Sun) the 3D view shows an ordinary Sun.

## Description
On the board, select Malapert Massif, scrub to 17 Aug 2027 08:00 UTC (32% of the Sun covered), open SURFACE VIEW and look at the Sun. The light on the ground is dimmed correctly (6.1), but the sky shows the Sun as usual and no Earth in front of it.

## Intended behaviour
The Earth's dark disc covers the matching part of the Sun, so the eclipse can be seen as well as measured.

## Where it happens
`LunarScene.OnCameraMoved` (Unity project), and the glow on the Sun disc.

## Cause
Two things. The Sun and Earth discs were placed at the same distance from the camera, so which one was drawn on top was not defined, and the Sun won. And the Sun disc is drawn far brighter than white so that it glows; that glow spread over the Earth's dark disc and hid it, even where the Earth was in front.

## File
`frontend/public/unity/Build/` (Unity source: `Assets/Scripts/LunarScene.cs`, `Assets/Shaders/LunarEarth.shader`; not in this repository, see `doc/3d-view.md`)

## Solution
**Chosen:** In the Unity view, the Earth disc is placed at 0.9 of the Sun's distance (both are scaled to their angular size, so neither looks different), so it covers the Sun when they overlap. The Earth shader adds an orange rim, sunlight through the atmosphere, only when the Sun is within 1.3 degrees of the Earth's centre. The Sun disc's glare is turned down to 6% while the two are within 1.4 degrees, rising back to full by 4 degrees.

**Strengths**
- The 17 Aug 2027 eclipse now shows as a dark Earth biting into the Sun, ringed in orange.
- Needs nothing new from the backend: it follows from the Sun and Earth directions the view is already sent.
- The light on the ground is unchanged: it is still dimmed by the covered share (6.1).

**Limitations**
- The Sun's glare is also turned down for a few hours each month when it passes near the Earth without an eclipse. That is display only.
- At the board's 2 h steps the peak of a short eclipse can fall between steps (32% shown at 08:00, 43% at 07:00 at 1 h steps).
- The orange rim's brightness is set by eye, not computed.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Draw the Earth after the glow effect | URP applies the glow to the whole frame; splitting it needs a second camera | Exact glow everywhere else |
| Turn the glow off altogether | The Sun would look like a flat white dot at all times | Simpler |
