import { useEffect, useRef, useState } from "react";
import type { Metrics } from "../types";
import { stamp, type MissionWindow, type State } from "./data";
import { CUSTOM_ROVER, ROVER_PRESETS, ROVER_RULES } from "../rovers";

// ---------- annunciator lamps (doc/style.md > Annunciator lamps) ----------

export function Lamps({ states }: { states: State[] }) {
  // The total is its own lamp; the others are plain counts of the sites with data.
  // SITES and LIT + AOS are always filled; LIT and EARTH AOS fill only when non-zero.
  const total = states.length;
  const lit = states.filter((s) => s === "both" || s === "sunonly").length;
  const aos = states.filter((s) => s === "both" || s === "comms").length;
  const both = states.filter((s) => s === "both").length;
  const n = (k: number) => (total ? k : "—");
  return (
    <div className="lamps" aria-live="off">
      <div className="lamp lit"><b>{n(total)}</b><span>SITES</span></div>
      <div className={"lamp" + (lit ? " sun" : "")}><b>{n(lit)}</b><span>LIT</span></div>
      <div className={"lamp" + (aos ? " earth" : "")}><b>{n(aos)}</b><span>EARTH AOS</span></div>
      <div className="lamp ok"><b>{n(both)}</b><span>LIT + AOS</span></div>
    </div>
  );
}

// ---------- all metrics for the selected site (scope.md Core 4) ----------

const ROWS: [string, keyof Metrics, string, string?][] = [
  ["Power", "powerW", "W", "sun-c"],
  ["Energy", "whPerDay", "Wh/d", "sun-c"],
  ["Sunlit", "pctSunlit", "%", "sun-c"],
  ["Longest night", "longestNightH", "h"],
  ["Battery min", "batteryMinWh", "Wh"],
  ["Survives", "survives", ""],
  ["Earth clearance", "earthClearanceDeg", "°", "earth-c"],
  ["Earth visible", "pctEarthVisible", "%", "earth-c"],
  ["Longest blackout", "longestBlackoutH", "h", "earth-c"],
  ["Next sunset", "nextSunset", "UTC"],
  ["Next Earthset", "nextEarthset", "UTC"],
  ["Power + comms", "pctPowerAndComms", "%", "ok-c"],
];

export function MetricsPanel({ name, metrics }: { name: string; metrics: Metrics | null }) {
  return (
    <section className="panel">
      <span className="cap mono">Metrics · {name}</span>
      {metrics ? (
        <div className="metrics">
          {ROWS.map(([label, key, unit, cls]) => {
            const v = metrics[key];
            let body: React.ReactNode;
            if (v === null) body = <b className="na">—</b>;
            else if (typeof v === "boolean") body = <b className={v ? "ok-c" : "alert"}>{v ? "YES" : "NO"}</b>;
            else if (typeof v === "string") body = <b>{stamp(v).slice(5)}<small>{unit}</small></b>;
            else body = <b className={cls}>{v.toFixed(1)}<small>{unit}</small></b>;
            return <div key={key}><span className="mono">{label}</span>{body}</div>;
          })}
        </div>
      ) : (
        <div className="empty">AWAITING DATA</div>
      )}
    </section>
  );
}

// ---------- mission window + custom sites (scope.md Core 1, 2) ----------

interface MissionProps {
  win: MissionWindow;
  onWindow: (w: MissionWindow) => void;
  onReset: () => void; // forget the saved setup and reload with the defaults
}

// Text inputs with decimal keyboards, parsed on submit, so a leading minus can be typed (BUG-005).
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function Mission({ win, onWindow, onReset }: MissionProps) {
  const [start, setStart] = useState(win.startDate);
  const [days, setDays] = useState(String(win.days));
  const [step, setStep] = useState(String(win.stepHours));
  const [roverName, setRoverName] = useState(win.rover.name);
  const [solar, setSolar] = useState(String(win.rover.solarW));
  const [battery, setBattery] = useState(String(win.rover.batteryWh));
  const [use, setUse] = useState(String(win.rover.loadW));
  const [winErr, setWinErr] = useState<string | null>(null);
  useEffect(() => {
    setStart(win.startDate); setDays(String(win.days)); setStep(String(win.stepHours));
    setRoverName(win.rover.name); setSolar(String(win.rover.solarW)); setBattery(String(win.rover.batteryWh)); setUse(String(win.rover.loadW));
  }, [win]);

  // A preset fills the three numbers; typing in any of them makes the rover Custom.
  const pickRover = (name: string) => {
    setRoverName(name);
    const p = ROVER_PRESETS.find((x) => x.name === name);
    if (p) { setSolar(String(p.solarW)); setBattery(String(p.batteryWh)); setUse(String(p.loadW)); }
  };
  const roverField = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value); setRoverName(CUSTOM_ROVER); };
  const preset = ROVER_PRESETS.find((p) => p.name === roverName);

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const d = num(days), s = num(step);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return setWinErr("START MUST BE A DATE");
    if (!(d > 0 && d <= 400)) return setWinErr("WINDOW MUST BE 0-400 DAYS");
    if (!(s > 0 && s <= 24)) return setWinErr("STEP MUST BE 0-24 H");
    const sw = num(solar), bw = num(battery), lw = num(use);
    if (!ROVER_RULES.solarW.ok(sw)) return setWinErr("SOLAR MUST BE MORE THAN 0 W");
    if (!ROVER_RULES.batteryWh.ok(bw)) return setWinErr("BATTERY MUST BE MORE THAN 0 WH");
    if (!ROVER_RULES.loadW.ok(lw)) return setWinErr("POWER USE MUST BE 0 W OR MORE");
    setWinErr(null);
    onWindow({ startDate: start, days: d, stepHours: s, rover: { name: roverName, solarW: sw, batteryWh: bw, loadW: lw } });
  };

  return (
    <div className="mission">
      <form className="panel" onSubmit={run}>
        <span className="cap mono">Mission window</span>
        <div className="fields">
          <label className="field"><span className="mono">Start (UTC)</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field"><span className="mono">Window · days</span>
            <input inputMode="decimal" value={days} onChange={(e) => setDays(e.target.value)} /></label>
          <label className="field"><span className="mono">Step · hours</span>
            <input inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} /></label>
        </div>
        <div className="rover-pick" role="group" aria-label="Rover">
          <span className="mono">Rover</span>
          {[...ROVER_PRESETS.map((p) => p.name), CUSTOM_ROVER].map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={roverName === n} onClick={() => pickRover(n)}>{n.toUpperCase()}</button>
          ))}
          {preset && <span className="mono rover-src">{preset.source}</span>}
        </div>
        <div className="fields">
          <label className="field"><span className="mono">Solar · W</span>
            <input inputMode="decimal" value={solar} onChange={roverField(setSolar)} /></label>
          <label className="field"><span className="mono">Battery · Wh</span>
            <input inputMode="decimal" value={battery} onChange={roverField(setBattery)} /></label>
          <label className="field"><span className="mono">Power use · W</span>
            <input inputMode="decimal" value={use} onChange={roverField(setUse)} /></label>
        </div>
        <div className="form-row">
          <button className="chip" type="submit">RUN</button>
          <button className="chip" type="button" onClick={onReset}
            title="Forget the saved sites, window and rover, and start again from the defaults">RESET</button>
        </div>
        {winErr && <div className="form-err mono">{winErr}</div>}
      </form>
    </div>
  );
}

// ---------- add a custom site to the board (scope.md Core 1: click/type any lat/lon) ----------

interface AddSiteProps {
  onAdd: (s: { name: string; lat: number; lon: number }) => void;
}

export function AddSite({ onAdd }: AddSiteProps) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [siteErr, setSiteErr] = useState<string | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const la = num(lat), lo = num(lon);
    if (!(la >= -90 && la <= 90)) return setSiteErr("LAT MUST BE -90 TO 90");
    if (!(lo >= -360 && lo <= 360)) return setSiteErr("LON MUST BE -360 TO 360");
    setSiteErr(null);
    onAdd({ name: name.trim() || `${la.toFixed(2)}°, ${lo.toFixed(2)}°E`, lat: la, lon: lo });
    setName(""); setLat(""); setLon("");
  };

  return (
    <div className="add-site">
      <form className="panel" onSubmit={add}>
        <span className="cap mono">Add custom site</span>
        <div className="fields">
          <label className="field"><span className="mono">Name</span>
            <input value={name} placeholder="OPTIONAL" onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span className="mono">Lat °</span>
            <input inputMode="decimal" value={lat} placeholder="-89.50" onChange={(e) => setLat(e.target.value)} /></label>
          <label className="field"><span className="mono">Lon °E</span>
            <input inputMode="decimal" value={lon} placeholder="180.00" onChange={(e) => setLon(e.target.value)} /></label>
        </div>
        <div className="form-row">
          <button className="chip" type="submit">ADD TO BOARD</button>
          <span className="mono">Lat negative in the south · lon east-positive</span>
        </div>
        {siteErr && <div className="form-err mono">{siteErr}</div>}
      </form>
    </div>
  );
}

// ---------- time dock (doc/style.md > Time dock) ----------

interface DockProps {
  timeIndex: number;
  maxIndex: number;
  cellSteps: number; // steps in one 6-hour cell
  time: string | undefined;
  enabled: boolean;
  onScrub: (i: number) => void;
}

// Playback speeds, in hours of mission time per second. The SPEED button cycles through them.
const SPEEDS = [
  { hours: 6, label: "6H/S" },
  { hours: 24, label: "1D/S" },
  { hours: 96, label: "4D/S" },
  { hours: 240, label: "10D/S" },
];

export function TimeDock({ timeIndex, maxIndex, cellSteps, time, enabled, onScrub }: DockProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3); // index into SPEEDS, default 10 days a second: the default year plays in about 36 s
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Play runs every frame and moves one analysis step at a time, so the Sun, the shadows and the
  // scrubber flow as they do in the classic UI, and wraps at the end. With reduced motion it keeps
  // to one jump a second, in whole 6 h cells.
  const h = SPEEDS[speed].hours;
  const stepsPerSecond = (h * cellSteps) / 6; // cellSteps is the number of steps in 6 h
  const live = useRef({ timeIndex, maxIndex, onScrub, stepsPerSecond });
  live.current = { timeIndex, maxIndex, onScrub, stepsPerSecond };
  useEffect(() => {
    if (!playing || !enabled) return;
    if (reduce) {
      const jump = Math.max(1, Math.round(h / 6)) * cellSteps;
      const t = setInterval(() => {
        const s = live.current;
        s.onScrub(s.timeIndex >= s.maxIndex ? 0 : Math.min(s.maxIndex, s.timeIndex + jump));
      }, 1000);
      return () => clearInterval(t);
    }
    let frame = 0;
    let last = performance.now();
    let position = live.current.timeIndex;
    const tick = (now: number) => {
      const s = live.current;
      if (Math.abs(s.timeIndex - Math.floor(position)) > 1) position = s.timeIndex; // moved by something else
      // The first frame's timestamp can be a little earlier than the moment Play was pressed.
      position += s.stepsPerSecond * Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      if (position > s.maxIndex) position = 0;
      const next = Math.floor(position);
      if (next !== s.timeIndex) s.onScrub(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, enabled, reduce, h, cellSteps]);

  const nudge = (d: number) => { setPlaying(false); onScrub(Math.max(0, Math.min(maxIndex, timeIndex + d * cellSteps))); };

  return (
    <div className="dock">
      <div className="dock-in">
        <div className="btns">
          <button className="btn" disabled={!enabled} onClick={() => nudge(-1)} aria-label="Back 6 hours">−6</button>
          <button className="btn" disabled={!enabled} onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button className="btn" disabled={!enabled} onClick={() => nudge(1)} aria-label="Forward 6 hours">+6</button>
          <button className="btn speed" onClick={() => setSpeed((speed + 1) % SPEEDS.length)}
            aria-label={"Playback speed " + SPEEDS[speed].label + ". Click to change."} title="Playback speed (mission time per second)">
            <span className="mono">Speed</span>{SPEEDS[speed].label}
          </button>
        </div>
        <input type="range" min={0} max={maxIndex} step={1} value={timeIndex} disabled={!enabled} aria-label="Time scrubber"
          onChange={(e) => { setPlaying(false); onScrub(Number(e.target.value)); }} />
        <div className="t-read"><span className="mono">Time (UTC)</span><b>{time ? stamp(time) : "—"}</b></div>
      </div>
    </div>
  );
}
