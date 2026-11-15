import { DELTA_GAIN, DELTA_LOSS, deltaAlpha } from "../terrain2d";

export type ForecastMode = "delta" | "dip";

interface Props {
  body: "power" | "comms";
  mode: ForecastMode;
  hours: number; // the span really covered
  cut: boolean; // the span was cut short by the end of the window
}

const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(2)})`;
// The same strength curve as the map, sampled at |Δ| = 1, 0.5, 0.1.
const arm = (c: number[], order: number[]) => order.map((d) => rgba(c, deltaAlpha(d))).join(", ");
const LOSS = arm(DELTA_LOSS, [1, 0.5, 0.1]);
const GAIN = arm(DELTA_GAIN, [0.1, 0.5, 1]);

const span = (h: number) => (h >= 48 ? `${+(h / 24).toFixed(1)} d` : `${+h.toFixed(1)} h`);

// Key for the forecast overlay on the 2D map (ticket 7.8).
export default function ForecastLegend({ body, mode, hours, cut }: Props) {
  const dip = mode === "dip"; // worst dip is never a gain, so only the losing half is shown
  const gradient = dip
    ? `linear-gradient(to right, ${LOSS}, transparent)`
    : `linear-gradient(to right, ${LOSS}, transparent 46%, transparent 54%, ${GAIN})`;
  return (
    <div className="terrain-legend" role="note">
      <div className="terrain-legend-title">
        {body === "power" ? "Power" : "Comms"} · {dip ? "worst dip" : "change"} · next {span(hours)}
        {cut && " (end of window)"}
      </div>
      <div className="terrain-legend-bar" style={{ backgroundImage: gradient }} />
      <div className="terrain-legend-ends">
        <span>−1 losing</span>
        <span>{dip ? "0 holds" : "0"}</span>
        {!dip && <span>gaining +1</span>}
      </div>
    </div>
  );
}
