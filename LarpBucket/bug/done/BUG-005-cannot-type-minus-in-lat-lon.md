# BUG-005 Can't type a lone "-" in the lat/lon inputs

Status: done
Owner: Aiken
Severity: medium
Affects: frontend site form
Note: done. Board UI fixed by Thomas Frew (text inputs in `board/Panels.tsx`); classic UI fixed the same way in `components/SiteForm.tsx`.

## Summary
Typing "-" to start a negative latitude or longitude snaps the field back to 0.

## Description
In the site form, clear the Latitude (or Longitude) box and type `-` to begin a negative value such as `-89.5`. The `-` vanishes and the box shows `0`, so you can't type a negative number from the start. Workarounds: type the digits first and add the `-` in front afterwards, or use the spinner arrows. Most south-pole sites have negative latitudes, so this comes up all the time.

## Intended behaviour
The box should accept partial input such as `-`, `-8` or `-89.` while you type, and only send a number to the site state once the text parses as a valid number.

## Where it happens
`SiteForm` Latitude and Longitude inputs. The Days and Step (h) inputs use the same pattern and have the same problem when cleared (they jump to 0).

## Cause
These are controlled `<input type="number">` elements with `value={site.lat}` and `onChange={(e) => ... Number(e.target.value)}`. While the text is just `-`, the browser reports `e.target.value` as `""`. `Number("")` is `0`, so state becomes `0` and React re-renders the box as `0`, wiping the `-`.

## File
`frontend/src/components/SiteForm.tsx:46-52` (also `:60` and `:64-65`)

## Solution
**Chosen:** Text inputs with `inputMode="decimal"` in place of `type="number"`, holding what the user types as text and passing a number on only when it parses and is in range. The board UI was done this way in `board/Panels.tsx`; the classic UI now uses the same approach through `NumberField` in `components/SiteForm.tsx` for latitude, longitude, window and step.

**Strengths**
- A leading "-" stays in the box, so negative south pole coordinates can be typed in order.
- Phones still get a numeric keypad.
- A half-typed value ("-", "-89.") never reaches the app as 0.

**Limitations**
- No spinner arrows on these boxes any more.
- A lone "-" shows the range message until a digit follows.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Keep `type="number"` and ignore empty values | The browser still reports "-" as empty, and the box can still lose it | Spinner arrows kept |
| Separate N/S and E/W selectors | More controls for a common case | No minus sign needed |
