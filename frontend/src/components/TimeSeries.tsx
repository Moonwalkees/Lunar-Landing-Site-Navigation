import { useEffect, useMemo, useRef, useState } from "react";
import type { Analysis } from "../types";
import { eclipses, nextEclipse } from "../eclipses";

interface Props {
  analysis: Analysis | null;
  timeIndex: number;
  maxIndex: number;
  onScrub: (i: number) => void;
}

// Series colours, checked for colour-blind separation on the panel background.
const SUN = "#c08a1c";
const EARTH = "#4a8fe6";
const BATTERY = "#3fa66a";

const ECLIPSE = "#f85149"; // lunar eclipse marks on the Sun row
const LABEL_W = 72; // room for the row names and scales on the left
const ROWS = [
  { key: "sun", label: "Sun", height: 18 },
  { key: "earth", label: "Earth", height: 18 },
  { key: "power", label: "Power", height: 44 },
  { key: "battery", label: "Battery", height: 44 },
] as const;
const GAP = 6;
const CHART_H = ROWS.reduce((h, r) => h + r.height + GAP, 0) + 14; // plus the date labels
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// How far the playhead moves per second of playback, in hours of mission time.
const SPEEDS = [
  { label: "6 hours a second", hours: 6 },
  { label: "1 day a second", hours: 24 },
  { label: "4 days a second", hours: 96 },
];

const share = (f: number) => (f <= 0 ? "hidden" : f >= 0.995 ? "fully visible" : Math.round(f * 100) + "% visible");
const span = (hours: number) => (hours < 48 ? Math.round(hours) + " h" : (hours / 24).toFixed(1) + " days");
const stamp = (iso: string) => iso.replace("T", " ").replace(":00Z", " UTC");

// "sets in 3.2 days" / "rises in 14 h", from when the condition next changes.
function nextChange(up: boolean[], i: number, stepHours: number): string {
  let j = i + 1;
  while (j < up.length && up[j] === up[i]) j++;
  if (j >= up.length) return up[i] ? "up to the end of the window" : "down to the end of the window";
  return (up[i] ? "sets in " : "rises in ") + span((j - i) * stepHours);
}

// Power, battery and comms over the window, with a playhead shared with the other panels.
// Until an analysis has run there is nothing to plot, only the scrubber.
export default function TimeSeries({ analysis, timeIndex, maxIndex, onScrub }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(24);
  const [hover, setHover] = useState<{ x: number; i: number } | null>(null);

  // Keep the latest values where the animation frame can read them.
  const live = useRef({ timeIndex, maxIndex, onScrub, loop, speed, stepHours: analysis?.stepHours ?? 1 });
  live.current = { timeIndex, maxIndex, onScrub, loop, speed, stepHours: analysis?.stepHours ?? 1 };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [analysis !== null]);

  // Play: advance the shared time index, wrapping to the start when Loop is on.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let position = live.current.timeIndex;
    const tick = (now: number) => {
      const s = live.current;
      // The first frame's timestamp can be a little earlier than the moment Play was pressed.
      position += (s.speed / s.stepHours) * Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      if (position >= s.maxIndex) {
        if (!s.loop) {
          s.onScrub(s.maxIndex);
          setPlaying(false);
          return;
        }
        position = 0;
      }
      const next = Math.floor(position);
      if (next !== s.timeIndex) s.onScrub(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  // Draw the four rows. The playhead is a separate element, so scrubbing doesn't redraw this.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !analysis || width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    el.width = Math.round(width * ratio);
    el.height = Math.round(CHART_H * ratio);
    const g = el.getContext("2d")!;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, width, CHART_H);
    g.font = "12px system-ui, sans-serif";
    g.textBaseline = "middle";

    const plot = width - LABEL_W;
    const n = analysis.times.length;
    const columns = Math.max(1, Math.round(plot * ratio));
    const comms = analysis.comms.map((c) => (c === "clear" ? 1 : c === "marginal" ? 0.5 : 0));
    const series = {
      sun: { values: analysis.sun.fraction, max: 1, colour: SUN, strip: true },
      earth: { values: comms, max: 1, colour: EARTH, strip: true },
      power: { values: analysis.powerW, max: Math.max(1, ...analysis.powerW), colour: SUN, strip: false },
      battery: { values: analysis.batteryWh, max: Math.max(1, ...analysis.batteryWh), colour: BATTERY, strip: false },
    };

    let y = 0;
    for (const row of ROWS) {
      const s = series[row.key];
      g.fillStyle = "#e6edf3";
      g.fillText(row.label, 0, s.strip ? y + row.height / 2 : y + row.height / 2 - 8);
      if (!s.strip) {
        // The scale goes under the row name, where it stays readable.
        g.fillStyle = "#8b949e";
        g.fillText("0–" + Math.round(s.max) + (row.key === "power" ? " W" : " Wh"), 0, y + row.height / 2 + 8);
      }
      g.fillStyle = "#0d1117";
      g.fillRect(LABEL_W, y, plot, row.height);
      g.fillStyle = s.colour;
      for (let c = 0; c < columns; c++) {
        const a = Math.floor((c / columns) * n);
        const b = Math.max(a + 1, Math.floor(((c + 1) / columns) * n));
        let sum = 0;
        for (let k = a; k < b; k++) sum += s.values[k] ?? 0;
        const level = sum / (b - a) / s.max;
        if (s.strip) {
          // A strip: colour strength is the share of the time the body is in view.
          g.globalAlpha = level;
          g.fillRect(LABEL_W + c / ratio, y, 1 / ratio + 0.05, row.height);
        } else {
          // A filled chart: height is the value, from zero at the bottom of the row.
          g.globalAlpha = 0.9;
          const h = level * row.height;
          g.fillRect(LABEL_W + c / ratio, y + row.height - h, 1 / ratio + 0.05, h);
        }
      }
      g.globalAlpha = 1;
      // Eclipses: a red mark across the Sun row wherever the Earth covers part of the Sun.
      if (row.key === "sun") {
        g.fillStyle = ECLIPSE;
        for (let c = 0; c < columns; c++) {
          const a = Math.floor((c / columns) * n), b = Math.max(a + 1, Math.floor(((c + 1) / columns) * n));
          let hit = false;
          for (let k = a; k < b && !hit; k++) hit = analysis.sun.behindEarth[k] > 0;
          if (hit) g.fillRect(LABEL_W + c / ratio - 1, y, 1 / ratio + 2, row.height);
        }
      }
      y += row.height + GAP;
    }

    // Date marks: the first of each month, or every few days in a short window.
    g.fillStyle = "#8b949e";
    const start = Date.parse(analysis.times[0]);
    const total = (n - 1) * analysis.stepHours * 3600000;
    const days = total / 86400000;
    const every = days > 90 ? 0 : days > 40 ? 7 : days > 12 ? 3 : 1;
    const first = new Date(start);
    let mark = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()));
    let lastLabel = -100;
    while (mark.getTime() <= start + total) {
      const x = LABEL_W + ((mark.getTime() - start) / total) * plot;
      const wanted = every === 0 ? mark.getUTCDate() === 1 : Math.round((mark.getTime() - start) / 86400000) % every === 0;
      if (wanted && x >= LABEL_W - 1 && x - lastLabel > 44 && x < width - 30) {
        g.fillRect(x, y - GAP + 1, 1, 4);
        g.fillText(mark.getUTCDate() + " " + MONTHS[mark.getUTCMonth()], x + 3, y + 5);
        lastLabel = x;
      }
      mark = new Date(mark.getTime() + 86400000);
    }
  }, [analysis, width]);

  const indexAt = (clientX: number) => {
    const box = canvas.current!.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - box.left - LABEL_W) / (box.width - LABEL_W), 0), 1);
    return Math.round(t * maxIndex);
  };

  const i = timeIndex;
  const playheadX = width > 0 && maxIndex > 0 ? LABEL_W + (i / maxIndex) * (width - LABEL_W) : LABEL_W;

  return (
    <section className="panel">
      <h2>Time series</h2>

      {analysis ? (
        <>
          <div className="timeline-controls">
            <button onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
            <button className="secondary" onClick={() => onScrub(Math.max(0, i - 1))} aria-label="Back one step">◀</button>
            <button className="secondary" onClick={() => onScrub(Math.min(maxIndex, i + 1))} aria-label="Forward one step">▶</button>
            <label className="inline">
              Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                {SPEEDS.map((s) => (
                  <option key={s.hours} value={s.hours}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="inline">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
            </label>
            <NextEclipseButton analysis={analysis} index={i} onScrub={(k) => { setPlaying(false); onScrub(k); }} />
            <span className="timeline-now">{stamp(analysis.times[i])}</span>
          </div>

          <div className="timeline-chart">
            <canvas
              ref={canvas}
              style={{ height: CHART_H }}
              role="img"
              aria-label="Sun and Earth visibility, power and battery over the window"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setPlaying(false);
                onScrub(indexAt(e.clientX));
              }}
              onPointerMove={(e) => {
                const at = indexAt(e.clientX);
                if (e.buttons === 1) onScrub(at);
                setHover({ x: e.clientX - e.currentTarget.getBoundingClientRect().left, i: at });
              }}
              onPointerLeave={() => setHover(null)}
            />
            <div className="timeline-playhead" style={{ left: playheadX, height: CHART_H - 14 }} />
            {hover && (
              <div className="timeline-tip" style={{ left: hover.x }}>
                {stamp(analysis.times[hover.i])} · Sun {share(analysis.sun.fraction[hover.i])} · Earth{" "}
                {analysis.comms[hover.i]} · {Math.round(analysis.powerW[hover.i])} W
              </div>
            )}
          </div>

          <div className="timeline-readout">
            <div>
              <i style={{ background: SUN }} />
              <b>Sun</b> {share(analysis.sun.fraction[i])}
              {analysis.sun.behindEarth[i] > 0 && " · eclipse: " + Math.round(analysis.sun.behindEarth[i] * 100) + "% behind the Earth"}
              {" · elevation " + analysis.sun.el[i].toFixed(2) + "° · "}
              {nextChange(analysis.sun.fraction.map((f) => f > 0), i, analysis.stepHours)}
              {" · " + Math.round(analysis.powerW[i]) + " W"}
            </div>
            <div>
              <i style={{ background: EARTH }} />
              <b>Earth</b> {analysis.comms[i]} · {Math.abs(analysis.earth.margin[i]).toFixed(2)}°{" "}
              {analysis.earth.margin[i] >= 0 ? "above" : "below"} the skyline ·{" "}
              {nextChange(analysis.earth.margin.map((m) => m >= 0), i, analysis.stepHours)}
            </div>
            <div>
              <i style={{ background: BATTERY }} />
              <b>Battery</b> {Math.round(analysis.batteryWh[i])} Wh
            </div>
          </div>
        </>
      ) : (
        <div className="placeholder row">
          <span>Run Analyze to see power, battery and comms over the window</span>
        </div>
      )}

      <label className="scrubber">
        Time step {timeIndex} / {maxIndex}
        <input type="range" min={0} max={maxIndex} value={timeIndex}
          onChange={(e) => { setPlaying(false); onScrub(Number(e.target.value)); }} />
      </label>
    </section>
  );
}

// Jumps to the peak of the next eclipse in the window (ticket 7.4); off when there is none.
function NextEclipseButton({ analysis, index, onScrub }: { analysis: Analysis; index: number; onScrub: (i: number) => void }) {
  const next = useMemo(() => eclipses(analysis), [analysis]);
  const target = nextEclipse(next, index);
  return (
    <button className="secondary" disabled={!target} onClick={() => target && onScrub(target.peak)}
      title={target ? "Peak at " + stamp(analysis.times[target.peak]) + ", " + Math.round(target.covered * 100) + "% of the Sun covered" : "No eclipse in this window"}>
      Next eclipse
    </button>
  );
}
