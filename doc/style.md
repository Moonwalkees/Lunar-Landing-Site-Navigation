# Style: Dot-Matrix Departure Board

Visual design for the Lunar Landing Site Navigator frontend. Scope lives in [scope.md](scope.md) and the stack in [tech-stack.md](tech-stack.md). This document only says how the frontend should look and feel.

**Status:** direction agreed in review, not yet implemented. The current `frontend/src/styles.css` is a placeholder and is replaced by this.

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
- **Dot chart:** drawn on a true grid with a **2.2 px** pitch. Dot diameter is 0.82 of the pitch. Each series is a band 6 dots tall.
- Layout spacing and component sizes are multiples of 4 px. Hairlines are 1 px.

## Rendering rules

- **Ordered dither only.** Terrain uses a 4x4 Bayer matrix quantised to three tones (`--space`, `--ash`, `--regolith`). Never random noise, which shimmers when the Sun moves.
- **Round dots, square chrome.** Data and terrain are round dots. Panels, lamps, buttons and chips are square with no border radius.
- **Dim by dither, not opacity.** A site in shadow gets a desaturated, darkened console and a ghosted row.
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
2. **Lamp strip.** Four annunciator lamps: sites lit, Earth AOS, lit + AOS, in shadow. Two columns on small screens.
3. **Board and chart.** Ranked board (7/12) with sort chips, and the dot chart panel (5/12). Stacked on screens narrower than 960 px.
4. **Time dock.** Fixed to the bottom of the screen: back / play / forward buttons, the scrubber, and the scrub time readout.

Max content width 1280 px. Side gutters are at least 16 px plus the safe-area inset.

## Components

### 3D map
- Orbit (drag), zoom (pinch or wheel), no pan. Limit the polar angle so the camera stays above ground.
- Pins are tapped to select. Hit targets are larger than the visible pin.
- Pin stem height is the site's score. Pin labels show the rank, and the selected pin shows rank and name.
- Selecting a site (pin or board row) flies the camera to it. A "fly to site" button re-centres closer.
- A ring on the ground marks the selected site.
- The terrain edge dissolves into black by dither.

### Board
- Columns: rank, site, score, sun %, comms %, both %, longest dark (hours), now (status).
- Row height at least 56 px. The selected row has a `--umbra` fill and a 4 px `--selected` bar on the left, and the site name turns `--selected`.
- Sun % is `--sun`, comms % is `--earth`.
- A row in `DARK·LOS` is ghosted (Doto 300, `--ash`).
- Sort chips: SCORE, SUN, COMMS, BOTH, NOW. NOW sorts by current state, then score.
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
Filled lamps carry state (`--sun`, `--earth`, `--ok`). An unlit lamp has a hairline border and `--ash` text. A warning lamp blinks in hard steps. Lamps have no glow.

### Console (selected site)
Site name in `--selected` Doto 900, status word, then three readouts: % sunlit, % contact, longest dark. It desaturates and darkens when the site is in shadow or has no sun.

### Dot chart
Three bands over the window (sun, Earth, both) in 6-hour cells. Unlit dots stay faintly visible as an unlit display. The scrub position is a column of `--regolith` dots. Dragging on the chart scrubs time.

### Time dock
- Back and forward step one 6-hour cell. Play steps automatically.
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

- [4.1](../LarpBucket/feature/4.1-placeholder-frontend-shell.md) shell: applies tokens, type and square chrome (see 4.8)
- [4.2](../LarpBucket/feature/4.2-api-client-and-analyze.md) Analyze: loading and error states use status words and ghosting
- [4.3](../LarpBucket/feature/4.3-presets-from-api.md) presets: board rows are the preset list
- [4.4](../LarpBucket/feature/4.4-panorama-chart.md) panorama: skyline uses the palette, Doto labels and dot-matrix look
- [4.5](../LarpBucket/feature/4.5-time-series-and-scrubber.md) time series and scrubber: dot chart and time dock
- [4.6](../LarpBucket/feature/4.6-compare-best-highlight.md) compare: board-style rows
- [4.8](../LarpBucket/feature/4.8-apply-style-tokens-and-type.md) apply tokens and type

## Open decisions

These need an answer from the team before the matching work starts. This document does not change scope or stack.

1. **3D map is out of scope today.** [scope.md](scope.md) lists "3D globe" under out of scope, and [tech-stack.md](tech-stack.md) has no three.js. The approved mock needs `three` (and its OrbitControls). Decide whether to add a 3D terrain map to scope, and if so update scope.md and tech-stack.md first. No ticket is filed for the map until then.
2. **Plotly versus dot-matrix charts.** The stack uses `react-plotly.js` for the panorama and time series. The mock draws the dot chart on a canvas. Decide whether to keep Plotly (restyled to this palette and Doto) or draw custom dot charts.
3. **Horizon panorama in the mock.** The mock has no panorama. Scope.md has it as Core 3. Decide where it sits (for example a "pin-eye" view beside or in place of the dot chart).
4. **Amber for unselected pins.** `--sun` is also the "power" colour. If that reads as sunlit data on the map, use `--regolith` for unselected pins.
5. **Mock source.** The mocks exist only as artifacts. If the team wants them kept in the repo, copy the HTML into `doc/` (not done).
6. **Performance.** The 2 px map renders about 6x more pixels than the 5 px version. Check frame rate on a phone before committing to it. 3 px is the fallback.
