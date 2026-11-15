import { terrainTileFor } from "../terrain";
import type { Metrics } from "../types";
import { hours, pad2, pct, type Row, type SortKey } from "./data";
import SiteMenu, { type SiteActions } from "./SiteMenu";

const SORTS: { k: SortKey; label: string }[] = [
  { k: "score", label: "SCORE" },
  { k: "sun", label: "SUN" },
  { k: "com", label: "COMMS" },
  { k: "both", label: "BOTH" },
];

interface Props {
  rows: Row[]; // already ranked
  selectedId: string;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  onSelect: (id: string) => void;
  adding: boolean; // is the add-site form open?
  onToggleAdd: () => void;
  addForm: React.ReactNode;
  actions: (id: string) => SiteActions; // the ⋮ menu for each row
}

// Best value per column among sites with data (scope.md Core 6: best value highlighted).
function bests(rows: Row[]) {
  const pick = (f: (r: Row) => number | null | undefined, lower = false) => {
    const vals = rows.map(f).filter((v): v is number => typeof v === "number");
    if (vals.length < 2) return null;
    return lower ? Math.min(...vals) : Math.max(...vals);
  };
  const m = (k: keyof Metrics) => (r: Row) => r.analysis?.metrics[k] as number | null | undefined;
  return {
    score: pick((r) => r.score),
    sun: pick(m("pctSunlit")),
    com: pick(m("pctEarthVisible")),
    both: pick(m("pctPowerAndComms")),
    dark: pick(m("longestNightH"), true),
  };
}

// The ranked departure board (doc/style.md > Board). Every metric is the backend's.
export default function Board({ rows, selectedId, sortKey, onSort, onSelect, adding, onToggleAdd, addForm, actions }: Props) {
  const best = bests(rows);
  const isBest = (v: number | null | undefined, b: number | null, digits = 1) =>
    v !== null && v !== undefined && b !== null && v.toFixed(digits) === b.toFixed(digits) ? " best" : "";

  return (
    <section className="panel" aria-label="Ranked landing sites">
      <span className="cap mono">Sites · ranked</span>
      <div className="sorts" role="group" aria-label="Sort board">
        <span className="mono">Sort</span>
        {SORTS.map((s) => (
          <button key={s.k} className="chip" aria-pressed={sortKey === s.k} onClick={() => onSort(s.k)}>
            {s.label}
          </button>
        ))}
        <button className="chip add-chip" aria-expanded={adding} onClick={onToggleAdd}>
          {adding ? "× CLOSE" : "+ ADD SITE"}
        </button>
      </div>
      {adding && addForm}
      <div className="board" role="listbox" aria-label="Sites">
        <div className="cols" aria-hidden="true">
          <span>#</span><span>SITE</span><span className="r">SCR</span><span className="r">SUN</span>
          <span className="r">COM</span><span className="r">BOTH</span><span className="r">DARK</span><span>LIT</span><span>COMMS</span><span />
        </div>
        {rows.map((row, n) => {
          const { site, result, analysis: a, state } = row;
          const m = a?.metrics;
          const ghost = !a || state === "dark";
          // Right now, at the scrub time: is the Sun up (power) and is the Earth in view (comms)?
          const lit = state === "both" || state === "sunonly";
          const aos = state === "both" || state === "comms";
          const yn = (on: boolean, cls: string, label: string) =>
            !a || state === null
              ? <span className="yn no" data-l={label}>{result?.status === "error" ? "ERR" : "…"}</span>
              : <span className={"yn " + (on ? cls : "no")} data-l={label}>{on ? "YES" : "NO"}</span>;
          const status = <span className="now">{yn(lit, "lit", "LIT")}{yn(aos, "aos", "COMMS")}</span>;
          const pick = () => onSelect(site.id);
          return (
            <div
              key={site.id}
              className={"row" + (ghost ? " ghost" : "")}
              role="option"
              tabIndex={0}
              aria-selected={site.id === selectedId}
              title={result?.status === "error" ? result.error : undefined}
              onClick={pick}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
            >
              <span className="rk">{a ? pad2(n + 1) : "--"}</span>
              <span className="nm">
                {site.name}
                {!terrainTileFor(site.lat, site.lon) && <span className="tag2d" title="No 3D terrain here: the detail view shows the 2D map only">2D ONLY</span>}
              </span>
              <span className="stats">
                <span className={"r v" + isBest(row.score, best.score, 0)} data-l="SCR">{row.score ?? "—"}</span>
                <span className={"r v sun" + isBest(m?.pctSunlit, best.sun)} data-l="SUN">{pct(m?.pctSunlit)}</span>
                <span className={"r v com" + isBest(m?.pctEarthVisible, best.com)} data-l="COM">{pct(m?.pctEarthVisible)}</span>
                <span className={"r v" + isBest(m?.pctPowerAndComms, best.both)} data-l="BOTH">{pct(m?.pctPowerAndComms)}</span>
                <span className={"r v" + isBest(m?.longestNightH, best.dark, 0)} data-l="DARK">{hours(m?.longestNightH)}</span>
              </span>
              {status}
              <SiteMenu name={site.name} {...actions(site.id)} />
            </div>
          );
        })}
      </div>
      <p className="mono board-note">
        SCR = 0.4 × sun % + 0.3 × comms % + 0.3 × both % · DARK = longest night · underlined = best in column
      </p>
    </section>
  );
}
