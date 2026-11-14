import type { Preset, SiteInput } from "../types";
import { CUSTOM } from "../sites";

interface Props {
  site: SiteInput;
  presets: Preset[];
  presetsError: string | null;
  onChange: (site: SiteInput) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  onAddToCompare: () => void;
  canAdd: boolean;
}

export default function SiteForm({
  site, presets, presetsError, onChange, onAnalyze, analyzing, onAddToCompare, canAdd,
}: Props) {
  const set = <K extends keyof SiteInput>(key: K, value: SiteInput[K]) =>
    onChange({ ...site, [key]: value });

  const pickPreset = (name: string) => {
    if (name === CUSTOM) return onChange({ ...site, name: CUSTOM }); // keep the current lat/lon
    const p = presets.find((x) => x.name === name);
    if (p) onChange({ ...site, name: p.name, lat: p.lat, lon: p.lon });
  };

  // A site name not in the list (e.g. a pinned preset after a reload) shows as Custom.
  const selected = presets.some((p) => p.name === site.name) ? site.name : CUSTOM;

  return (
    <section className="panel">
      <h2>Site & dates</h2>
      <div className="form">
        <label>
          Site
          <select value={selected} onChange={(e) => pickPreset(e.target.value)}>
            {presets.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
            <option>{CUSTOM}</option>
          </select>
        </label>
        {presetsError && <p className="muted">Presets unavailable: {presetsError} Type a lat/lon instead.</p>}
        <label>
          Lat (°)
          <input type="number" step="0.01" value={site.lat}
            onChange={(e) => onChange({ ...site, name: "Custom", lat: Number(e.target.value) })} />
        </label>
        <label>
          Lon (°E)
          <input type="number" step="0.01" value={site.lon}
            onChange={(e) => onChange({ ...site, name: "Custom", lon: Number(e.target.value) })} />
        </label>
        <label>
          Start date
          <input type="date" value={site.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </label>
        <label>
          Window (days)
          <input type="number" min={1} value={site.days} onChange={(e) => set("days", Number(e.target.value))} />
        </label>
        <label>
          Step (hours)
          <input type="number" min={0.25} step={0.25} value={site.stepHours}
            onChange={(e) => set("stepHours", Number(e.target.value))} />
        </label>
      </div>
      <div className="actions">
        <button onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? "Analyzing…" : "Analyze"}
        </button>
        <button className="secondary" onClick={onAddToCompare} disabled={!canAdd}>
          Add to compare
        </button>
      </div>
    </section>
  );
}
