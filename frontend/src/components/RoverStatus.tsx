import { useMemo } from "react";
import type { Analysis } from "../types";

interface Props {
  analysis: Analysis;
  index: number;
}

const SUN = "#c08a1c";
const EARTH = "#4a8fe6";
const GOOD = "#3fa66a";
const WARN = "#d29922";
const BAD = "#f85149";

const span = (hours: number) => (hours < 48 ? Math.round(hours) + " h" : (hours / 24).toFixed(1) + " days");

// SAMPLE, not agreed scope. A status strip over the terrain view: what a rover parked at the
// site would be getting at the scrubber time. It only reads the analysis (the same power and
// battery model as the time series); it computes no sunlight of its own.
export default function RoverStatus({ analysis, index }: Props) {
  const capacity = useMemo(() => Math.max(1, ...analysis.batteryWh), [analysis]);

  const sun = analysis.sun.fraction[index];
  const power = analysis.powerW[index];
  const battery = analysis.batteryWh[index];
  const before = analysis.batteryWh[Math.max(0, index - 1)];
  const link = analysis.comms[index];

  // The next step at which a condition holds, as a time from now.
  const until = (test: (i: number) => boolean) => {
    for (let i = index + 1; i < analysis.times.length; i++) if (test(i)) return span((i - index) * analysis.stepHours);
    return null;
  };

  let state: string, colour: string, hint: string | null;
  if (battery <= 0.5) {
    const back = until((i) => analysis.sun.fraction[i] > 0);
    state = "BATTERY EMPTY";
    colour = BAD;
    hint = back ? "Sun returns in " + back : "no Sun before the window ends";
  } else if (power > 0 && battery >= before) {
    const dark = until((i) => analysis.sun.fraction[i] <= 0);
    state = battery >= capacity - 0.5 ? "IN SUN, FULL" : "CHARGING";
    colour = GOOD;
    hint = dark ? "shadow in " + dark : "in Sun to the end of the window";
  } else {
    const empty = until((i) => analysis.batteryWh[i] <= 0.5);
    state = "ON BATTERY";
    colour = WARN;
    hint = empty ? "empty in " + empty : "lasts to the end of the window";
  }

  return (
    <div className="rover-status" role="status">
      <div className="rover-head">
        <span className="rover-title">ROVER AT SITE</span>
        <span className="rover-state" style={{ color: colour }}>{state}</span>
      </div>
      <div className="rover-grid">
        <span style={{ color: SUN }}>SUN</span>
        <span>{sun <= 0 ? "hidden" : sun < 0.005 ? "under 1% of disc" : Math.round(sun * 100) + "% of disc"}</span>
        <span style={{ color: SUN }}>POWER</span>
        <span>{Math.round(power)} W</span>
        <span style={{ color: colour }}>BATTERY</span>
        <span className="rover-battery">
          <i><b style={{ width: (battery / capacity) * 100 + "%", background: colour }} /></i>
          {Math.round(battery)} Wh
        </span>
        <span style={{ color: EARTH }}>EARTH</span>
        <span>{link === "clear" ? "link clear" : link === "marginal" ? "link marginal" : "blocked"}</span>
      </div>
      {hint && <div className="rover-hint">{hint}</div>}
    </div>
  );
}
