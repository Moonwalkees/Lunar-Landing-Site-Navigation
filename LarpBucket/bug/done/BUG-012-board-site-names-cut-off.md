# BUG-012 Site names are cut off on the board

Status: done
Owner: Aiken
Severity: low
Affects: frontend / board UI (ranked site list, map pins)
Note: done. A trailing "(...)" in a site name is shown as a small tag under the name; names may wrap to three lines. `board/data.ts` (`splitName`), `board/Board.tsx`, `board/BoardApp.tsx`, `board/board.css`.

## Summary
Four of the six preset names end in an ellipsis in the board's site list.

## Description
Open the board. "Malapert Massif (Artemis III)", "Peak near Shackleton (Artemis III, 2022)", "Connecting Ridge (Artemis III, 2022)" and "Shackleton crater floor" show as "Malapert Massif…", "Peak near Shackleto…" and so on. The name column is about 120 px wide and names were clamped to two lines.

## Intended behaviour
Every site's name can be read in full.

## Where it happens
The SITE column of the ranked board, and the pin labels on the main map.

## Cause
The longer, sourced labels from 3.7 added a qualifier in brackets, and the column only fits about ten characters a line at the board's 20 px name size.

## File
`frontend/src/board/Board.tsx` and `frontend/src/board/board.css` (`.row .nm`)

## Solution
**Chosen:** `splitName` in `board/data.ts` splits "Peak near Shackleton (Artemis III, 2022)" into the name and its qualifier. The row shows the name (up to three lines) and the qualifier underneath as a small mono tag, one part per line ("ARTEMIS III", "2022 LIST"). The 2D ONLY tag sits the same way, flush with the name. Map pins use the name only. The names served by `GET /sites` are unchanged.

**Strengths**
- Nothing is cut off, at desktop or phone width.
- Keeps doc/style.md's sizes: names stay Doto 20 px, captions Geist Mono 11 px.
- Works for any name in the form "Name (qualifier)", including future presets.

**Limitations**
- Rows with a two-line name and a two-line tag are taller than before.
- A bare year in the qualifier is read as "that year's list", which fits the current presets only.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Shorter preset names in the backend | Would lose the label's meaning in the classic UI and the API | No board change |
| Smaller name text | doc/style.md sets 20 px for site names | Fewer lines |
| Narrower number columns | Values like "8762h" need the room | Wider name column |
