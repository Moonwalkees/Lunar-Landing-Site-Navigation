import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly, { type Data, type Layout } from "plotly.js";
import type { Analysis } from "../types";

interface Props {
  analysis: Analysis | null; // null until Analyze has run for the current site
  timeIndex: number;
}

// "plotly.js" is aliased to plotly.js-dist-min in package.json; the factory takes that prebuilt bundle
// instead of the default entry, which imports a path the minified package doesn't ship.
const Plot = createPlotlyComponent(Plotly);

// Same series colours as the time series, so Sun and Earth read the same in both panels.
const SUN = "#c08a1c";
const EARTH = "#4a8fe6";
const TERRAIN = "#8b949e";
const TEXT = "#e6edf3";
const GRID = "#30363d";

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
const stamp = (iso: string) => iso.replace("T", " ").replace(":00Z", " UTC");

// Breaks a track where it wraps from 360° back to 0°, so Plotly doesn't draw a line across the chart.
// `keep` hides the points that don't belong to this segment (e.g. below the skyline).
function track(az: number[], el: number[], times: string[], keep: (i: number) => boolean) {
  const x: (number | null)[] = [];
  const y: (number | null)[] = [];
  const text: string[] = [];
  for (let i = 0; i < az.length; i++) {
    if (i > 0 && Math.abs(az[i] - az[i - 1]) > 180) {
      x.push(null);
      y.push(null);
      text.push("");
    }
    x.push(keep(i) ? az[i] : null);
    y.push(keep(i) ? el[i] : null);
    text.push(stamp(times[i]));
  }
  return { x, y, text };
}

// 360° terrain skyline seen from the site, with the Sun and Earth paths over the window.
// The paths are bright where the body is above the skyline and faint where the terrain hides it.
export default function Panorama({ analysis, timeIndex }: Props) {
  // Everything except the two position markers depends only on the analysis, so scrubbing reuses it.
  const base = useMemo(() => {
    if (!analysis) return null;
    const { skyline, sun, earth, times } = analysis;
    const skyMin = Math.min(...skyline.el);
    // Fit the skyline and both tracks, even where the terrain hides them (e.g. a crater floor),
    // but stop 10° below the horizon so the Sun's night side away from the poles doesn't squash the skyline.
    const all = [...skyline.el, ...sun.el, ...earth.el];
    const lo = Math.max(Math.min(...all), Math.min(skyMin, 0) - 10);
    const hi = Math.max(...all);
    const pad = Math.max(0.5, 0.05 * (hi - lo));
    const range: [number, number] = [Math.max(-90, lo - pad), Math.min(90, hi + pad)];

    const hover = (body: string) => `${body}<br>az %{x:.1f}°  el %{y:.2f}°<br>%{text}<extra></extra>`;
    const sunUp = (i: number) => sun.fraction[i] > 0;
    const earthUp = (i: number) => earth.margin[i] >= 0;

    const traces: Data[] = [
      // The floor the skyline fill closes against: the bottom of the visible range.
      { x: [0, 360], y: [range[0], range[0]], mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
      {
        x: skyline.az, y: skyline.el, name: "Terrain", mode: "lines", fill: "tonexty",
        line: { color: TERRAIN, width: 1 }, fillcolor: "rgba(139,148,158,0.35)",
        hovertemplate: "Skyline<br>az %{x:.1f}°  el %{y:.2f}°<extra></extra>",
      },
      { ...track(sun.az, sun.el, times, (i) => !sunUp(i)), name: "Sun (hidden)", mode: "lines",
        line: { color: SUN, width: 1, dash: "dot" }, opacity: 0.8, hovertemplate: hover("Sun · hidden"), showlegend: false },
      { ...track(sun.az, sun.el, times, sunUp), name: "Sun", mode: "lines",
        line: { color: SUN, width: 2 }, hovertemplate: hover("Sun") },
      { ...track(earth.az, earth.el, times, (i) => !earthUp(i)), name: "Earth (hidden)", mode: "lines",
        line: { color: EARTH, width: 1, dash: "dot" }, opacity: 0.8, hovertemplate: hover("Earth · hidden"), showlegend: false },
      { ...track(earth.az, earth.el, times, earthUp), name: "Earth", mode: "lines",
        line: { color: EARTH, width: 2 }, hovertemplate: hover("Earth") },
    ];

    const layout: Partial<Layout> = {
      autosize: true, // the height comes from the style below
      margin: { l: 52, r: 12, t: 8, b: 36 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "#0d1117",
      font: { color: TEXT, family: "system-ui, sans-serif", size: 12 },
      xaxis: {
        range: [0, 360], tickvals: COMPASS.map((_, i) => i * 45), ticktext: COMPASS,
        gridcolor: GRID, zeroline: false, fixedrange: false,
      },
      yaxis: { range, title: { text: "Elevation (°)" }, gridcolor: GRID, zerolinecolor: TERRAIN },
      legend: { orientation: "h", x: 1, xanchor: "right", y: 1, yanchor: "bottom", bgcolor: "rgba(0,0,0,0)" },
      hovermode: "closest",
      // Keeps the user's zoom while the markers move with the scrubber.
      uirevision: `${analysis.site.lat},${analysis.site.lon},${times[0]},${times.length}`,
    };
    return { traces, layout };
  }, [analysis]);

  if (!analysis || !base) {
    return (
      <section className="panel">
        <h2>Horizon panorama</h2>
        <div className="placeholder tall">
          <span>Run Analyze to see the terrain skyline with the Sun and Earth paths</span>
        </div>
      </section>
    );
  }

  const i = timeIndex;
  const now = stamp(analysis.times[i]);
  const marker = (body: string, az: number, el: number, colour: string, up: boolean): Data => ({
    x: [az], y: [el], name: body, mode: "markers", showlegend: false,
    marker: { color: up ? colour : "rgba(0,0,0,0)", size: 14, line: { color: colour, width: 2 } },
    text: [now],
    hovertemplate: `${body} now${up ? "" : " · hidden"}<br>az %{x:.1f}°  el %{y:.2f}°<br>%{text}<extra></extra>`,
  });

  return (
    <section className="panel">
      <h2>Horizon panorama</h2>
      <Plot
        data={[
          ...base.traces,
          marker("Sun", analysis.sun.az[i], analysis.sun.el[i], SUN, analysis.sun.fraction[i] > 0),
          marker("Earth", analysis.earth.az[i], analysis.earth.el[i], EARTH, analysis.earth.margin[i] >= 0),
        ]}
        // Plotly writes into the layout it's given, so each render gets a fresh copy of the memoized one.
        layout={{ ...base.layout }}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
        style={{ width: "100%", height: 300 }}
      />
      <p className="muted panorama-note">
        Solid: above the skyline. Dotted: hidden by terrain. Hollow marker: hidden now. Drag to zoom, double-click to reset.
      </p>
    </section>
  );
}
