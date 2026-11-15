import { Suspense, lazy, useState } from "react";
import TerrainMap from "./TerrainMap";
import type { SkyPosition, View3D } from "./TerrainView3D";

// The orbit and surface views are Unity WebGL (doc/3d-view.md). They are only loaded, and the
// 53 MB build only downloaded, once the user picks one of them.
const TerrainView3D = lazy(() => import("./TerrainView3D"));

interface Props {
  lat: number;
  lon: number;
  // Null until an analysis supplies them.
  sun: SkyPosition | null;
  earth: SkyPosition | null;
}

type View = "birdseye" | View3D;

const VIEWS: { id: View; label: string; title?: string }[] = [
  { id: "birdseye", label: "Bird's-eye view", title: "Light top-down map with shadows (doc/2d-view.md)." },
  { id: "orbit", label: "Orbit view", title: "3D view. Downloads about 25 MB plus terrain and needs a reasonable graphics card." },
  { id: "surface", label: "Surface view", title: "3D view standing on the surface. Same download as the orbit view." },
];

// Terrain around the site. Opens on the light bird's-eye map; orbit and surface are the 3D views.
export default function TerrainView(props: Props) {
  const [view, setView] = useState<View>("birdseye");

  const viewButtons = VIEWS.map((v) => (
    <button
      key={v.id}
      className={view === v.id ? "" : "secondary"}
      aria-pressed={view === v.id}
      title={v.title}
      onClick={() => setView(v.id)}
    >
      {v.label}
    </button>
  ));

  return (
    <section className="panel">
      <h2>Terrain view</h2>
      {view === "birdseye" ? (
        <TerrainMap {...props} viewButtons={viewButtons} />
      ) : (
        <Suspense
          fallback={
            <>
              <div className="terrain-stage"><div className="terrain-note">Loading 3D view…</div></div>
              <div className="actions">{viewButtons}</div>
            </>
          }
        >
          <TerrainView3D {...props} view={view} viewButtons={viewButtons} />
        </Suspense>
      )}
    </section>
  );
}
