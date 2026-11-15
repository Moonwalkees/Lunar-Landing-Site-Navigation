# BUG-007 CUSTOM tag breaks mid-word on the board

Status: done
Owner: Maddie
Severity: low
Affects: board table (custom site rows)
Note: done. `.row .tag` made an unbreakable inline block in `board.css`.

## Summary
The CUSTOM tag after a custom site's name wraps as "CUSTO" / "M".

## Description
Add a custom site with a long-ish name (e.g. FREWLANDIA). The CUSTOM tag doesn't fit on the name's line and breaks between letters onto the second line.

## Intended behaviour
The tag stays whole: next to the name if it fits, otherwise moved to the next line as one word.

## Where it happens
Board table, site name cell of custom rows.

## Cause
`.row .nm` sets `overflow-wrap: anywhere` so long site names can break, and the inline `.tag` span inherits it.

## File
`frontend/src/board/board.css:171`

## Solution
**Chosen:** `.row .tag` in `frontend/src/board/board.css` gets `display: inline-block; white-space: nowrap; overflow-wrap: normal`, so the tag wraps as one unit.

**Strengths**
- One rule. Site names still break anywhere and still clamp to two lines.

**Limitations**
- If the name itself fills both clamped lines, the tag is clipped by the two-line clamp, as it was before.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Move the tag to its own line under the name | Adds row height for every custom row | Tag always visible, even with long names |
