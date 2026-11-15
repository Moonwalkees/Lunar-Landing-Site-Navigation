import { useMemo } from "react";
import { roverAt, roverCapacity, sunShare } from "../rover";
import type { Analysis } from "../types";

interface Props {
  analysis: Analysis;
  index: number;
  // Sits lower over the 2D map, clear of its height readout in the same corner.
  low?: boolean;
}

const CELLS = 12;

// The board's rover readout over the detail views (doc/style.md): a status word in Doto, mono
// captions, and the battery as a row of dots. What a rover parked at the site is getting at the
// scrub time; the numbers come from rover.ts, which only reads the analysis.
export default function RoverPanel({ analysis, index, low }: Props) {
  const capacity = useMemo(() => roverCapacity(analysis), [analysis]);
  const now = roverAt(analysis, index, capacity);
  const share = sunShare(now.sun);
  const lit = Math.round((now.battery / capacity) * CELLS);
  const link = now.link === "clear" ? "AOS" : now.link === "marginal" ? "MARGINAL" : "LOS";

  return (
    <div className={"rover-panel " + now.kind + (low ? " low" : "")} role="status">
      <div className="mono">Rover at site</div>
      <div className="word">{now.state}</div>
      <div className="rk">
        <div><span className="mono">Sun</span><b className={now.sun > 0 ? "s" : "off"}>{share.toUpperCase()}</b></div>
        <div><span className="mono">Power</span><b className={now.power > 0 ? "s" : "off"}>{Math.round(now.power)}W</b></div>
        <div><span className="mono">Earth</span><b className={now.link === "blocked" ? "off" : "e"}>{link}</b></div>
      </div>
      <div className="mono">Battery · {Math.round(now.battery)} Wh</div>
      <div className="cells" aria-hidden="true">
        {Array.from({ length: CELLS }, (_, i) => <i key={i} className={i < lit ? "on" : ""} />)}
      </div>
      <div className="mono">{now.hint}</div>
    </div>
  );
}
