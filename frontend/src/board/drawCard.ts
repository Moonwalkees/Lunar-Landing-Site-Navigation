import qrcode from "qrcode-generator";
import { eclipseAt, eclipses, nextEclipse, pctCovered } from "../eclipses";
import { roverName } from "../rovers";
import { relief, sunlight } from "../terrain2d";
import type { Analysis, TerrainGrid } from "../types";
import { STATE_LABEL, hours, isAos, isLit, pct, score, splitName, stamp, stateAt, type State } from "./data";
import { color } from "./palette";

// The mission card (ticket 8.1): one site's results as a 1200 px wide PNG in the board's style
// (doc/style.md). Black, Doto for values, Geist Mono for captions, square chrome, the terrain as
// round dots dithered to three tones with a 4x4 Bayer matrix (as the hero map), and a QR code
// that opens the board on the same site, window, rover and time (share.ts).

export const CARD_W = 1200;
const MAX_H = 2400; // drawn on a canvas this tall, then cut to the height the content needs
const M = 64; // outer margin
const INNER = CARD_W - 2 * M;
const DOT = '"Doto", ui-monospace, monospace';
const MONO = '"Geist Mono", ui-monospace, monospace';
const RAD = Math.PI / 180;

export interface CardData {
  name: string;
  lat: number;
  lon: number;
  analysis: Analysis;
  index: number; // the time step shown
  window: { startDate: string; days: number };
  grid: TerrainGrid | null; // null draws the card without the terrain picture
  url: string; // what the QR code opens
}

const STATE_COLOR: Record<State, string> = { both: "--ok", sunonly: "--sun", comms: "--earth", dark: "--ash" };

type G = CanvasRenderingContext2D & { letterSpacing?: string };

export async function drawMissionCard(canvas: HTMLCanvasElement, d: CardData): Promise<void> {
  await loadFonts();
  const work = document.createElement("canvas");
  work.width = CARD_W;
  work.height = MAX_H;
  const g = work.getContext("2d") as G;
  const a = d.analysis, i = Math.min(d.index, a.times.length - 1);
  const sun = { az: a.sun.az[i], el: a.sun.el[i] }, earth = { az: a.earth.az[i], el: a.earth.el[i] };

  g.fillStyle = color("--space");
  g.fillRect(0, 0, CARD_W, MAX_H);
  g.textBaseline = "top";

  // ---- header ----
  caption(g, "Lunar Landing Site Navigator · Mission card", M, M);
  caption(g, `${d.window.days}-day window from ${d.window.startDate}`, CARD_W - M, M, "--ash", "right");
  hairline(g, M + 36);

  // ---- name and position ----
  const [main, qual] = splitName(d.name);
  let y = M + 64;
  const size = fitSize(g, main, 900, 96, 56, INNER);
  text(g, clip(g, main, INNER), M, y, `900 ${size}px ${DOT}`, "--selected");
  y += size + 20;
  const region = d.lat <= -80 ? "South pole" : d.lat >= 80 ? "North pole" : null;
  const where = [`Lat ${d.lat.toFixed(3)}°`, `Lon ${d.lon.toFixed(3)}°E`, region, qual?.replace(/\n/g, ", ")].filter(Boolean).join(" · ");
  caption(g, where, M, y, "--regolith", "left", 22);
  y += 22 + 36;

  // ---- terrain (left) and readouts (right) ----
  const TS = 640;
  terrain(g, d.grid, sun, earth, M, y, TS);
  readouts(g, a, M + TS + 56, y);
  y += TS + 20;
  caption(g, `Sun az ${sun.az.toFixed(1)}° el ${signed(sun.el)} · Earth az ${earth.az.toFixed(1)}° el ${signed(earth.el)}`, M, y, "--ash", "left", 18);
  y += 18 + 22;
  const state = stateAt(a, i);
  const atW = caption(g, `At ${stamp(a.times[i])} UTC`, M, y + 6);
  text(g, STATE_LABEL[state], M + atW + 20, y, `800 30px ${DOT}`, STATE_COLOR[state]);
  y += 30 + 36;

  // ---- Sun / Earth / both over the window ----
  y = strip(g, a, i, M, y, INNER) + 36;

  // ---- rover and eclipse ----
  const half = INNER / 2;
  caption(g, "Rover", M, y);
  text(g, roverName(a.rover), M, y + 30, `800 32px ${DOT}`, "--regolith");
  caption(g, `${n0(a.rover.solarW)} W solar · ${n0(a.rover.batteryWh)} Wh · uses ${n0(a.rover.loadW)} W`, M, y + 74, "--ash", "left", 18);
  const list = eclipses(a), now = eclipseAt(list, i), next = nextEclipse(list, i);
  caption(g, now ? "Eclipse now" : "Next eclipse", M + half, y);
  if (now) {
    text(g, pctCovered(a.sun.behindEarth[i] ?? 0).toUpperCase() + " OF THE SUN", M + half, y + 30, `800 32px ${DOT}`, "--selected");
    caption(g, `Peak ${pctCovered(now.covered)} at ${stamp(a.times[now.peak])}`, M + half, y + 74, "--ash", "left", 18);
  } else if (next) {
    text(g, stamp(a.times[next.peak]), M + half, y + 30, `800 32px ${DOT}`, "--selected");
    caption(g, `Up to ${pctCovered(next.covered)} of the Sun behind the Earth`, M + half, y + 74, "--ash", "left", 18);
  } else {
    text(g, "NONE IN WINDOW", M + half, y + 30, `800 32px ${DOT}`, "--ash");
  }
  y += 74 + 18 + 40;

  // ---- QR code and link ----
  hairline(g, y);
  y += 28;
  const box = qr(g, d.url, CARD_W - M, y, 300);
  caption(g, "Scan to open this mission", M, box.y);
  let host = d.url;
  try { host = new URL(d.url).host; } catch { /* keep the whole link */ }
  const hostSize = fitSize(g, host, 700, 30, 18, box.x - M - 32);
  text(g, host, M, box.y + 32, `700 ${hostSize}px ${DOT}`, "--regolith");
  caption(g, "Opens this site, window, rover and time on the board", M, box.y + 32 + hostSize + 14, "--ash", "left", 18);
  caption(g, "Elevation: NASA LOLA · Sun and Earth: NASA NAIF SPICE", M, box.y + box.size - 16, "--ash", "left", 16);

  canvas.width = CARD_W;
  canvas.height = Math.ceil(box.y + box.size + M);
  canvas.getContext("2d")!.drawImage(work, 0, 0);
}

// ---------- pieces ----------

// The terrain seen from above, north up, as round dots: lit by the Sun at this time with the
// real cast shadows (terrain2d.sunlight, as the hero and the 2D map), quantised to --space /
// --ash / --regolith with a 4x4 Bayer matrix, and dissolving into black at the edge.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function terrain(g: G, grid: TerrainGrid | null, sun: { az: number; el: number }, earth: { az: number; el: number }, x: number, y: number, size: number) {
  g.strokeStyle = color("--ash-dim");
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  if (!grid) {
    caption(g, "No terrain picture for this site", x + size / 2, y + size / 2 - 10, "--ash", "center");
    return;
  }
  const n = grid.size, c = (n - 1) / 2, pitch = size / n, r = pitch * 0.41;
  const lit = sunlight(grid, sun.az, sun.el), face = relief(grid, sun.az), nw = relief(grid);
  const ash = new Path2D(), reg = new Path2D();
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const k = row * n + col;
      let b = lit[k] * (0.3 + 0.7 * face[k]) + (1 - lit[k]) * 0.12 * nw[k];
      const edge = Math.hypot(row - c, col - c) / (n / 2);
      b *= 1 - smoothstep(0.8, 1.0, edge);
      const L = b * 2, t = Math.min(2, Math.floor(L) + (L - Math.floor(L) > (BAYER[(row % 4) * 4 + (col % 4)] + 0.5) / 16 ? 1 : 0));
      if (t === 0) continue;
      const px = x + (col + 0.5) * pitch, py = y + (row + 0.5) * pitch;
      const p = t === 1 ? ash : reg;
      p.moveTo(px + r, py);
      p.arc(px, py, r, 0, Math.PI * 2);
    }
  }
  g.fillStyle = color("--ash");
  g.fill(ash);
  g.fillStyle = color("--regolith");
  g.fill(reg);

  const cx = x + size / 2, cy = y + size / 2;
  // The site: a ring and a dot in --selected.
  g.strokeStyle = color("--selected");
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, 16, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = color("--selected");
  g.beginPath();
  g.arc(cx, cy, 4, 0, Math.PI * 2);
  g.fill();

  // Where the Sun and the Earth are, as solid discs on a circle round the site (az from north,
  // clockwise). Never dithered (doc/style.md > Colour).
  // When the two are close (an eclipse puts them together), the Sun's label goes on its left and
  // the Earth's on its right; otherwise each label sits on the side away from the site.
  const ring = size / 2 - 28;
  const close = Math.abs((((sun.az - earth.az) % 360) + 540) % 360 - 180) < 20;
  const marker = (az: number, tok: string, label: string, r: number, side: "left" | "right" | null) => {
    const mx = cx + ring * Math.sin(az * RAD), my = cy - ring * Math.cos(az * RAD);
    g.fillStyle = color(tok);
    g.beginPath();
    g.arc(mx, my, r, 0, Math.PI * 2);
    g.fill();
    const right = side ? side === "right" : mx < cx;
    caption(g, label, mx + (right ? 20 : -20), my - 9, tok, right ? "left" : "right", 18);
  };
  marker(sun.az, "--sun", "Sun", 12, close ? "left" : null);
  marker(earth.az, "--earth", "Earth", 9, close ? "right" : null);
  caption(g, "N ↑", x + 16, y + 16, "--regolith", "left", 18);

  // Scale bar, 5 km.
  const km5 = (5000 / (grid.spacingM * n)) * size;
  g.fillStyle = color("--regolith");
  g.fillRect(x + 16, y + size - 24, km5, 3);
  caption(g, "5 km", x + 16, y + size - 50, "--regolith", "left", 18);
}

function readouts(g: G, a: Analysis, x: number, y: number) {
  const m = a.metrics, s = score(a);
  caption(g, "Score", x, y);
  text(g, s === null ? "—" : String(s), x, y + 30, `900 112px ${DOT}`, "--regolith");
  caption(g, "/ 100", x + g.measureText(s === null ? "—" : String(s)).width + 12, y + 30 + 112 - 24, "--ash", "left", 18);
  const rows: [string, string, string][] = [
    ["% sunlit", pct(m.pctSunlit), "--sun"],
    ["% Earth contact", pct(m.pctEarthVisible), "--earth"],
    ["% Sun + Earth", pct(m.pctPowerAndComms), "--ok"],
    ["Longest dark", hours(m.longestNightH), "--regolith"],
  ];
  let yy = y + 30 + 112 + 40;
  for (const [label, value, tok] of rows) {
    caption(g, label, x, yy);
    text(g, value, x, yy + 28, `800 64px ${DOT}`, tok);
    yy += 28 + 64 + 26;
  }
}

// Three bands of dots across the window, as the board's dot chart: Sun, Earth and both. A column
// is on when the condition holds for at least half of its steps. Eclipses mark the Sun band in
// --selected; the card's time is a column of --regolith dots. Returns the y below it.
function strip(g: G, a: Analysis, i: number, x: number, y: number, w: number): number {
  const PITCH = 4, R = 1.64, ROWS = 5, LABEL = 96, GAP = 10;
  caption(g, "Over the window", x, y);
  y += 34;
  const n = a.times.length, cols = Math.floor((w - LABEL) / PITCH);
  const here = Math.min(cols - 1, Math.floor((i / n) * cols));
  const bands: [string, string, (k: number) => boolean][] = [
    ["Sun", "--sun", (k) => isLit(a, k)],
    ["Earth", "--earth", (k) => isAos(a, k)],
    ["Both", "--ok", (k) => isLit(a, k) && isAos(a, k)],
  ];
  bands.forEach(([label, tok, on], b) => {
    const top = y + b * (ROWS * PITCH + GAP);
    caption(g, label, x, top + 1, tok, "left", 18);
    const paths: Record<string, Path2D> = {};
    const add = (t: string) => (paths[t] ??= new Path2D());
    for (let col = 0; col < cols; col++) {
      const s = Math.floor((col / cols) * n), e = Math.max(s + 1, Math.floor(((col + 1) / cols) * n));
      let count = 0, eclipse = false;
      for (let k = s; k < e; k++) {
        if (on(k)) count++;
        if (b === 0 && a.sun.behindEarth[k] > 0) eclipse = true;
      }
      const t = col === here ? "--regolith" : eclipse ? "--selected" : count / (e - s) >= 0.5 ? tok : "--ash-dim";
      const p = add(t), px = x + LABEL + col * PITCH + PITCH / 2;
      for (let r = 0; r < ROWS; r++) {
        const py = top + r * PITCH + PITCH / 2;
        p.moveTo(px + R, py);
        p.arc(px, py, R, 0, Math.PI * 2);
      }
    }
    for (const [t, p] of Object.entries(paths)) {
      g.fillStyle = color(t);
      g.fill(p);
    }
  });
  y += 3 * (ROWS * PITCH) + 2 * GAP + 12;
  caption(g, (a.times[0] ?? "").slice(0, 10), x + LABEL, y, "--ash", "left", 16);
  caption(g, (a.times[n - 1] ?? "").slice(0, 10), x + w, y, "--ash", "right", 16);
  return y + 16;
}

// The QR code, dark modules on a --regolith square with the standard four-module quiet zone,
// whole pixels per module so it stays sharp. Top-right corner at (right, top).
function qr(g: G, data: string, right: number, top: number, max: number) {
  const code = qrcode(0, "M");
  code.addData(data);
  code.make();
  const count = code.getModuleCount(), quiet = 4;
  const m = Math.max(2, Math.floor(max / (count + 2 * quiet)));
  const size = m * (count + 2 * quiet), x = right - size, y = top;
  g.fillStyle = color("--regolith");
  g.fillRect(x, y, size, size);
  g.fillStyle = color("--space");
  for (let r = 0; r < count; r++)
    for (let c = 0; c < count; c++)
      if (code.isDark(r, c)) g.fillRect(x + (c + quiet) * m, y + (r + quiet) * m, m, m);
  return { x, y, size };
}

// ---------- type ----------

let fonts: Promise<unknown> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    [`900 96px ${DOT}`, `800 64px ${DOT}`, `700 30px ${DOT}`, `500 20px ${MONO}`].map((f) => document.fonts.load(f).catch(() => [])),
  );
  return fonts;
}

function text(g: G, s: string, x: number, y: number, font: string, tok: string, align: CanvasTextAlign = "left") {
  g.font = font;
  g.letterSpacing = "0px";
  g.textAlign = align;
  g.fillStyle = color(tok);
  g.fillText(s, x, y);
}

// Geist Mono captions: upper case, letter-spaced (doc/style.md > Type). Returns the width drawn.
function caption(g: G, s: string, x: number, y: number, tok = "--ash", align: CanvasTextAlign = "left", size = 20) {
  g.font = `500 ${size}px ${MONO}`;
  g.letterSpacing = `${(size * 0.08).toFixed(1)}px`;
  g.textAlign = align;
  g.fillStyle = color(tok);
  g.fillText(s.toUpperCase(), x, y);
  const w = g.measureText(s.toUpperCase()).width;
  g.letterSpacing = "0px";
  return w;
}

function hairline(g: G, y: number) {
  g.fillStyle = color("--ash-dim");
  g.fillRect(M, y, INNER, 1);
}

// The largest Doto size, from `max` down to `min`, at which `s` fits in `width`.
function fitSize(g: G, s: string, weight: number, max: number, min: number, width: number) {
  g.letterSpacing = "0px";
  for (let size = max; size > min; size -= 2) {
    g.font = `${weight} ${size}px ${DOT}`;
    if (g.measureText(s).width <= width) return size;
  }
  return min;
}

// `s` cut with an ellipsis to fit `width` in the current font.
function clip(g: G, s: string, width: number) {
  if (g.measureText(s).width <= width) return s;
  let t = s;
  while (t.length > 1 && g.measureText(t + "…").width > width) t = t.slice(0, -1);
  return t + "…";
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const signed = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "°";
const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
