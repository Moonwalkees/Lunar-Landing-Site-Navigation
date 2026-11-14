import type { Metrics, PinnedSite } from "../types";
import { METRIC_ROWS, formatMetric } from "./MetricCards";

export const MAX_COMPARE = 4;

// Which way is better for each metric. For countdowns, a later sunset / Earthset is better.
const BETTER: Record<keyof Metrics, "higher" | "lower" | null> = {
  powerW: "higher",
  whPerDay: "higher",
  pctSunlit: "higher",
  longestNightH: "lower",
  batteryMinWh: "higher",
  survives: "higher", // Yes beats No
  earthClearanceDeg: "higher",
  pctEarthVisible: "higher",
  longestBlackoutH: "lower",
  nextSunset: "higher", // later is better
  nextEarthset: "higher",
  pctPowerAndComms: "higher",
};

// Score a value as shown (one decimal), so cells that read the same tie.
function score(v: Metrics[keyof Metrics]): number | null {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 10) / 10;
  if (typeof v === "string") {
    const t = Date.parse(v); // ISO UTC countdown time
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

// Indexes of the best cells in one metric row. Needs at least two sites with a value.
export function bestIndexes(values: Metrics[keyof Metrics][], key: keyof Metrics): Set<number> {
  const dir = BETTER[key];
  const scored = values.map(score);
  const present = scored.filter((s): s is number => s !== null);
  if (!dir || present.length < 2) return new Set();
  const best = dir === "higher" ? Math.max(...present) : Math.min(...present);
  return new Set(scored.flatMap((s, i) => (s === best ? [i] : [])));
}

interface Props {
  pinned: PinnedSite[];
  onRemove: (i: number) => void;
}

// Side-by-side comparison of up to 4 sites, with the best value in each metric row highlighted.
export default function Compare({ pinned, onRemove }: Props) {
  const slots = Array.from({ length: MAX_COMPARE }, (_, i) => pinned[i]);

  return (
    <section className="panel">
      <h2>Compare ({pinned.length}/{MAX_COMPARE})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              {slots.map((p, i) => (
                <th key={i}>
                  {p ? (
                    <>
                      {p.site.name}
                      <button className="link" onClick={() => onRemove(i)} aria-label="Remove">×</button>
                    </>
                  ) : (
                    <span className="muted">Empty slot</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map(([label, key]) => {
              const best = bestIndexes(slots.map((p) => (p ? p.metrics[key] : null)), key);
              return (
                <tr key={key}>
                  <td>{label}</td>
                  {slots.map((p, i) => (
                    <td key={i} className={best.has(i) ? "best" : undefined}>
                      {p ? formatMetric(p.metrics[key]) : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
