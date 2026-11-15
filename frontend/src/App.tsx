import UiSwitch from "./UiSwitch";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import SiteForm from "./components/SiteForm";
import MetricCards from "./components/MetricCards";
import TerrainView from "./components/TerrainView";
import RoverStatus from "./components/RoverStatus";
import TimeSeries from "./components/TimeSeries";
import Compare, { MAX_COMPARE } from "./components/Compare";
import { analyze as requestAnalysis, getSites } from "./api/client";
import { FALLBACK_SITE, defaultSite } from "./sites";
import { DEFAULT_ROVER } from "./rovers";
import { loadClassic, saveClassic } from "./persist";
import { EMPTY_METRICS, type Analysis, type Metrics, type PinnedSite, type Preset, type SiteInput } from "./types";

// Plotly is most of the bundle, so the panorama loads separately and the rest of the page doesn't wait for it.
const Panorama = lazy(() => import("./components/Panorama"));

const today = new Date().toISOString().slice(0, 10);

export default function App() {
  // The form as the user left it last visit (src/persist.ts), else the defaults.
  const [site, setSite] = useState<SiteInput>(
    () =>
      loadClassic() ?? {
        ...FALLBACK_SITE,
        startDate: today,
        days: 29.5, // one lunar month
        stepHours: 1,
        rover: DEFAULT_ROVER,
      },
  );
  // Only a form the user has edited is saved, so the default start date stays "today" on every visit.
  const edited = useRef(false);
  const editSite = (s: SiteInput) => {
    edited.current = true;
    setSite(s);
  };
  useEffect(() => {
    if (edited.current) saveClassic(site);
  }, [site]);
  // Until GET /sites answers (or if it never does), offer the fallback site only.
  const [presets, setPresets] = useState<Preset[]>([FALLBACK_SITE]);
  const [presetsError, setPresetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSites()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setPresets(list);
        const start = defaultSite(list);
        // Move to the backend's default only if the user hasn't picked or typed a site yet.
        setSite((s) =>
          s.name === FALLBACK_SITE.name && s.lat === FALLBACK_SITE.lat && s.lon === FALLBACK_SITE.lon
            ? { ...s, ...start }
            : s,
        );
      })
      .catch((e) => {
        if (!cancelled) setPresetsError(e instanceof Error ? e.message : "Could not load presets.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [pinned, setPinned] = useState<PinnedSite[]>([]);
  const [timeIndex, setTimeIndex] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxIndex = analysis
    ? analysis.times.length - 1
    // Guarded so a bad window or step can never turn the scrubber's maximum into NaN or Infinity (BUG-002).
    : site.days > 0 && site.stepHours > 0 ? Math.max(0, Math.floor((site.days * 24) / site.stepHours)) : 0;
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
        <UiSwitch />
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
            presets={presets}
            presetsError={presetsError}
            onChange={editSite}
            onAnalyze={analyze}
            analyzing={analyzing}
            onAddToCompare={addToCompare}
            canAdd={pinned.length < MAX_COMPARE}
          />
        </aside>
        <main>
          <MetricCards metrics={metrics} />
          <Suspense fallback={<section className="panel"><h2>Horizon panorama</h2><p className="muted">Loading chart…</p></section>}>
            <Panorama analysis={tracks} timeIndex={index} />
          </Suspense>
          <TerrainView
            lat={site.lat}
            lon={site.lon}
            sun={tracks && { az: tracks.sun.az[index], el: tracks.sun.el[index] }}
            earth={tracks && { az: tracks.earth.az[index], el: tracks.earth.el[index] }}
            overlay={tracks && <RoverStatus analysis={tracks} index={index} />}
            analysis={tracks}
            index={index}
          />
          <TimeSeries analysis={analysis} timeIndex={index} maxIndex={maxIndex} onScrub={setTimeIndex} />
          <Compare pinned={pinned} onRemove={(i) => setPinned(pinned.filter((_, j) => j !== i))} />
        </main>
      </div>
    </div>
  );
}
