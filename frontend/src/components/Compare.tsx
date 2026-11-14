import type { PinnedSite } from "../types";
import { METRIC_ROWS, formatMetric } from "./MetricCards";

export const MAX_COMPARE = 4;

interface Props {
  pinned: PinnedSite[];
  onRemove: (i: number) => void;
}

// Side-by-side comparison of up to 4 sites. Best-value highlighting comes once real numbers exist.
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
            {METRIC_ROWS.map(([label, key]) => (
              <tr key={key}>
                <td>{label}</td>
                {slots.map((p, i) => (
                  <td key={i}>{p ? formatMetric(p.metrics[key]) : ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
