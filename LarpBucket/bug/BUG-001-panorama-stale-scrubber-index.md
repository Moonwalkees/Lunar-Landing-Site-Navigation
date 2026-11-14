# BUG-001 Panorama shows an out-of-range scrubber index after shrinking the window

Status: open
Owner:
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
