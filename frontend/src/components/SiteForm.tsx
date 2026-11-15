import { useEffect, useState } from "react";
import type { Preset, SiteInput } from "../types";
import { CUSTOM } from "../sites";
import { CUSTOM_ROVER, DEFAULT_ROVER, ROVER_PRESETS, ROVER_RULES, type RoverSpec } from "../rovers";

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

type NumberKey = "lat" | "lon" | "days" | "stepHours" | "solarW" | "batteryWh" | "loadW";

// The allowed range of each number, as the backend checks it, and what to say when it's outside.
const RULES: Record<"lat" | "lon" | "days" | "stepHours", { ok: (n: number) => boolean; message: string }> = {
  lat: { ok: (n) => n >= -90 && n <= 90, message: "Latitude must be between -90 and 90." },
  lon: { ok: (n) => n >= -360 && n <= 360, message: "Longitude must be between -360 and 360." },
  days: { ok: (n) => n > 0 && n <= 400, message: "Window must be more than 0 and at most 400 days." },
  stepHours: { ok: (n) => n >= 0.25 && n <= 24, message: "Step must be 0.25 to 24 hours." },
};

// A number box that keeps what the user is typing as text, so an unfinished entry such as "-"
// or "" stays on screen (BUG-005), and only passes on values inside the allowed range, so the
// app never sees 0, NaN or Infinity (BUG-002). Text, not type="number": a number input reports
// "-" as "" and the box snapped back to 0.
function NumberField({ label, value, rule, onValue, onValid }: {
  label: string;
  value: number;
  rule: { ok: (n: number) => boolean; message: string };
  onValue: (n: number) => void;
  onValid: (valid: boolean) => void;
}) {
  const [text, setText] = useState(String(value));

  // A preset or another change from outside replaces what is in the box.
  useEffect(() => {
    setText((t) => (Number(t) === value && t.trim() !== "" ? t : String(value)));
    onValid(true);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = text.trim() === "" ? NaN : Number(text);
  const valid = Number.isFinite(n) && rule.ok(n);

  return (
    <label>
      {label}
      <input
        inputMode="decimal"
        value={text}
        aria-invalid={!valid}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const v = t.trim() === "" ? NaN : Number(t);
          const ok = Number.isFinite(v) && rule.ok(v);
          onValid(ok);
          if (ok) onValue(v);
        }}
      />
      {!valid && <span className="error field-error">{rule.message}</span>}
    </label>
  );
}

export default function SiteForm({
  site, presets, presetsError, onChange, onAnalyze, analyzing, onAddToCompare, canAdd,
}: Props) {
  const [invalid, setInvalid] = useState<Set<NumberKey>>(new Set());
  const markValid = (key: NumberKey) => (ok: boolean) =>
    setInvalid((s) => {
      if (ok === !s.has(key)) return s;
      const next = new Set(s);
      if (ok) next.delete(key); else next.add(key);
      return next;
    });

  const set = <K extends keyof SiteInput>(key: K, value: SiteInput[K]) =>
    onChange({ ...site, [key]: value });

  const pickPreset = (name: string) => {
    if (name === CUSTOM) return onChange({ ...site, name: CUSTOM }); // keep the current lat/lon
    const p = presets.find((x) => x.name === name);
    if (p) onChange({ ...site, name: p.name, lat: p.lat, lon: p.lon });
  };

  // The rover: a preset fills all three numbers; changing any number makes it Custom.
  const rover: RoverSpec = site.rover ?? DEFAULT_ROVER;
  const pickRover = (name: string) => {
    const p = ROVER_PRESETS.find((x) => x.name === name);
    onChange({ ...site, rover: p ? { name: p.name, solarW: p.solarW, batteryWh: p.batteryWh, loadW: p.loadW } : { ...rover, name: CUSTOM_ROVER } });
  };
  const setRover = (key: "solarW" | "batteryWh" | "loadW", value: number) =>
    onChange({ ...site, rover: { ...rover, name: CUSTOM_ROVER, [key]: value } });
  const roverPreset = ROVER_PRESETS.find((p) => p.name === rover.name);

  // A site name not in the list (e.g. a pinned preset after a reload) shows as Custom.
  const selected = presets.some((p) => p.name === site.name) ? site.name : CUSTOM;
  const blocked = invalid.size > 0;

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
        <NumberField label="Lat (°)" value={site.lat} rule={RULES.lat} onValid={markValid("lat")}
          onValue={(lat) => onChange({ ...site, name: CUSTOM, lat })} />
        <NumberField label="Lon (°E)" value={site.lon} rule={RULES.lon} onValid={markValid("lon")}
          onValue={(lon) => onChange({ ...site, name: CUSTOM, lon })} />
        <label>
          Start date
          <input type="date" value={site.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </label>
        <NumberField label="Window (days)" value={site.days} rule={RULES.days} onValid={markValid("days")}
          onValue={(days) => set("days", days)} />
        <NumberField label="Step (hours)" value={site.stepHours} rule={RULES.stepHours} onValid={markValid("stepHours")}
          onValue={(stepHours) => set("stepHours", stepHours)} />
        <label>
          Rover
          <select value={roverPreset ? rover.name : CUSTOM_ROVER} onChange={(e) => pickRover(e.target.value)}>
            {ROVER_PRESETS.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
            <option>{CUSTOM_ROVER}</option>
          </select>
        </label>
        {roverPreset && <p className="muted rover-source">{roverPreset.source}</p>}
        <NumberField label="Solar power (W)" value={rover.solarW} rule={ROVER_RULES.solarW} onValid={markValid("solarW")}
          onValue={(v) => setRover("solarW", v)} />
        <NumberField label="Battery (Wh)" value={rover.batteryWh} rule={ROVER_RULES.batteryWh} onValid={markValid("batteryWh")}
          onValue={(v) => setRover("batteryWh", v)} />
        <NumberField label="Power use (W)" value={rover.loadW} rule={ROVER_RULES.loadW} onValid={markValid("loadW")}
          onValue={(v) => setRover("loadW", v)} />
      </div>
      <div className="actions">
        <button onClick={onAnalyze} disabled={analyzing || blocked} title={blocked ? "Fix the highlighted field first." : undefined}>
          {analyzing ? "Analyzing…" : "Analyze"}
        </button>
        <button className="secondary" onClick={onAddToCompare} disabled={!canAdd}>
          Add to compare
        </button>
      </div>
    </section>
  );
}
