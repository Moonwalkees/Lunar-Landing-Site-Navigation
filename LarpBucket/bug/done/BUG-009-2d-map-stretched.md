# BUG-009 2D map is stretched when its panel isn't 16:9

Status: done
Owner: Tony Pham
Note: done in 4.27. The canvas bitmap now follows the stage's real width and height.
Severity: medium
Affects: frontend 2D bird's-eye map (board UI detail view)

## Summary
The 2D terrain map stretches unevenly. The round site marker becomes an oval and craters are squashed.

## Description
Open a site in the board UI and switch the detail view to the 2D bird's-eye map. The terrain stage is a flex box whose height isn't 16:9 of its width. The map image is stretched to fill it: the site marker draws as an oval and the crater looks wider than it is.

## Intended behaviour
The map keeps a 1:1 aspect at any panel size. Circles stay circular and distances on the scale bar are the same in both directions.

## Where it happens
`TerrainMap` in the board UI's detail view (`Detail3D.tsx`), and in the classic UI whenever the stage isn't exactly 16:9.

## Cause
`TerrainMap.tsx` sizes the canvas bitmap to `width × width·9/16` and only watches the width. In the board UI, `.u3d .terrain-stage canvas` is styled `width: 100%; height: 100%` (`board.css:240`). So the browser stretches the 16:9 bitmap to the stage's real height.

## File
`frontend/src/components/TerrainMap.tsx:106`

## Solution
**Chosen:** In `frontend/src/components/TerrainMap.tsx`, the ResizeObserver stores `{ width, height }` from `contentRect`, and the canvas bitmap is sized to both (× devicePixelRatio). The fixed `width × 9/16` is gone, except as a fallback when the measured height is 0. The wheel handler and the opening view use the real rect, so zoom and pan stay consistent.

**Strengths**
- One source of truth, the box CSS gives the canvas, so it is correct in both UIs and at any panel size.

**Limitations**
- Relies on the stage giving the canvas a definite height (true for both `.terrain-stage` rules today).

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Force the board stage to `aspect-ratio: 16/9` in CSS | Fights the board's flex layout and leaves gaps | No JS change |
| `object-fit: contain` on the canvas | Letterboxes and wastes panel space; pointer maths would need the letterbox offset | Simpler sizing |
