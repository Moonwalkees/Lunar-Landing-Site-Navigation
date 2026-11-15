import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import TerrainMap from "../components/TerrainMap";
import type { SkyPosition, View3D } from "../components/TerrainView3D";
import { terrainTileFor } from "../terrain";
import type { Analysis } from "../types";
import RoverPanel from "./RoverPanel";
import { eclipseAt, eclipses, nextEclipse } from "../eclipses";
import { stamp } from "./data";

// The Unity build (63 MB, doc/3d-view.md) only loads once the user picks surface or orbit.
const TerrainView3D = lazy(() => import("../components/TerrainView3D"));

interface Props {
  name: string;
  lat: number;
  lon: number;
  sun: SkyPosition | null;
  earth: SkyPosition | null;
  // The selected site's analysis and the scrub step, for the rover readout; null until it has loaded.
  analysis: Analysis | null;
  index: number;
  onScrub: (i: number) => void;
  onClose: () => void;
}

type View = View3D | "birdseye";

const VIEWS: { id: View; label: string }[] = [
  { id: "birdseye", label: "2D MAP" },
  { id: "orbit", label: "ORBIT" },
  { id: "surface", label: "SURFACE" },
];

// The detailed views for the selected site, over the page and above the time dock, so scrubbing
// still moves the Sun and Earth. Tabs run 2D MAP, ORBIT, SURFACE and open on the Unity orbit view;
// 2D MAP is the bird's-eye map (doc/2d-view.md) with its pan / zoom / height readout.
// Agreed with the user: the dot-matrix dither is for the overview map only; these are unfiltered.
export default function Detail3D({ name, lat, lon, sun, earth, analysis, index, onScrub, onClose }: Props) {
  // A site with no 3D terrain (the Apollo presets, most custom sites) opens on the 2D map, and its
  // ORBIT and SURFACE tabs are off: the Unity view would only say there is nothing to show.
  const has3D = terrainTileFor(lat, lon) !== null;
  const [view, setView] = useState<View>(has3D ? "orbit" : "birdseye");

  // Eclipses in the window: a badge while one is under way, and a button that moves the time to
  // the next one's peak. The view and camera stay as they are (ticket 7.4).
  const list = useMemo(() => (analysis ? eclipses(analysis) : []), [analysis]);
  const now = eclipseAt(list, index);
  const next = nextEclipse(list, index);
  const goToEclipse = () => {
    if (next) onScrub(next.peak);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const eclipseButton = next && (
    <button key="eclipse" className="eclipse-go" onClick={goToEclipse}
      title={"Peak " + stamp(analysis?.times[next.peak]) + ", up to " + Math.round(next.covered * 100) + "% of the Sun covered"}>
      GO TO ECLIPSE
    </button>
  );
  const viewButtons = VIEWS.map((v) => (
    <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}
      disabled={v.id !== "birdseye" && !has3D} title={v.id !== "birdseye" && !has3D ? "No 3D terrain for this site" : undefined}>
      {v.label}
    </button>
  ));

  return (
    <div className="u3d" role="dialog" aria-modal="false" aria-label={"Surface view of " + name}>
      <div className="u3d-head">
        <div>
          <div className="mono">
            {view === "birdseye" ? "2D terrain map · LOLA" : "3D terrain · LOLA · true scale"}
            {!has3D && " · no 3D terrain for this site"}
          </div>
          <div className="nm">{name}</div>
        </div>
        <button className="cbtn" onClick={onClose}>CLOSE</button>
      </div>
      <div className="u3d-body">
        {analysis && <RoverPanel analysis={analysis} index={index} low={view === "birdseye"} />}
        {now && analysis && (
          <div className="eclipse-badge" role="status">
            ECLIPSE · {Math.max(1, Math.round((analysis.sun.behindEarth[index] ?? 0) * 100))}% OF THE SUN BEHIND THE EARTH
          </div>
        )}
        {view === "birdseye" ? (
          <TerrainMap lat={lat} lon={lon} sun={sun} earth={earth} viewButtons={<>{viewButtons}{eclipseButton}</>} />
        ) : (
          <Suspense fallback={<div className="terrain-stage"><div className="terrain-note">Loading 3D view…</div></div>}>
            <TerrainView3D lat={lat} lon={lon} sun={sun} earth={earth} view={view} viewButtons={<>{viewButtons}{eclipseButton}</>} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
