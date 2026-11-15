import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getTerrain } from "../api/client";
import { occlusion, paint, relief, sunlight } from "../terrain2d";
import type { TerrainGrid } from "../types";
import type { SkyPosition } from "./TerrainView3D";

interface Props {
  lat: number;
  lon: number;
  sun: SkyPosition | null;
  earth: SkyPosition | null;
  // The panel's view buttons (bird's-eye, orbit, surface).
  viewButtons: ReactNode;
}

// Same colours as the panorama and time series.
const SUN = "#c08a1c";
const EARTH = "#4a8fe6";
const TEXT = "#e6edf3";
const BG = "#000";

// Grids already fetched, so going back to a site doesn't ask the backend again.
const cache = new Map<string, TerrainGrid>();

interface ViewBox {
  zoom: number; // screen pixels per grid cell, relative to fitting the grid
  x: number; // grid cell (column) at the centre of the canvas
  y: number; // grid cell (row) at the centre of the canvas
}

// Top-down map of the terrain around the site, with shadows for the current Sun and arrows
// toward the Sun and the Earth. Like the 3D view it only displays the angles it is given.
export default function TerrainMap({ lat, lon, sun, earth, viewButtons }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<TerrainGrid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [box, setBox] = useState<ViewBox | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);

  // Fetch the grid. The site form changes on every keystroke, so wait until typing pauses.
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90) {
      setGrid(null);
      setError("Enter a latitude between -90 and 90 to see the terrain.");
      return;
    }
    const key = lat + "," + lon;
    const hit = cache.get(key);
    if (hit) {
      setGrid(hit);
      setError(null);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      getTerrain(lat, lon, abort.signal)
        .then((g) => {
          cache.set(key, g);
          setGrid(g);
          setError(null);
        })
        .catch((e) => {
          if (abort.signal.aborted) return;
          setGrid(null);
          setError(e instanceof Error ? e.message : "Could not load terrain.");
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [lat, lon]);

  // A new site starts centred and zoomed out.
  useEffect(() => setBox(null), [grid]);

  const ao = useMemo(() => (grid ? occlusion(grid) : null), [grid]);
  const sunAz = sun?.az, sunEl = sun?.el;
  const image = useMemo(() => {
    if (!grid || !ao) return null;
    const known = sunAz !== undefined && sunEl !== undefined;
    const shade = relief(grid, known ? sunAz : undefined);
    const lit = known ? sunlight(grid, sunAz, sunEl) : null;
    const pixels = paint(shade, ao, lit);
    const offscreen = document.createElement("canvas");
    offscreen.width = offscreen.height = pixels.width;
    offscreen.getContext("2d")!.putImageData(pixels, 0, 0);
    return offscreen;
  }, [grid, ao, sunAz, sunEl]);

  // Follow the panel's size. The canvas fills its stage, so its bitmap has to match the stage's
  // real width and height, or the browser stretches the map (BUG-009).
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = grid?.size ?? 1;
  const { width } = size;
  const height = size.height > 0 ? size.height : Math.round((width * 9) / 16);
  const view = box ?? startView(n, width, height);

  // Draw.
  useEffect(() => {
    const el = canvas.current;
    if (!el || width === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.round(width * dpr);
    el.height = Math.round(height * dpr);
    const ctx = el.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    if (!grid || !image) return;

    const scale = (Math.min(width, height) / n) * view.zoom; // screen pixels per cell
    const toScreen = (col: number, row: number) => [
      width / 2 + (col - view.x) * scale,
      height / 2 + (row - view.y) * scale,
    ];
    const [left, top] = toScreen(-0.5, -0.5);
    // The image is already upsampled and smoothly interpolated; keep smoothing on at every zoom so
    // no grid cells show as blocks.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, left, top, n * scale, n * scale);

    // Soft vignette, so the edges of the map recede and the site stays the focus.
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.35,
      width / 2, height / 2, Math.hypot(width, height) / 2,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Text with a dark halo, so it reads on bright and dark ground alike.
    const haloText = (text: string, x: number, y: number) => {
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(text, x, y);
      ctx.fillStyle = TEXT;
      ctx.fillText(text, x, y);
    };

    // Arrows from the site toward the Sun and the Earth, ending at the edge of the view.
    const centre = (n - 1) / 2;
    const [sx, sy] = toScreen(centre, centre);
    const arrow = (body: SkyPosition, colour: string, label: string) => {
      const dx = Math.sin((body.az * Math.PI) / 180);
      const dy = -Math.cos((body.az * Math.PI) / 180);
      // Distance to the canvas edge along the arrow, less a margin for the disc and label.
      const reach = Math.min(
        dx > 0 ? (width - 28 - sx) / dx : dx < 0 ? (28 - sx) / dx : Infinity,
        dy > 0 ? (height - 28 - sy) / dy : dy < 0 ? (28 - sy) / dy : Infinity,
      );
      if (!(reach > 20)) return; // the site is scrolled out of view in that direction
      const ex = sx + dx * reach, ey = sy + dy * reach;
      const below = body.el < 0;
      ctx.setLineDash(below ? [4, 4] : []);
      // A dark underlay, then the coloured ray with a soft glow.
      ctx.beginPath();
      ctx.moveTo(sx + dx * 10, sy + dy * 10);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = colour;
      ctx.shadowBlur = below ? 0 : 8;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(ex, ey, 7, 0, 2 * Math.PI);
      if (below) {
        ctx.fillStyle = BG;
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.shadowBlur = 14;
        ctx.fillStyle = colour;
        ctx.fill();
      }
      ctx.restore();
      // Label beside the disc, kept fully inside the canvas.
      const text = `${label} ${body.az.toFixed(0)}°, ${body.el >= 0 ? "+" : ""}${body.el.toFixed(1)}°`;
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(text).width;
      let lx = dx > 0.3 ? ex - 14 - tw : dx < -0.3 ? ex + 14 : ex - tw / 2;
      let ly = dy > 0.3 ? ey - 16 : dy < -0.3 ? ey + 16 : ey + (dx === 0 ? 16 : 0);
      lx = Math.min(width - 6 - tw, Math.max(6, lx));
      ly = Math.min(height - 10, Math.max(10, ly));
      haloText(text, lx, ly);
    };
    if (earth) arrow(earth, EARTH, "Earth");
    if (sun) arrow(sun, SUN, "Sun");

    // Site marker.
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = TEXT;
    ctx.lineWidth = 2;
    ctx.stroke();

    // North arrow (north is always up).
    ctx.fillStyle = TEXT;
    ctx.beginPath();
    ctx.moveTo(18, 12);
    ctx.lineTo(13, 26);
    ctx.lineTo(23, 26);
    ctx.closePath();
    ctx.fill();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    haloText("N", 18, 29);

    // Scale bar: a round number of km close to a fifth of the width.
    const metresPerPixel = grid.spacingM / scale;
    const target = (width / 5) * metresPerPixel;
    const nice = [100, 200, 500, 1000, 2000, 5000, 10000, 20000].reduce((a, b) =>
      Math.abs(b - target) < Math.abs(a - target) ? b : a,
    );
    const bar = nice / metresPerPixel;
    ctx.fillStyle = TEXT;
    ctx.fillRect(12, height - 16, bar, 3);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    haloText(nice >= 1000 ? nice / 1000 + " km" : nice + " m", 12, height - 20);
  }, [grid, image, width, height, view.zoom, view.x, view.y, n, sun, earth]);

  // Wheel zooms about the pointer. Added by hand because React's wheel listener is passive.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !grid) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      setBox((b) => {
        const v = b ?? startView(n, rect.width, rect.height);
        const zoom = Math.min(16, Math.max(1, v.zoom * Math.exp(-e.deltaY * 0.0015)));
        const scale = Math.min(rect.width, rect.height) / n;
        const px = e.clientX - rect.left - rect.width / 2, py = e.clientY - rect.top - rect.height / 2;
        // Keep the cell under the pointer where it is.
        const col = v.x + px / (scale * v.zoom), row = v.y + py / (scale * v.zoom);
        return clamp({ zoom, x: col - px / (scale * zoom), y: row - py / (scale * zoom) }, n);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [grid, n]);

  const drag = useRef<{ x: number; y: number } | null>(null);
  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = (Math.min(rect.width, rect.height) / n) * view.zoom;
    return {
      col: view.x + (e.clientX - rect.left - rect.width / 2) / scale,
      row: view.y + (e.clientY - rect.top - rect.height / 2) / scale,
      scale,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const at = cellAt(e);
    if (drag.current) {
      const dx = (e.clientX - drag.current.x) / at.scale, dy = (e.clientY - drag.current.y) / at.scale;
      drag.current = { x: e.clientX, y: e.clientY };
      setBox(clamp({ ...view, x: view.x - dx, y: view.y - dy }, n));
    }
    setHover({ col: at.col, row: at.row });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // What is under the pointer: distance and direction from the site, and the height.
  let readout: string | null = null;
  if (grid && hover) {
    const c = Math.round(hover.col), r = Math.round(hover.row);
    if (c >= 0 && c < n && r >= 0 && r < n) {
      const centre = (n - 1) / 2;
      const east = (c - centre) * grid.spacingM, north = (centre - r) * grid.spacingM;
      const distance = Math.hypot(east, north) / 1000;
      const bearing = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
      readout = `${distance.toFixed(1)} km at ${bearing.toFixed(0)}° · height ${grid.heights[r * n + c]} m`;
    }
  }

  return (
    <>
      <div className="terrain-stage">
        <canvas
          ref={canvas}
          className="terrain-map"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
          onDoubleClick={() => setBox(null)}
        />
        {!grid && !error && <div className="terrain-note">Loading terrain…</div>}
        {error && <div className="terrain-note">{error}</div>}
        {readout && <div className="terrain-readout">{readout}</div>}
      </div>
      <div className="actions">{viewButtons}</div>
      <p className="muted terrain-hint">
        Drag to pan, scroll to zoom, double-click to reset. Darker ground is out of the Sun.
        {grid && ` 24 km square, heights every ${grid.spacingM} m from the ${grid.sourceM < 100 ? "20 m polar" : "474 m global"} map.`}
        {grid && grid.sourceM >= 100 && " Coarse here, so small craters won't show."}
        {(!sun || !earth) && " Press Analyze to see the Sun, the Earth and the shadows."}
      </p>
    </>
  );
}

// Opening view: centred on the site and zoomed so the square map covers the whole stage, with no
// black bars at the sides. Zooming out (to zoom 1) still shows the whole 24 km square.
function startView(n: number, width: number, height: number): ViewBox {
  const zoom = width > 0 && height > 0 ? Math.max(width, height) / Math.min(width, height) : 1;
  return { zoom, x: (n - 1) / 2, y: (n - 1) / 2 };
}

// Keep at least part of the grid on screen.
function clamp(v: ViewBox, n: number): ViewBox {
  return { zoom: v.zoom, x: Math.min(n - 1, Math.max(0, v.x)), y: Math.min(n - 1, Math.max(0, v.y)) };
}
