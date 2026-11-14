import type { Metrics } from "../types";

// label, key, unit, group
export const METRIC_ROWS: [string, keyof Metrics, string, string][] = [
  ["Power", "powerW", "W", "Power"],
  ["Energy", "whPerDay", "Wh/day", "Power"],
  ["Sunlit", "pctSunlit", "%", "Power"],
  ["Longest night", "longestNightH", "h", "Power"],
  ["Battery min", "batteryMinWh", "Wh", "Power"],
  ["Survives", "survives", "", "Power"],
  ["Earth clearance", "earthClearanceDeg", "°", "Comms"],
  ["Earth visible", "pctEarthVisible", "%", "Comms"],
  ["Longest blackout", "longestBlackoutH", "h", "Comms"],
  ["Next sunset", "nextSunset", "", "Countdown"],
  ["Next Earthset", "nextEarthset", "", "Countdown"],
  ["Power + comms", "pctPowerAndComms", "%", "Both"],
];

export function formatMetric(v: Metrics[keyof Metrics]): string {
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toFixed(1);
  return v;
}

export default function MetricCards({ metrics }: { metrics: Metrics }) {
  return (
    <section className="panel">
      <h2>Metrics</h2>
      <div className="cards">
        {METRIC_ROWS.map(([label, key, unit, group]) => (
          <div className="card" key={key}>
            <span className="card-group">{group}</span>
            <span className="card-value">
              {formatMetric(metrics[key])}
              {metrics[key] !== null && unit && <small> {unit}</small>}
            </span>
            <span className="card-label">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
