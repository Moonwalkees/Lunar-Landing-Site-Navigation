import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, getSites } from "../api/client";
import { FALLBACK_SITE, defaultSite } from "../sites";
import type { Preset, TerrainGrid } from "../types";
import Board from "./Board";
import {
  STATE_LABEL, azDeg, cellSteps, hours, pct, rankRows, resultKey, score, signedDeg, stamp, stateAt,
  type BoardSite, type MissionWindow, type Row, type SiteResult, type SortKey,
} from "./data";
import Detail3D from "./Detail3D";
import DotChart from "./DotChart";
import HeroMap, { type MapPin } from "./HeroMap";
import { AddSite, Lamps, MetricsPanel, Mission, TimeDock } from "./Panels";
import Skyline from "./Skyline";

const presetSite = (p: Preset): BoardSite => ({ id: "p:" + p.name, name: p.name, lat: p.lat, lon: p.lon, custom: false });
const today = new Date().toISOString().slice(0, 10);

// The dot-matrix departure board (doc/style.md). Every preset is analysed for the same window,
// so the board ranks them side by side; one shared time index drives every panel.
export default function BoardApp() {
  // ---- sites ----
  const [presets, setPresets] = useState<BoardSite[]>([presetSite(FALLBACK_SITE)]);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [customs, setCustoms] = useState<BoardSite[]>([]);
  const [selectedId, setSelectedId] = useState(presetSite(FALLBACK_SITE).id);
  const touched = useRef(false); // has the user picked a site yet?

  useEffect(() => {
    let cancelled = false;
    getSites()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setPresets(list.map(presetSite));
        if (!touched.current) setSelectedId(presetSite(defaultSite(list)).id);
      })
      .catch((e) => { if (!cancelled) setSitesError(e instanceof Error ? e.message : "Could not load sites."); });
    return () => { cancelled = true; };
  }, []);

  const [hidden, setHidden] = useState<Set<string>>(new Set()); // presets deleted from the board
  const sites = useMemo(() => [...presets.filter((p) => !hidden.has(p.id)), ...customs], [presets, customs, hidden]);

  // ---- analyses: one per site for the shared window ----
  const [win, setWin] = useState<MissionWindow>({ startDate: today, days: 29.5, stepHours: 1 });
  const [results, setResults] = useState<Record<string, SiteResult>>({});
  const asked = useRef(new Map<string, string>()); // site id -> key already requested

  useEffect(() => {
    for (const site of sites) {
      const key = resultKey(site, win);
      if (asked.current.get(site.id) === key) continue;
      asked.current.set(site.id, key);
      setResults((r) => ({ ...r, [site.id]: { status: "loading", key } }));
      analyze({ name: site.name, lat: site.lat, lon: site.lon, ...win })
        .then((analysis) => setResults((r) => (r[site.id]?.key === key ? { ...r, [site.id]: { status: "ready", key, analysis } } : r)))
        .catch((e) => {
          const error = e instanceof Error ? e.message : "The analysis failed.";
          setResults((r) => (r[site.id]?.key === key ? { ...r, [site.id]: { status: "error", key, error } } : r));
        });
    }
  }, [sites, win]);

  // ---- shared time ----
  const [timeIndex, setTimeIndex] = useState(0);
  const ready = sites.flatMap((s) => {
    const r = results[s.id];
    return r?.status === "ready" && r.key === resultKey(s, win) ? [r.analysis] : [];
  });
  const clock = ready[0] ?? null; // every analysis shares the window, so any one gives the times
  const maxIndex = clock ? clock.times.length - 1 : 0;
  const index = Math.min(timeIndex, maxIndex);

  // ---- rows ----
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const rows: Row[] = sites.map((site) => {
    const result = results[site.id];
    const analysis = result?.status === "ready" && result.key === resultKey(site, win) ? result.analysis : null;
    return {
      site,
      result,
      analysis,
      score: analysis ? score(analysis) : null,
      state: analysis ? stateAt(analysis, Math.min(index, analysis.times.length - 1)) : null,
    };
  });
  const ranked = rankRows(rows, sortKey);
  const selRow = rows.find((r) => r.site.id === selectedId) ?? rows[0];
  const sel = selRow.site;
  const a = selRow.analysis;
  const ai = a ? Math.min(index, a.times.length - 1) : 0;
  const sun = a ? { az: a.sun.az[ai], el: a.sun.el[ai] } : null;
  const earth = a ? { az: a.earth.az[ai], el: a.earth.el[ai] } : null;

  const pins: MapPin[] = ranked.map((r, n) => ({
    id: r.site.id, name: r.site.name, lat: r.site.lat, lon: r.site.lon,
    rank: r.analysis ? n + 1 : null, score: r.score, dark: r.state === "dark",
  }));

  // ---- interaction ----
  const [open3D, setOpen3D] = useState(false);
  const [grid, setGrid] = useState<TerrainGrid | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const select = useCallback((id: string, scroll = false) => {
    touched.current = true;
    setSelectedId(id);
    if (scroll) {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      heroRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, []);
  const closeDetail = useCallback(() => setOpen3D(false), []);

  const [adding, setAdding] = useState(false);
  const addCustom = (s: { name: string; lat: number; lon: number }) => {
    const site: BoardSite = { id: "c:" + Date.now(), ...s, custom: true };
    setCustoms((c) => [...c, site]);
    select(site.id, true);
  };
  // Delete a site from the board: custom sites are dropped, presets are hidden for this session.
  const removeSite = (id: string) => {
    if (sites.length <= 1) return;
    if (customs.some((c) => c.id === id)) setCustoms((c) => c.filter((x) => x.id !== id));
    else setHidden((h) => new Set(h).add(id));
    if (id === selectedId) setSelectedId(sites.find((s) => s.id !== id)!.id);
  };
  // The ⋮ menu actions for one site, shared by the board rows and the console.
  const actions = (id: string) => ({
    onGo: () => select(id, true),
    onSurface: () => { select(id); setOpen3D(true); },
    onDelete: sites.length > 1 ? () => removeSite(id) : null,
  });
  const selActions = actions(sel.id);

  // The whole page lightens while the selected site is in sunlight (board.css: html.lit).
  const siteLit = selRow.state === "both" || selRow.state === "sunonly";
  useEffect(() => {
    document.documentElement.classList.toggle("lit", siteLit);
    return () => document.documentElement.classList.remove("lit");
  }, [siteLit]);
  // Faint static behind the page while the selected site has lost Earth (board.css: html.los).
  const siteLos = selRow.state === "sunonly" || selRow.state === "dark";
  useEffect(() => {
    document.documentElement.classList.toggle("los", siteLos);
    return () => document.documentElement.classList.remove("los");
  }, [siteLos]);
  const status = selRow.result?.status === "error" ? "NO DATA" : selRow.state ? STATE_LABEL[selRow.state] : "ACQ…";
  const selLit = selRow.state === "both" || selRow.state === "sunonly";
  const selAos = selRow.state === "both" || selRow.state === "comms";
  const yn = (on: boolean, cls: string) =>
    !selRow.state ? <b className="off">{status === "NO DATA" ? "ERR" : "…"}</b> : <b className={on ? cls : "off"}>{on ? "YES" : "NO"}</b>;
  const failures = rows.filter((r) => r.result?.status === "error").length;
  const backendDown = sitesError !== null && ready.length === 0 && failures > 0;
  const region = sel.lat <= -80 ? "South pole" : sel.lat >= 80 ? "North pole" : `${sel.lat.toFixed(2)}°, ${sel.lon.toFixed(2)}°E`;

  return (
    <>
      <div ref={heroRef}>
        <HeroMap
          site={sel}
          selectedId={sel.id}
          pins={pins}
          sun={sun}
          earth={earth}
          paused={open3D}
          onSelect={(id) => select(id)}
          onOpen3D={() => setOpen3D(true)}
          onTerrain={setGrid}
        >
          <div className="hud hud-top">
            <div>
              <div className="mono">{region} · {win.days}-day window from {win.startDate}</div>
              <h1>Lunar Site Board</h1>
              {backendDown ? (
                <span className="mono flag alert">Backend LOS · {sitesError}</span>
              ) : (
                <span className="mono flag">
                  {grid ? `LOLA ${grid.sourceM} m terrain · ${Math.round(((grid.size - 1) * grid.spacingM) / 1000)} km square` : "Live backend data"}
                </span>
              )}
            </div>
            <div className="clock" aria-live="off">
              <div><span className="mono">UTC</span><b>{stamp(a?.times[ai])}</b></div>
              <div><span className="mono">Sun az</span><b>{azDeg(sun?.az)}</b></div>
              <div><span className="mono">Sun el</span><b className="s">{signedDeg(sun?.el)}</b></div>
              <div><span className="mono">Earth el</span><b className="e">{signedDeg(earth?.el)}</b></div>
            </div>
          </div>
          <div className="hud hint mono">Drag orbit · pinch zoom · tap a pin</div>
          <div className="hud console">
            <div className="nm">{sel.name}</div>
            <div className="mono coord">LAT {sel.lat.toFixed(2)}° · LON {sel.lon.toFixed(2)}°E</div>
            <div className="kv">
              <div><span className="mono">% sunlit</span><b className="s">{pct(a?.metrics.pctSunlit)}</b></div>
              <div><span className="mono">% contact</span><b className="e">{pct(a?.metrics.pctEarthVisible)}</b></div>
              <div><span className="mono">Max dark</span><b>{hours(a?.metrics.longestNightH)}</b></div>
              {/* Right now, at the scrub time: Sun up (power) and Earth in view (comms), as the board's LIT / COMMS columns. */}
              <div><span className="mono">Lit</span>{yn(selLit, "s")}</div>
              <div><span className="mono">Comms</span>{yn(selAos, "e")}</div>
            </div>
            {/* The same actions as each board row's ⋮ menu, as a list of buttons. */}
            <div className="console-btns">
              <button className="cbtn" onClick={selActions.onGo}>GO TO SITE</button>
              <button className="cbtn" aria-pressed={open3D} onClick={selActions.onSurface}>SURFACE VIEW</button>
              <button className="cbtn del" disabled={!selActions.onDelete} onClick={selActions.onDelete ?? undefined}
                title={selActions.onDelete ? undefined : "The board needs at least one site"}>DELETE</button>
            </div>
          </div>
        </HeroMap>
      </div>

      <div className="wrap">
        <Lamps states={rows.flatMap((r) => (r.state ? [r.state] : []))} />
        <Mission win={win} onWindow={(w) => { setWin(w); setTimeIndex(0); }} />
        <div className="main">
          <Board
            rows={ranked}
            selectedId={sel.id}
            sortKey={sortKey}
            onSort={setSortKey}
            onSelect={(id) => select(id, true)}
            adding={adding}
            onToggleAdd={() => setAdding((v) => !v)}
            addForm={<AddSite onAdd={addCustom} />}
            actions={actions}
          />
          <div className="side">
            <DotChart analysis={a} timeIndex={ai} maxIndex={a ? a.times.length - 1 : 0} onScrub={setTimeIndex} />
            <Skyline analysis={a} timeIndex={ai} />
            <MetricsPanel name={sel.name} metrics={a?.metrics ?? null} />
          </div>
        </div>
      </div>

      {open3D && <Detail3D name={sel.name} lat={sel.lat} lon={sel.lon} sun={sun} earth={earth} onClose={closeDetail} />}

      <TimeDock
        timeIndex={index}
        maxIndex={maxIndex}
        cellSteps={cellSteps(win.stepHours)}
        time={clock?.times[index]}
        enabled={clock !== null}
        onScrub={setTimeIndex}
      />
    </>
  );
}
