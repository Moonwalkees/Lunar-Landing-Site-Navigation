import { Suspense, lazy, useEffect, useState } from "react";
import TerrainMap from "../components/TerrainMap";
import type { SkyPosition, View3D } from "../components/TerrainView3D";
import type { Analysis } from "../types";
import RoverPanel from "./RoverPanel";

// The Unity build (55 MB, doc/3d-view.md) only loads once the user picks surface or orbit.
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
export default function Detail3D({ name, lat, lon, sun, earth, analysis, index, onClose }: Props) {
  const [view, setView] = useState<View>("orbit");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const viewButtons = VIEWS.map((v) => (
    <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
      {v.label}
    </button>
  ));

  return (
    <div className="u3d" role="dialog" aria-modal="false" aria-label={"Surface view of " + name}>
      <div className="u3d-head">
        <div>
          <div className="mono">{view === "birdseye" ? "2D terrain map · LOLA" : "3D terrain · LOLA · true scale"}</div>
          <div className="nm">{name}</div>
        </div>
        <button className="cbtn" onClick={onClose}>CLOSE</button>
      </div>
      <div className="u3d-body">
        {analysis && <RoverPanel analysis={analysis} index={index} low={view === "birdseye"} />}
        {view === "birdseye" ? (
          <TerrainMap lat={lat} lon={lon} sun={sun} earth={earth} viewButtons={viewButtons} />
        ) : (
          <Suspense fallback={<div className="terrain-stage"><div className="terrain-note">Loading 3D view…</div></div>}>
            <TerrainView3D lat={lat} lon={lon} sun={sun} earth={earth} view={view} viewButtons={viewButtons} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
