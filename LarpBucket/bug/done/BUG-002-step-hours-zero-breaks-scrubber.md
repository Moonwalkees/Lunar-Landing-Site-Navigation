# BUG-002 Step of 0 hours breaks the scrubber

Status: done
Owner: Aiken
Severity: low
Affects: frontend / site form + scrubber
Note: done. Classic UI: the Window and Step boxes only pass on values in range, Analyze is disabled with a message otherwise, and `App.tsx` guards the scrubber maths. The board already rejected these.

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

## Solution
**Chosen:** `frontend/src/components/SiteForm.tsx` now uses a `NumberField` for Window and Step: the box keeps whatever is typed, but only a value in range reaches the app (Step 0.25 to 24 h, Window more than 0 and at most 400 days, the same limits the backend checks). Outside that, a message shows under the box and Analyze is disabled. `App.tsx` also returns 0 for the scrubber's maximum if the window or step is ever not positive. The board UI already validated both on RUN (`board/Panels.tsx`).

**Strengths**
- The scrubber can no longer show `/ Infinity` or `/ NaN`, whatever is typed.
- The user sees why Analyze is off, in the form, before a request is sent.
- Same limits as the backend's pydantic model, so nothing the form accepts gets a 422.

**Limitations**
- While a box holds an invalid value, the app keeps the last valid one; the message says the box is wrong, but the header still shows the previous value.
- A window and step that are each in range can still exceed the backend's 20,000-step limit (for example 400 days at 0.25 h); that still comes back as an error message after Analyze.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Clamp silently to 0.25 h | The user would not know their value was changed | No message needed |
| Only guard `maxIndex` in `App.tsx` | Analyze could still send 0 and get a 422 | One-line change |
