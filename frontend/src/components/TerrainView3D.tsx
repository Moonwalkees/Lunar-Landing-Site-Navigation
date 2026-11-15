import { useEffect, useRef, useState, type ReactNode } from "react";
import { TERRAIN_TILES, terrainTileFor } from "../terrain";
import { guardTextInput } from "../keyGuard";

// Where a body is in the sky as seen from the site, in degrees:
// azimuth clockwise from local north, elevation above the local level plane.
export interface SkyPosition {
  az: number;
  el: number;
}

interface Props {
  lat: number;
  lon: number;
  // Null until an analysis supplies them; the view then keeps its example angles.
  sun: SkyPosition | null;
  earth: SkyPosition | null;
  view: View3D;
  // The panel's view buttons (bird's-eye, orbit, surface).
  viewButtons: ReactNode;
}

export type View3D = "orbit" | "surface";

interface UnityInstance {
  SendMessage(object: string, method: string, value: string | number): void;
  Quit(): Promise<void>;
}

declare global {
  interface Window {
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: Record<string, unknown>,
      onProgress?: (progress: number) => void,
    ) => Promise<UnityInstance>;
  }
}

// The Unity WebGL build lives in frontend/public/unity (see doc/3d-view.md).
const UNITY = import.meta.env.BASE_URL + "unity/";

let loader: Promise<void> | null = null;
function loadUnityLoader(): Promise<void> {
  guardTextInput(); // already installed by main.tsx; kept so this view is safe on its own
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = UNITY + "Build/WebGL.loader.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the 3D view"));
    document.head.appendChild(script);
  });
  return loader;
}

// The 3D half of the terrain panel (TerrainView): the real terrain around the site, with the Sun casting shadows and the Earth
// in the sky. It only displays the angles it is given; it never computes them.
export default function TerrainView3D({ lat, lon, sun, earth, view, viewButtons }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const unity = useRef<UnityInstance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [progress, setProgress] = useState(0);
  const [closeUp, setCloseUp] = useState(false);

  const tile = terrainTileFor(lat, lon);

  // Start Unity once. The start is deferred by a tick so that React's development-mode
  // double mount doesn't create and immediately discard a whole engine.
  useEffect(() => {
    const run = {
      cancelled: false,
      canvas: null as HTMLCanvasElement | null,
      instance: null as UnityInstance | null,
    };
    const timer = setTimeout(async () => {
      const canvas = document.createElement("canvas");
      canvas.id = "terrain-view-canvas";     // Unity finds its canvas by id to listen for keys
      canvas.tabIndex = -1;
      run.canvas = canvas;
      stage.current?.appendChild(canvas);
      try {
        await loadUnityLoader();
        const instance = await window.createUnityInstance!(
          canvas,
          {
            dataUrl: UNITY + "Build/WebGL.data.unityweb",
            frameworkUrl: UNITY + "Build/WebGL.framework.js.unityweb",
            codeUrl: UNITY + "Build/WebGL.wasm.unityweb",
            streamingAssetsUrl: UNITY + "StreamingAssets",
            companyName: "DefaultCompany",
            productName: "MyGame",
            productVersion: "0.1.0",
            devicePixelRatio: Math.min(window.devicePixelRatio, 2),
          },
          (p) => {
            if (!run.cancelled) setProgress(p);
          },
        );
        if (run.cancelled) {
          void instance.Quit().finally(() => canvas.remove());
          return;
        }
        run.instance = instance;
        unity.current = instance;
        setStatus("ready");
      } catch (error) {
        console.error("The 3D view failed to start:", error);
        if (!run.cancelled) setStatus("failed");
      }
    }, 0);

    return () => {
      run.cancelled = true;
      clearTimeout(timer);
      unity.current = null;
      const canvas = run.canvas;
      if (run.instance) void run.instance.Quit().finally(() => canvas?.remove());
      else if (canvas) canvas.style.display = "none";
    };
  }, []);

  // Tell the view what to show. Fields left out keep their previous value, so a site
  // with no terrain, or angles that aren't known yet, simply aren't sent.
  const sunAz = sun?.az, sunEl = sun?.el, earthAz = earth?.az, earthEl = earth?.el;
  useEffect(() => {
    if (status !== "ready" || !unity.current) return;
    const message: Record<string, number | string> = { view };
    if (tile) {
      message.lat = lat;
      message.lon = lon;
    }
    if (sunAz !== undefined && sunEl !== undefined) {
      message.sunAz = sunAz;
      message.sunEl = sunEl;
    }
    if (earthAz !== undefined && earthEl !== undefined) {
      message.earthAz = earthAz;
      message.earthEl = earthEl;
    }
    unity.current.SendMessage("Bridge", "SetState", JSON.stringify(message));
  }, [status, tile, lat, lon, sunAz, sunEl, earthAz, earthEl, view]);

  return (
    <>
      <div className="terrain-stage" ref={stage}>
        {status === "loading" && (
          <div className="terrain-note">Loading 3D view… {Math.round(progress * 100)}%</div>
        )}
        {status === "failed" && <div className="terrain-note">The 3D view could not start.</div>}
        {status === "ready" && !tile && (
          <div className="terrain-note">
            No 3D terrain for this site yet. It is available around:{" "}
            {TERRAIN_TILES.map((t) => t.name).join(", ")}.
          </div>
        )}
      </div>
      <div className="actions">
        {viewButtons}
        {view === "orbit" && (
          <button
            className="secondary"
            disabled={status !== "ready" || !tile}
            title="The rover at the site is 3 m long, so it only shows from close by."
            onClick={() => {
              // Metres from the site: 14 for a close-up of the rover, 9000 for the usual overview.
              unity.current?.SendMessage("Bridge", "SetOrbitDistance", closeUp ? 9000 : 14);
              setCloseUp(!closeUp);
            }}
          >
            {closeUp ? "Zoom out" : "Zoom to rover"}
          </button>
        )}
      </div>
      <p className="muted terrain-hint">
        Drag to look around, scroll to zoom.
        {(!sun || !earth) && " The Sun and Earth are at example angles until Analyze supplies real ones."}
      </p>
    </>
  );
}
