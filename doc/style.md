# Style: Dot-Matrix Departure Board

Visual design for the Lunar Landing Site Navigator frontend. Scope lives in [scope.md](scope.md) and the stack in [tech-stack.md](tech-stack.md). This document only says how the frontend should look and feel.

**Status:** implemented in `frontend/src/board/` (ticket 4.12), the default UI. The original UI stays available through the **CLASSIC VIEW** button to the right of the clock stats, top-right of the map (a console-style `.cbtn`-look button; ticket 4.22), or `?ui=classic`.

## Reference mocks

These are private Claude artifacts. Open them while signed in. The mocks use sample data and are the visual source of truth for anything this document does not spell out.

| Mock | Link | Use |
|---|---|---|
| Direction deck (original) | https://claude.ai/artifact/WY9cRyrqzcdPhFzmqkw96Z | Where the type, colour and pixel rules come from. Apollo mission-control vocabulary. |
| Board mock (v1, no 3D) | https://claude.ai/artifact/KGEC5wf3bYb8QVjjFMcHAx | Departure-board table, lamp strip, dot chart, scrubber dock. |
| **Board + 3D map (approved)** | https://claude.ai/artifact/8rZAZX6ExbnLL4wJNtCon5 | **Current reference.** 3D dot-matrix terrain as the hero, with the board below. |

## Direction

A modern dot-matrix departure board for the Moon, using Apollo mission-control vocabulary (AOS, LOS, annunciator lamps, mission clock).

- **Dots are the one material.** Terrain, type, charts and gauges are all made of dots, so they read as one display.
- **Board first.** Ranked sites are a table, like a departure board. The 3D map is the hero and the board is the primary list.
- **Apollo words, board layout.** Labels are terse and upper-case. No split-flap mechanics; digits and rows change in hard steps.
- **State shows as texture before colour.** Darkness dithers, lost comms ghosts the row, a lit site is solid.
- **Touch first.** Everything works with a thumb. See [Touch and mobile](#touch-and-mobile).

## Colour

Single dark theme by choice. Define as CSS custom properties on `:root` and set `color-scheme: dark`.

| Token | Value | Meaning |
|---|---|---|
| `--space` | `#000000` | Background, sky, unlit |
| `--umbra` | `#1B2230` | Shadow, selected row fill, dither fill |
| `--regolith` | `#D9D6CF` | Lit dots, primary text |
| `--ash` | `#8C867A` | Half-lit dots, labels, ghosted values |
| `--ash-dim` | `#3A3832` | Unlit dots, hairlines, grid |
| `--sun` | `#FFB43B` | Power / sunlight data |
| `--earth` | `#2FB5C4` | Earth link / comms data |
| `--ok` | `#7BD66B` | Sun and Earth both available (board status, "both" series) |
| `--selected` | `#FF5A36` | The selected site |

- Green and yellow are allowed on the board (agreed in review). Keep `--ok` for "both", and do not use phosphor green for ordinary text. Lit text stays `--regolith`.
- **Pins:** unselected pins are `--sun`, the selected pin is `--selected`. Each pin is one solid colour.
- Sun and Earth discs in the 3D scene are solid `--sun` and `--earth` and are never dithered.

## Type

| Face | Use |
|---|---|
| **Doto** (weights 100-900) | Everything on the board, charts, readouts, clock, site names, buttons, lamps, headings. Always. |
| **Geist Mono** | Tiny captions only: panel captions, eyebrows, field labels (10-11 px, upper-case, letter-spaced). |
| Inter Tight | Rare body copy, if any. |

- **Doto never goes below 18 px.** Below that, use Geist Mono.
- Doto weights: 900 headlines and site names, 800 readouts and status words, 700 default board text, 500 column headers, 300 ghosted or inactive values.
- `font-variant-numeric: tabular-nums` on every number.
- Load from Google Fonts: Doto `wght@100..900` and Geist Mono `400;500`. Give every face a real fallback stack.

## Dot grid and pixel size

All dot-matrix surfaces share one dot size, so the page looks like one display.

- Doto's dot pitch is **0.1 em** (measured from the font). At the 22 px board row text, that is about **2.2 px** between dots.
- **3D map:** render the WebGL canvas at low resolution and scale it up with `image-rendering: pixelated` and a round-dot CSS mask. Cell size is **2 px** above 900 px wide and **3 px** below. 5 px was tried and is too coarse.
- **Dot chart:** drawn on a true grid with a **2.2 px** pitch. Dot diameter is 0.82 of the pitch. Each series (sun, Earth, both, power, battery) is a band 16 dots tall, all the same height.
- Layout spacing and component sizes are multiples of 4 px. Hairlines are 1 px.

## Rendering rules

- **Ordered dither only.** Terrain uses a 4x4 Bayer matrix quantised to three tones (`--space`, `--ash`, `--regolith`). Never random noise, which shimmers when the Sun moves.
- **Round dots, square chrome.** Data and terrain are round dots. Panels, lamps, buttons and chips are square with no border radius.
- **Dim by dither, not opacity.** When the selected site is in shadow the whole page background (`--bg`) is near-black `--space`; while it is lit it is slightly lighter. Text is never dimmed. Boxes (panels, inputs, captions, lamps, the site console) are always solid black; the tint and static only show in the gaps between them. While the selected site has lost Earth (LOS), faint static sits behind the page content (ticket 8.3). It jumps in hard steps and holds still under reduced motion; this is the one place noise is allowed, and it never touches terrain. A site in shadow also gets a ghosted row.
- **Two kinds of motion.** Camera moves, light and the time scrub ease smoothly. Readouts, lamps and status words change in hard steps (`steps()`). Respect `prefers-reduced-motion`.
- **No glow, bloom or gradient text.** Brightness comes from dot density.
- **Real shadows.** The 3D map computes shadows from the height texture in the shader, so they move with the Sun as time is scrubbed.

## Layout

Top to bottom on every width:

1. **Hero map.** Full-bleed 3D dot-matrix terrain, about 80% of the viewport height (520-860 px). HUD on top of it:
   - title and "sample data" flag, top left
   - clock cells: UTC, Sun az, Sun el, Earth el, top right
   - interaction hint, bottom left (hidden on small screens)
   - selected-site **console**, bottom right on desktop, a full-width strip on mobile
2. **Lamp strip.** Four annunciator lamps: total sites, lit, Earth AOS, lit + AOS. Plain counts (no "2/5"); the total is its own lamp. Two columns (2x2) on small screens. ("In shadow" was dropped at the user's request.)
3. **Mission window.** Start date, days and step controls in a bordered panel, directly under the lamp strip.
4. **Board and chart.** Ranked board (7/12) with sort chips, in a bordered panel like the side panels, and the dot chart panel (5/12). Stacked on screens narrower than 960 px.
5. **Time dock.** Fixed to the bottom of the screen: back / play / forward buttons, the scrubber, and the "Time (UTC)" readout of the scrub time.

Max content width 1280 px. Side gutters are at least 16 px plus the safe-area inset.

## Components

### 3D map
- Orbit (drag), zoom (pinch or wheel), no pan. Limit the polar angle so the camera stays above ground.
- Pins are tapped to select. Hit targets are larger than the visible pin.
- Pin stem height is the site's score. Pin labels show the rank, and the selected pin shows rank and name.
- Selecting a site (pin or board row) flies the camera to it. (A "fly to site" button was dropped on 2026-11-15 at the user's request.)
- A ring on the ground marks the selected site.
- The terrain edge dissolves into black by dither.

### Board
- Columns: rank, site, score, sun %, comms %, both %, longest dark (hours), LIT and COMMS right now (`YES` in `--sun` / `--earth`, `NO` in `--ash` Doto 300). Row text 18 px, site names 20 px. (Changed from a single NOW status word at the user's request, 2026-11-15.)
- **+ ADD SITE** in the sort bar opens a lat/lon form above the rows. Custom rows are not tagged.
- Each row ends in a **⋮** menu: GO TO SITE, SURFACE VIEW, DELETE. The site console shows SURFACE VIEW and DELETE as full-width buttons (DELETE in `--selected`); GO TO SITE is left out there since the console is already on the map. DELETE is disabled when only one site is left.
- Row height at least 56 px. The selected row has a `--umbra` fill and a 1 px (hairline) `--selected` bar on the left, and the site name turns `--selected`.
- Sun % is `--sun`, comms % is `--earth`.
- A row in `DARK·LOS` is ghosted (Doto 300, `--ash`).
- Sort chips: SCORE, SUN, COMMS, BOTH. (NOW sort removed at the user's request, 2026-11-15.)
- Under 720 px, each row becomes a two-line card: rank, name and status on the first line, five labelled stats on the second.

### Status words
Status uses two parts, light then link.

| Word | Meaning | Colour |
|---|---|---|
| `LIT·AOS` | Sun and Earth both visible | `--ok` |
| `LIT·LOS` | Sun visible, no Earth | `--sun` |
| `DARK·AOS` | In shadow, Earth visible | `--earth` |
| `DARK·LOS` | Neither | `--ash`, Doto 300 |

### Annunciator lamps
Filled lamps carry state (`--sun`, `--earth`, `--ok`). SITES is always filled `--regolith` and LIT + AOS is always filled `--ok`, even at 0; LIT and Earth AOS fill only when non-zero. An unlit lamp has a hairline border and `--ash` text. Lamps have no glow. (The blinking "MOST DARK" warning was dropped at the user's request.)

### Console (selected site)
Site name in `--selected` Doto 900, a small mono `LAT … · LON …°E` line, then five readouts: % sunlit, % contact, max dark, LIT and COMMS (YES in `--sun` / `--earth`, NO in `--ash`, as the board's columns). All five readouts get equal-width columns; the console is 520 px wide on desktop. On phones LIT and COMMS wrap to a second row. Its background follows the page background (`--bg`), which is slightly lighter (`--ash-dim` mixed into `--space`) while the selected site is lit. The text and readouts are never dimmed.

### Dot chart
Three bands over the window (sun, Earth, both) in 6-hour cells. Unlit dots stay faintly visible as an unlit display. The scrub position is a column of `--regolith` dots. Dragging on the chart scrubs time.

### Time dock
- Back and forward step one 6-hour cell. Play steps automatically in whole cells.
- A SPEED button cycles 6H/S, 1D/S (default), 4D/S, 10D/S of mission time per second. Faster speeds jump more cells per tick, never more than 4 ticks a second.
- The scrubber is a full-width range with a dotted track and a block thumb at least 44 px tall.
- All buttons are at least 56 px square on the dock.

## Touch and mobile

- Touch controls are required, not optional.
- Minimum tap target 44 px (chips, rows, buttons, thumb).
- Map gestures: one finger orbits, two fingers pinch-zoom, a short tap on a pin selects. The map canvas uses `touch-action: none`.
- Honour `env(safe-area-inset-*)` for the side gutters and the dock.
- On phones the console becomes a full-width strip over the bottom of the map, the lamps wrap to two columns, and the board rows become cards.
- No horizontal page scroll at 400 px.

## Don't

- No Doto under 18 px.
- No dithering the Sun or Earth discs.
- No retro-game styling (8-bit sprites, chunky borders, CRT curvature, scanlines).
- No glow, neon, bloom or gradient text.
- No border radius on panels, buttons, lamps or chips.
- No split-flap or rolling-digit animation.
- No fake numbers in the shipped app. Every value in the mocks is a sample until the backend is wired in.

## Frontend tickets

- [4.1](../LarpBucket/feature/done/4.1-placeholder-frontend-shell.md) shell: applies tokens, type and square chrome (see 4.8)
- [4.2](../LarpBucket/feature/done/4.2-api-client-and-analyze.md) Analyze: loading and error states use status words and ghosting
- [4.3](../LarpBucket/feature/done/4.3-presets-from-api.md) presets: board rows are the preset list
- [4.4](../LarpBucket/feature/done/4.4-panorama-chart.md) panorama: skyline uses the palette, Doto labels and dot-matrix look
- [4.5](../LarpBucket/feature/done/4.5-time-series-and-scrubber.md) time series and scrubber: dot chart and time dock
- [4.6](../LarpBucket/feature/done/4.6-compare-best-highlight.md) compare: board-style rows
- [4.8](../LarpBucket/feature/done/4.8-apply-style-tokens-and-type.md) apply tokens and type
- [4.12](../LarpBucket/feature/done/4.12-dot-matrix-board-ui.md) board UI (built; `VITE_UI` switch)

## Open decisions

These need an answer from the team before the matching work starts. This document does not change scope or stack.

1. **3D map.** Decided 2026-11-15: `three` is added to the stack. The hero is the real `GET /terrain` grid around the selected site, dithered as above, with shadows from `terrain2d.sunlight()`. The console's **SURFACE VIEW** button (or tapping the selected pin) opens an unfiltered detail view: the Unity surface and orbit views (`doc/3d-view.md`) plus the 2D bird's-eye map (`doc/2d-view.md`). The tabs run 2D MAP, ORBIT, SURFACE, and the view opens on orbit. Each map shows one 24 km site area, so pins for other sites appear only when they fall inside it.
2. **Plotly versus dot-matrix charts.** The board UI draws custom canvas dot charts; Plotly is only used by the classic UI. The dot chart adds power and battery bands below sun / Earth / both, to cover scope.md Core 5.
3. **Horizon panorama in the mock.** The board puts it as a dot-matrix "Horizon" panel under the dot chart, with a Metrics panel (all of Core 4) below it. Board score: `0.4 × % sunlit + 0.3 × % Earth visible + 0.3 × % both`, from the mock, computed from the backend's metrics.
4. **Amber for unselected pins.** `--sun` is also the "power" colour. If that reads as sunlit data on the map, use `--regolith` for unselected pins.
5. **Mock source.** The mocks exist only as artifacts. If the team wants them kept in the repo, copy the HTML into `doc/` (not done).
6. **Performance.** The 2 px map renders about 6x more pixels than the 5 px version. Check frame rate on a phone before committing to it. 3 px is the fallback.
