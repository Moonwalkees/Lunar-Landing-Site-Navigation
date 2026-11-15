import { useEffect, useMemo, useRef } from "react";
import type { Analysis } from "../types";
import { azDeg, signedDeg } from "./data";
import { DOT_R, PITCH, dot, prepare, useWidth } from "./DotChart";
import { color } from "./palette";

interface Props {
  analysis: Analysis | null;
  timeIndex: number;
}

const ROWS = 72;

// The horizon panorama (scope.md Core 3) as a dot-matrix panel: the 360° skyline seen from the
// selected site, with the Sun and Earth tracks over the window and their positions at the scrub time.
// Track dots are solid where the body clears the skyline and dim where the terrain hides it.
export default function Skyline({ analysis, timeIndex }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const w = useWidth(cv);

  // Elevation range: fit the skyline and both tracks, but no more than 10° below the
  // lowest of the skyline and the horizon, so night-side tracks don't squash the terrain.
  const range = useMemo(() => {
    if (!analysis) return null;
    const { skyline, sun, earth } = analysis;
    const skyMin = Math.min(...skyline.el);
    const all = [...skyline.el, ...sun.el, ...earth.el];
    const lo = Math.max(Math.min(...all), Math.min(skyMin, 0) - 10);
    const hi = Math.max(...all);
    const pad = Math.max(0.5, 0.05 * (hi - lo));
    return { lo: Math.max(-90, lo - pad), hi: Math.min(90, hi + pad) };
  }, [analysis]);

  const i = analysis ? Math.min(timeIndex, analysis.times.length - 1) : 0;

  useEffect(() => {
    const el = cv.current;
    if (!el || !w || !analysis || !range) return;
    const h = ROWS * PITCH;
    const g = prepare(el, w, h);
    const cols = Math.floor(w / PITCH), x0 = (w - cols * PITCH) / 2;
    const rowOf = (e: number) => Math.round(((range.hi - e) / (range.hi - range.lo)) * (ROWS - 1));
    const colOf = (az: number) => Math.min(cols - 1, Math.max(0, Math.floor((((az % 360) + 360) % 360) / 360 * cols)));
    const X = (c: number) => x0 + c * PITCH + PITCH / 2, Y = (r: number) => r * PITCH + PITCH / 2;
    const C = { reg: color("--regolith"), ash: color("--ash"), dim: color("--ash-dim"), sun: color("--sun"), earth: color("--earth") };
    const sky = analysis.skyline, n = sky.el.length;
    const skyAt = (az: number) => sky.el[Math.round(((((az % 360) + 360) % 360) / 360) * n) % n];

    // Terrain: the skyline edge is lit, the ground below it is unlit dots.
    for (let c = 0; c < cols; c++) {
      const top = Math.max(0, rowOf(skyAt(((c + 0.5) / cols) * 360)));
      for (let r = top; r < ROWS; r++) dot(g, X(c), Y(r), r === top ? C.reg : C.dim, r === top ? 1 : 0.55);
    }
    // Level horizon (0° elevation), where it's in the sky.
    const r0 = rowOf(0);
    if (r0 >= 0 && r0 < ROWS) for (let c = 0; c < cols; c += 3) if (rowOf(skyAt(((c + 0.5) / cols) * 360)) > r0) dot(g, X(c), Y(r0), C.ash, 0.6);

    // Tracks over the window.
    const track = (az: number[], el: number[], fill: string) => {
      for (let k = 0; k < az.length; k++) {
        const r = rowOf(el[k]);
        if (r < 0 || r >= ROWS) continue;
        dot(g, X(colOf(az[k])), Y(r), fill, el[k] >= skyAt(az[k]) ? 0.9 : 0.3);
      }
    };
    track(analysis.earth.az, analysis.earth.el, C.earth);
    track(analysis.sun.az, analysis.sun.el, C.sun);

    // Positions now, never dithered: a solid disc when the body is visible, a hollow ring when
    // it's hidden. Visibility matches the backend metrics (Sun lit: fraction > 0; Earth linked: margin >= 0).
    const disc = (az: number, el: number, fill: string, visible: boolean) => {
      const r = rowOf(el);
      if (r < -2 || r > ROWS + 1) return;
      const x = X(colOf(az)), y = Y(Math.min(ROWS - 1, Math.max(0, r))), R = DOT_R * 5;
      if (visible) return dot(g, x, y, fill, 1, R);
      const lw = DOT_R * 1.5;
      g.globalAlpha = 1;
      g.strokeStyle = fill;
      g.lineWidth = lw;
      g.beginPath();
      g.arc(x, y, R - lw / 2, 0, 7);
      g.stroke();
    };
    disc(analysis.earth.az[i], analysis.earth.el[i], C.earth, analysis.earth.margin[i] >= 0);
    disc(analysis.sun.az[i], analysis.sun.el[i], C.sun, analysis.sun.fraction[i] > 0);
    g.globalAlpha = 1;
  }, [analysis, range, w, i]);

  const a = analysis;
  return (
    <section className="panel">
      <span className="cap mono">Horizon · 360° from site</span>
      <canvas ref={cv} hidden={!a} className="dotcv" role="img" aria-label="Terrain skyline around the site with the Sun and Earth paths" />
      {a ? (
        <>
          <div className="compass mono" aria-hidden="true"><span>N</span><span>E</span><span>S</span><span>W</span><span>N</span></div>
          <div className="readout">
            <span className="sun-c">SUN {azDeg(a.sun.az[i])} {signedDeg(a.sun.el[i])}</span>
            <span className="earth-c">EARTH {azDeg(a.earth.az[i])} {signedDeg(a.earth.el[i])}</span>
            <span>MARGIN {signedDeg(a.earth.margin[i])}</span>
          </div>
        </>
      ) : (
        <div className="empty">AWAITING DATA</div>
      )}
    </section>
  );
}
