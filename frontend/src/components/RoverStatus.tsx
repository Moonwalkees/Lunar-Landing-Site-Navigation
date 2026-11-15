import { useMemo } from "react";
import { roverAt, roverCapacity, sunShare, type RoverKind } from "../rover";
import type { Analysis } from "../types";

interface Props {
  analysis: Analysis;
  index: number;
}

const SUN = "#c08a1c";
const EARTH = "#4a8fe6";
const COLOUR: Record<RoverKind, string> = { charging: "#3fa66a", full: "#3fa66a", battery: "#d29922", empty: "#f85149" };

// The classic UI's status card over the terrain view: what a rover parked at the site is
// getting at the scrubber time. The numbers come from rover.ts, which only reads the analysis.
export default function RoverStatus({ analysis, index }: Props) {
  const capacity = useMemo(() => roverCapacity(analysis), [analysis]);
  const now = roverAt(analysis, index, capacity);
  const colour = COLOUR[now.kind];
  const share = sunShare(now.sun);

  return (
    <div className="rover-status" role="status">
      <div className="rover-head">
        <span className="rover-title">ROVER AT SITE</span>
        <span className="rover-state" style={{ color: colour }}>{now.state}</span>
      </div>
      <div className="rover-grid">
        <span style={{ color: SUN }}>SUN</span>
        <span>{share === "hidden" ? share : share + " of disc"}</span>
        <span style={{ color: SUN }}>POWER</span>
        <span>{Math.round(now.power)} W</span>
        <span style={{ color: colour }}>BATTERY</span>
        <span className="rover-battery">
          <i><b style={{ width: (now.battery / capacity) * 100 + "%", background: colour }} /></i>
          {Math.round(now.battery)} Wh
        </span>
        <span style={{ color: EARTH }}>EARTH</span>
        <span>{now.link === "clear" ? "link clear" : now.link === "marginal" ? "link marginal" : "blocked"}</span>
      </div>
      <div className="rover-hint">{now.hint}</div>
    </div>
  );
}
