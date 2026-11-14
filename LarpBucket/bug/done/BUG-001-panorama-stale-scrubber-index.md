# BUG-001 Panorama shows an out-of-range scrubber index after shrinking the window

Status: done
Owner: Aiken
Severity: low
Affects: frontend / scrubber (panorama ↔ time series link)

## Summary
After shortening the window, the panorama shows a scrubber position beyond the end of the window.

## Description
Drag the scrubber near the end (e.g. step 700 of 708), then change Window from 29.5 to 5 days. The time series clamps to 120/120, but the panorama still shows 700.

## Intended behaviour
Both panels always show the same, valid time index (≤ maxIndex).

## Where it happens
`App` passes the clamped index to `TimeSeries` but the raw `timeIndex` to `Panorama`.

## Cause
The clamp `Math.min(timeIndex, maxIndex)` is applied inline for one child only; the state itself is never clamped.

## File
`frontend/src/App.tsx:58`

Note: done. `App.tsx` clamps the index once and passes the same value to every panel.

## Solution
**Chosen:** `frontend/src/App.tsx` clamps the time index to the current maximum once (`index`) and passes that value to every panel.

**Strengths**
- Every panel gets the same valid index, whatever the window was changed to.

**Limitations**
- The stored index is not reset, so widening the window again returns to the old position.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Clamp inside each panel | Easy to miss one | No change to `App.tsx` |
| Reset the index in an effect when the window changes | An extra render and the position is lost | Stored state is always valid |
