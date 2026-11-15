import { useEffect, useMemo, useRef, useState } from "react";
import type { Analysis } from "../types";
import { CELL_HOURS, toCells } from "./data";
import { color } from "./palette";

// Shared dot grid (doc/style.md > Dot grid): Doto's 0.1 em pitch at the 22 px board text.
export const PITCH = 2.2;
export const DOT_R = PITCH * 0.41;

// Canvas width in CSS px, kept up to date. Also redraws once the web fonts are in.
export function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function prepare(cv: HTMLCanvasElement, w: number, h: number) {
  const dpr = window.devicePixelRatio || 1;
  cv.style.height = h + "px";
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const g = cv.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return g;
}

export function dot(g: CanvasRenderingContext2D, x: number, y: number, fill: string, alpha = 1, r = DOT_R) {
  g.globalAlpha = alpha;
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
}

interface Props {
  analysis: Analysis | null;
  timeIndex: number;
  maxIndex: number;
  onScrub: (i: number) => void;
}

// Five bands of equal height, in dot rows: sun, Earth and both as on/off bands, then power and
// battery as dot bar charts so scope.md Core 5 is on the board too. (style.md's 6-dot bands were
// made taller and equal at the user's request, 2026-11-15.)
const BAND_H = 16;
const BAND_GAP = 4;
const BANDS = (["sun", "earth", "both", "power", "battery"] as const).map((key, n) => ({
  key,
  r0: n * (BAND_H + BAND_GAP),
  h: BAND_H,
}));
const ROWS = BANDS.length * BAND_H + (BANDS.length - 1) * BAND_GAP;

export default function DotChart({ analysis, timeIndex, maxIndex, onScrub }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const w = useWidth(cv);
  const cells = useMemo(() => (analysis ? toCells(analysis) : null), [analysis]);
  const maxP = cells ? Math.max(1, ...cells.power) : 1;
  const maxB = cells ? Math.max(1, ...cells.battery) : 1;

  // The bands don't change with time, and they are some 17,000 dots: drawing them on every time
  // step is what held playback to about ten updates a second. They are drawn once here, off screen,
  // and each step copies that and adds the cursor column.
  const bands = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    bands.current = null;
    if (!w || !cells) return;
    const off = document.createElement("canvas");
    const g = prepare(off, w, ROWS * PITCH);
    const N = cells.sun.length, cols = Math.floor(w / PITCH), x0 = (w - cols * PITCH) / 2;
    const C = { sun: color("--sun"), earth: color("--earth"), ok: color("--ok"), reg: color("--regolith"), dim: color("--ash-dim") };
    for (let i = 0; i < cols; i++) {
      const c = Math.min(N - 1, Math.floor((i / cols) * N)), x = x0 + i * PITCH + PITCH / 2;
      for (const b of BANDS) {
        for (let r = 0; r < b.h; r++) {
          const y = (b.r0 + r) * PITCH + PITCH / 2;
          let on: boolean, fill: string;
          if (b.key === "power") { on = b.h - r <= Math.round((cells.power[c] / maxP) * b.h); fill = C.sun; }
          else if (b.key === "battery") { on = b.h - r <= Math.round((cells.battery[c] / maxB) * b.h); fill = C.reg; }
          else { on = cells[b.key][c]; fill = b.key === "sun" ? C.sun : b.key === "earth" ? C.earth : C.ok; }
          dot(g, x, y, on ? fill : C.dim, on ? 1 : 0.55);
        }
      }
    }
    bands.current = off;
  }, [cells, w, maxP, maxB]);

  useEffect(() => {
    const el = cv.current, off = bands.current;
    if (!el || !w || !cells || !off) return;
    const h = ROWS * PITCH;
    const g = prepare(el, w, h);
    g.drawImage(off, 0, 0, w, h);
    const N = cells.sun.length, cols = Math.floor(w / PITCH), x0 = (w - cols * PITCH) / 2;
    const cur = Math.min(cols - 1, Math.floor(((Math.floor(timeIndex / cells.steps) + 0.5) / N) * cols));
    const x = x0 + cur * PITCH + PITCH / 2, reg = color("--regolith");
    for (const b of BANDS) for (let r = 0; r < b.h; r++) dot(g, x, (b.r0 + r) * PITCH + PITCH / 2, reg);
    g.globalAlpha = 1;
  }, [cells, w, timeIndex, maxP, maxB]);

  // Re-draw once Doto/Geist have loaded and the panel may have reflowed.
  const [, bump] = useState(0);
  useEffect(() => { document.fonts?.ready.then(() => bump((n) => n + 1)); }, []);

  const scrubAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onScrub(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * maxIndex));
  };

  return (
    <aside className="panel">
      <span className="cap mono">Selected site · {CELL_HOURS} h cells</span>
      {/* Always mounted, so the width observer is attached before the data arrives. */}
      <canvas
        ref={cv}
        hidden={!analysis}
        className="dotcv scrub"
        role="img"
        aria-label="Sunlight, Earth contact, both, power and battery over the window. Drag to scrub."
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrubAt(e); }}
        onPointerMove={(e) => { if (e.buttons === 1) scrubAt(e); }}
      />
      {analysis ? (
        <>
          <div className="legend">
            <span><i style={{ background: "var(--sun)" }} />SUN</span>
            <span><i style={{ background: "var(--earth)" }} />EARTH</span>
            <span><i style={{ background: "var(--ok)" }} />BOTH</span>
            <span><i style={{ background: "var(--sun)" }} />POWER<small>0–{Math.round(maxP)} W</small></span>
            <span><i style={{ background: "var(--regolith)" }} />BATT<small>0–{Math.round(maxB)} Wh</small></span>
          </div>
        </>
      ) : (
        <div className="empty">AWAITING DATA</div>
      )}
    </aside>
  );
}
