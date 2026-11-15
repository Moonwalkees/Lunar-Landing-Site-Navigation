import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, getSites } from "../api/client";
import { FALLBACK_SITE, defaultSite } from "../sites";
import type { Preset, TerrainGrid } from "../types";
import Board from "./Board";
import {
  STATE_LABEL, azDeg, cellSteps, hours, pct, rankRows, resultKey, score, signedDeg, splitName, stamp, stateAt,
  type BoardSite, type MissionWindow, type Row, type SiteResult, type SortKey,
} from "./data";
import Detail3D from "./Detail3D";
import MissionCard from "./MissionCard";
import { clearShared, readShared, samePlace, sharedWindow } from "./share";
import { DEFAULT_ROVER } from "../rovers";
import { terrainTileFor } from "../terrain";
import { clearSaved, loadBoard, saveBoard } from "../persist";
import DotChart from "./DotChart";
import HeroMap, { type MapPin } from "./HeroMap";
import UiSwitch from "../UiSwitch";
import { AddSite, Lamps, MetricsPanel, Mission, TimeDock } from "./Panels";
import Skyline from "./Skyline";

const presetSite = (p: Preset): BoardSite => ({ id: "p:" + p.name, name: p.name, lat: p.lat, lon: p.lon, custom: false });
const today = new Date().toISOString().slice(0, 10);

// The dot-matrix departure board (doc/style.md). Every preset is analysed for the same window,
// so the board ranks them side by side; one shared time index drives every panel.
export default function BoardApp() {
  // What the user set up last visit (src/persist.ts); read once, then every change below is saved back.
  const [saved] = useState(loadBoard);
  // A mission card link (share.ts, ticket 8.1): read once, then taken out of the address bar. It wins
  // over the saved setup: its site is selected (added beside the saved custom sites when it is none
  // of them or a preset), and its window and rover replace the saved ones.
  const [shared] = useState(() => readShared(window.location.search));
  useEffect(() => { if (shared) clearShared(); }, [shared]);

  // ---- sites ----
  const [presets, setPresets] = useState<BoardSite[]>([presetSite(FALLBACK_SITE)]);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [customs, setCustoms] = useState<BoardSite[]>(saved.customs);
  const [selectedId, setSelectedId] = useState(saved.selectedId ?? presetSite(FALLBACK_SITE).id);
  const touched = useRef(saved.selectedId !== undefined); // has the user picked a site yet?

  useEffect(() => {
    let cancelled = false;
    // A shared site is selected: the preset or saved custom site at the same place (shown again if
    // it was deleted), or else a new custom site added for it.
    const placeShared = (list: BoardSite[]) => {
      const want = shared?.site;
      if (!want) return false;
      const match = [...list, ...saved.customs].find((p) => samePlace(p, want));
      if (match) {
        setSelectedId(match.id);
        setHidden((h) => {
          if (!h.has(match.id)) return h;
          const next = new Set(h);
          next.delete(match.id);
          return next;
        });
      } else {
        const id = "c:" + Date.now();
        setCustoms((c) => [...c, { id, ...want, custom: true }]);
        setSelectedId(id);
      }
      touched.current = true;
      return true;
    };
    getSites()
      .then((list) => {
        if (cancelled) return;
        if (list.length === 0) { placeShared([presetSite(FALLBACK_SITE)]); return; }
        setPresets(list.map(presetSite));
        if (!placeShared(list.map(presetSite)) && !touched.current) setSelectedId(presetSite(defaultSite(list)).id);
      })
      .catch((e) => {
        if (cancelled) return;
        setSitesError(e instanceof Error ? e.message : "Could not load sites.");
        placeShared([presetSite(FALLBACK_SITE)]);
      });
    return () => { cancelled = true; };
  }, [shared, saved]);

  const [hidden, setHidden] = useState<Set<string>>(new Set(saved.hidden)); // presets deleted from the board
  // The board always needs a site: saved deletions that would empty it (say, the only preset shown
  // before GET /sites answers) are ignored until there is something else to show.
  const sites = useMemo(() => {
    const shown = [...presets.filter((p) => !hidden.has(p.id)), ...customs];
    return shown.length > 0 ? shown : presets;
  }, [presets, customs, hidden]);

  // ---- analyses: one per site for the shared window ----
  // A year by default, so Play runs through every season. 2 h steps keep the five analyses to a few seconds.
  const [win, setWin] = useState<MissionWindow>(() =>
    sharedWindow(shared, saved.win ?? { startDate: today, days: 365, stepHours: 2, rover: DEFAULT_ROVER }));
  // Only a window the user ran (or opened from a card link) is saved, so the default start stays "today".
  const winRun = useRef(saved.win !== undefined || !!shared?.window || !!shared?.rover);
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
  const [timeIndex, setTimeIndex] = useState(() => shared?.t ?? 0);
  const ready = sites.flatMap((s) => {
    const r = results[s.id];
    return r?.status === "ready" && r.key === resultKey(s, win) ? [r.analysis] : [];
  });
  const clock = ready[0] ?? null; // every analysis shares the window, so any one gives the times
  const maxIndex = clock ? clock.times.length - 1 : 0;
  const index = Math.min(timeIndex, maxIndex);

  // ---- rows ----
  const [sortKey, setSortKey] = useState<SortKey>(saved.sortKey ?? "score");
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
    id: r.site.id, name: splitName(r.site.name)[0], lat: r.site.lat, lon: r.site.lon,
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
  // The mission card keeps the time step it was opened at (null while closed).
  const [cardAt, setCardAt] = useState<number | null>(null);
  // On phones the console covers most of the map; HIDE folds it down to the site name.
  const [consoleHidden, setConsoleHidden] = useState(false);
  const closeCard = useCallback(() => setCardAt(null), []);

  // Save the setup whenever it changes. The selection is saved only once the user has picked a site,
  // so the backend's default site is not frozen in before they choose.
  useEffect(() => {
    saveBoard({
      customs,
      hidden: [...hidden],
      win: winRun.current ? win : undefined,
      selectedId: touched.current ? selectedId : undefined,
      sortKey,
    });
  }, [customs, hidden, win, selectedId, sortKey]);
  const resetSaved = () => { clearSaved(); location.reload(); };

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
    onCard: () => { select(id); setCardAt(index); },
    onDelete: sites.length > 1 ? () => removeSite(id) : null,
  });
  const selActions = actions(sel.id);
  const sel3D = terrainTileFor(sel.lat, sel.lon) !== null; // the 3D views only have terrain for some south pole areas

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
            <div className="hud-right">
              <div className="clock" aria-live="off">
                <div><span className="mono">UTC</span><b>{stamp(a?.times[ai])}</b></div>
                <div><span className="mono">Sun az</span><b>{azDeg(sun?.az)}</b></div>
                <div><span className="mono">Sun el</span><b className="s">{signedDeg(sun?.el)}</b></div>
                <div><span className="mono">Earth el</span><b className="e">{signedDeg(earth?.el)}</b></div>
              </div>
              <UiSwitch />
            </div>
          </div>
          <div className="hud hint mono">Drag orbit · pinch zoom · tap a pin</div>
          <div className={"hud console" + (consoleHidden ? " min" : "")}>
            <div className="console-top">
              <div className="nm">{consoleHidden ? splitName(sel.name)[0] : sel.name}</div>
              {/* Phones only (board.css): fold the console down to the name so the map shows. */}
              <button className="cbtn console-fold" aria-expanded={!consoleHidden} onClick={() => setConsoleHidden((v) => !v)}
                aria-label={consoleHidden ? "Show the site details" : "Hide the site details to see the map"}>
                {consoleHidden ? "SHOW" : "HIDE"}
              </button>
            </div>
            <div className="mono coord">
              LAT {sel.lat.toFixed(2)}° · LON {sel.lon.toFixed(2)}°E
              {!sel3D && <span className="tag2d">2D ONLY · NO 3D TERRAIN HERE</span>}
            </div>
            <div className="kv">
              <div><span className="mono">% sunlit</span><b className="s">{pct(a?.metrics.pctSunlit)}</b></div>
              <div><span className="mono">% contact</span><b className="e">{pct(a?.metrics.pctEarthVisible)}</b></div>
              <div><span className="mono">Max dark</span><b>{hours(a?.metrics.longestNightH)}</b></div>
              {/* Right now, at the scrub time: Sun up (power) and Earth in view (comms), as the board's LIT / COMMS columns. */}
              <div><span className="mono">Lit</span>{yn(selLit, "s")}</div>
              <div><span className="mono">Comms</span>{yn(selAos, "e")}</div>
            </div>
            {/* The row ⋮ menu's actions as buttons (minus GO TO SITE: the console is already on the map). */}
            <div className="console-btns">
              <button className="cbtn" aria-pressed={open3D} onClick={selActions.onSurface}>{sel3D ? "SURFACE VIEW" : "2D MAP VIEW"}</button>
              <button className="cbtn" aria-pressed={cardAt !== null} onClick={selActions.onCard}>MISSION CARD</button>
              <button className="cbtn del" disabled={!selActions.onDelete} onClick={selActions.onDelete ?? undefined}
                title={selActions.onDelete ? undefined : "The board needs at least one site"}>DELETE</button>
            </div>
          </div>
        </HeroMap>
      </div>

      <div className="wrap">
        <Lamps states={rows.flatMap((r) => (r.state ? [r.state] : []))} />
        <Mission win={win} onWindow={(w) => { winRun.current = true; setWin(w); setTimeIndex(0); }} onReset={resetSaved} />
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

      {open3D && (
        <Detail3D name={sel.name} lat={sel.lat} lon={sel.lon} sun={sun} earth={earth}
          analysis={a ?? null} index={ai} onScrub={setTimeIndex} onClose={closeDetail} />
      )}

      {cardAt !== null && (
        <MissionCard site={sel} analysis={a ?? null} index={a ? Math.min(cardAt, a.times.length - 1) : cardAt} win={win} grid={grid} onClose={closeCard} />
      )}

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
