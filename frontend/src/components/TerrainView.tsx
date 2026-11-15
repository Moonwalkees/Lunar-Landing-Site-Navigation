import { Suspense, lazy, useState, type ReactNode } from "react";
import TerrainMap from "./TerrainMap";
import { TERRAIN_TILES, terrainTileFor } from "../terrain";
import type { Analysis } from "../types";
import type { SkyPosition, View3D } from "./TerrainView3D";

// The orbit and surface views are Unity WebGL (doc/3d-view.md). They are only loaded, and the
// 63 MB build only downloaded, once the user picks one of them.
const TerrainView3D = lazy(() => import("./TerrainView3D"));

interface Props {
  lat: number;
  lon: number;
  // Null until an analysis supplies them.
  sun: SkyPosition | null;
  earth: SkyPosition | null;
  // Drawn over the top-right corner of whichever view is showing.
  overlay?: ReactNode;
  // For the 2D map's forecast overlay.
  analysis?: Analysis | null;
  index?: number;
}

type View = "birdseye" | View3D;

const VIEWS: { id: View; label: string; title?: string }[] = [
  { id: "birdseye", label: "Bird's-eye view", title: "Light top-down map with shadows (doc/2d-view.md)." },
  { id: "orbit", label: "Orbit view", title: "3D view. Downloads about 25 MB plus terrain and needs a reasonable graphics card." },
  { id: "surface", label: "Surface view", title: "3D view standing on the surface. Same download as the orbit view." },
];

// Terrain around the site. Opens on the light bird's-eye map; orbit and surface are the 3D views.
export default function TerrainView({ overlay, analysis, index, ...props }: Props) {
  const [view, setView] = useState<View>("birdseye");
  // The 3D views only have terrain for some south pole areas; elsewhere the panel stays on the map.
  const has3D = terrainTileFor(props.lat, props.lon) !== null;
  const shown: View = has3D ? view : "birdseye";

  const viewButtons = VIEWS.map((v) => (
    <button
      key={v.id}
      className={shown === v.id ? "" : "secondary"}
      aria-pressed={shown === v.id}
      disabled={v.id !== "birdseye" && !has3D}
      title={v.id !== "birdseye" && !has3D ? "No 3D terrain for this site." : v.title}
      onClick={() => setView(v.id)}
    >
      {v.label}
    </button>
  ));

  return (
    <section className="panel">
      <h2>Terrain view</h2>
      <div className="terrain-wrap">
      {overlay}
      {shown === "birdseye" ? (
        <TerrainMap {...props} analysis={analysis} index={index} viewButtons={viewButtons} />
      ) : (
        <Suspense
          fallback={
            <>
              <div className="terrain-stage"><div className="terrain-note">Loading 3D view…</div></div>
              <div className="actions">{viewButtons}</div>
            </>
          }
        >
          <TerrainView3D {...props} view={shown} viewButtons={viewButtons} />
        </Suspense>
      )}
      {!has3D && (
        <p className="muted terrain-hint">
          2D map only here. The 3D views have terrain around: {TERRAIN_TILES.map((t) => t.name).join(", ")}.
        </p>
      )}
      </div>
    </section>
  );
}
