import { useState } from "react";
import SiteForm from "./components/SiteForm";
import MetricCards from "./components/MetricCards";
import Panorama from "./components/Panorama";
import TimeSeries from "./components/TimeSeries";
import Compare, { MAX_COMPARE } from "./components/Compare";
import { PRESETS } from "./sites";
import { EMPTY_METRICS, type Metrics, type PinnedSite, type SiteInput } from "./types";

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

  const maxIndex = Math.max(0, Math.floor((site.days * 24) / site.stepHours));

  // Placeholder: will call POST /analyze once the backend exists.
  const analyze = () => {
    setMetrics(EMPTY_METRICS);
    setTimeIndex(0);
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
        </p>
      </header>
      <div className="layout">
        <aside>
          <SiteForm
            site={site}
            onChange={setSite}
            onAnalyze={analyze}
            onAddToCompare={addToCompare}
            canAdd={pinned.length < MAX_COMPARE}
          />
        </aside>
        <main>
          <MetricCards metrics={metrics} />
          <Panorama timeIndex={timeIndex} />
          <TimeSeries timeIndex={Math.min(timeIndex, maxIndex)} maxIndex={maxIndex} onScrub={setTimeIndex} />
          <Compare pinned={pinned} onRemove={(i) => setPinned(pinned.filter((_, j) => j !== i))} />
        </main>
      </div>
    </div>
  );
}
