# BUG-002 Step of 0 hours breaks the scrubber

Status: open
Owner:
Severity: low
Affects: frontend / site form + scrubber

## Summary
Typing 0 (or clearing) the Step field makes the scrubber max Infinity/NaN.

## Description
In Step (hours), type `0` or delete the value. `maxIndex` becomes `Infinity` (or `NaN`), and the slider label shows `/ Infinity`.

## Intended behaviour
Step is clamped to a sensible minimum (0.25 h) or the invalid value is rejected; the scrubber stays usable. The same applies to Window (days) ≤ 0.

## Where it happens
`maxIndex` calculation in `App`, fed by the Step input in `SiteForm`.

## Cause
`min` on the number input is not enforced when typing; no validation before dividing by `stepHours`.

## File
`frontend/src/App.tsx:25`
