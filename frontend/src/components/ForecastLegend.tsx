import { deltaColour } from "../terrain2d";

export type ForecastMode = "delta" | "dip";

interface Props {
  body: "power" | "comms";
  mode: ForecastMode;
  hours: number; // the span really covered
  cut: boolean; // the span was cut short by the end of the window
  here?: string | null; // the cell under the pointer
  earlyBandDeg?: number; // set when early warning is on
}

const css = (c: number[]) => `rgb(${c.map(Math.round).join(",")})`;
// Vivid for a change that comes soon, pale for one late in the span: the map's own ramp.
const ramp = (loss: boolean) => `linear-gradient(to right, ${[0, 0.5, 1].map((t) => css(deltaColour(loss, t))).join(", ")})`;

const span = (h: number) => (h >= 48 ? `${+(h / 24).toFixed(1)} d` : `${+h.toFixed(1)} h`);

// Key for the forecast overlay on the 2D map (ticket 7.8).
export default function ForecastLegend({ body, mode, hours, cut, here, earlyBandDeg }: Props) {
  const dip = mode === "dip"; // worst dip is never a gain, so only the losing row is shown
  return (
    <div className="terrain-legend" role="note">
      <div className="terrain-legend-title">
        {body === "power" ? "Power" : "Comms"} · {earlyBandDeg ? "early warning · " : ""}{dip ? "worst dip" : "change"} · next {span(hours)}
        {cut && " (end of window)"}
      </div>
      <div className="terrain-legend-row">
        <span>Losing</span>
        <div className="terrain-legend-bar" style={{ backgroundImage: ramp(true) }} />
      </div>
      {!dip && (
        <div className="terrain-legend-row">
          <span>Gaining</span>
          <div className="terrain-legend-bar" style={{ backgroundImage: ramp(false) }} />
        </div>
      )}
      <div className="terrain-legend-row terrain-legend-ends">
        <span />
        <div><span>soon</span><span>+{span(hours)}</span></div>
      </div>
      {earlyBandDeg && (
        <div className="terrain-legend-note">
          Counts ground within {earlyBandDeg}° of the {body === "power" ? "Sun" : "Earth"} crossing the horizon
        </div>
      )}
      {here && <div className="terrain-legend-here">{here}</div>}
    </div>
  );
}
