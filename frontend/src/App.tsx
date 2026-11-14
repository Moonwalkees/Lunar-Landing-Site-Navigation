import { useState } from "react";
import SiteForm from "./components/SiteForm";
import MetricCards from "./components/MetricCards";
import Panorama from "./components/Panorama";
import TerrainView from "./components/TerrainView";
import TimeSeries from "./components/TimeSeries";
import Compare, { MAX_COMPARE } from "./components/Compare";
import { analyze as requestAnalysis } from "./api/client";
import { PRESETS } from "./sites";
import { EMPTY_METRICS, type Analysis, type Metrics, type PinnedSite, type SiteInput } from "./types";

const today = new Date().toISOString().slice(0, 10);

export default function App() {
  const [site, setSite] = useState<SiteInput>({
    name: PRESETS[0].name,
    lat: PRESETS[0].lat,
    lon: PRESETS[0].lon,
    startDate: today,
    days: 29.5, // one lunar month
    stepHours: 1,
  });
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [pinned, setPinned] = useState<PinnedSite[]>([]);
  const [timeIndex, setTimeIndex] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxIndex = analysis
    ? analysis.times.length - 1
    : Math.max(0, Math.floor((site.days * 24) / site.stepHours));
  // One valid index for every panel, however the window has changed since the last drag.
  const index = Math.min(timeIndex, maxIndex);

  // The Sun and Earth tracks only describe the site they were computed for.
  const tracks = analysis && analysis.site.lat === site.lat && analysis.site.lon === site.lon ? analysis : null;

  const analyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await requestAnalysis(site);
      setAnalysis(result);
      setMetrics(result.metrics);
      setTimeIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const addToCompare = () => {
    if (pinned.length < MAX_COMPARE) setPinned([...pinned, { site, metrics }]);
  };

  return (
    <div className="app">
      <header>
        <h1>Lunar Landing Site Navigator</h1>
        <p className="muted">
          {site.name} · {site.lat.toFixed(2)}°, {site.lon.toFixed(2)}°E · {site.startDate} + {site.days} d
          {tracks && " · " + tracks.times[index].replace("T", " ").replace(":00Z", " UTC")}
        </p>
        {error && <p className="error">{error}</p>}
      </header>
      <div className="layout">
        <aside>
          <SiteForm
            site={site}
            onChange={setSite}
            onAnalyze={analyze}
            analyzing={analyzing}
            onAddToCompare={addToCompare}
            canAdd={pinned.length < MAX_COMPARE}
          />
        </aside>
        <main>
          <MetricCards metrics={metrics} />
          <Panorama timeIndex={index} />
          <TerrainView
            lat={site.lat}
            lon={site.lon}
            sun={tracks && { az: tracks.sun.az[index], el: tracks.sun.el[index] }}
            earth={tracks && { az: tracks.earth.az[index], el: tracks.earth.el[index] }}
          />
          <TimeSeries timeIndex={index} maxIndex={maxIndex} onScrub={setTimeIndex} />
          <Compare pinned={pinned} onRemove={(i) => setPinned(pinned.filter((_, j) => j !== i))} />
        </main>
      </div>
    </div>
  );
}
