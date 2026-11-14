# BUG-005 Can't type a lone "-" in the lat/lon inputs

Status: open
Owner:
Severity: medium
Affects: frontend site form

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
_Filled in when the ticket is done. See "Solution section" in CLAUDE.md._
