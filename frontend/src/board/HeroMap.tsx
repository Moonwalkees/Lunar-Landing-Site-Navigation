import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getTerrain } from "../api/client";
import { sunlight } from "../terrain2d";
import type { TerrainGrid } from "../types";
import { MOON_RADIUS_M, offsetM, pad2 } from "./data";
import { color } from "./palette";

// The hero: the real terrain around the selected site (GET /terrain, 24 km square) as a
// dot-matrix 3D map (doc/style.md > 3D map, Dot grid, Rendering rules).
// - The scene renders at 2-3 px per cell and is scaled up with a round-dot CSS mask.
// - Sunlight per cell comes from terrain2d.sunlight(), the same shadow code as the 2D map,
//   so the shadows are the real ones for the scrubbed Sun position.
// - Brightness is quantised to --space / --ash / --regolith with a 4x4 Bayer matrix.

export interface SkyPosition { az: number; el: number }

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lon: number;
  rank: number | null;
  score: number | null;
  dark: boolean; // in DARK·LOS right now: label is ghosted
}

interface Props {
  site: { lat: number; lon: number };
  selectedId: string;
  pins: MapPin[];
  sun: SkyPosition | null; // as seen from `site`, null until its analysis is in
  earth: SkyPosition | null;
  paused: boolean; // stop rendering while something covers the map (the Unity view)
  onSelect: (id: string) => void;
  onOpen3D: () => void;
  onTerrain: (grid: TerrainGrid | null) => void;
  children?: ReactNode; // HUD overlays
}

const S = 10; // scene units across the grid
const RAD = Math.PI / 180;

const VERT = `
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() { vUv = uv; vN = normal; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D uLit; uniform float uHasSun, uN, uS; uniform vec3 uL, cSpace, cAsh, cReg;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
float b2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float b4(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
void main() {
  vec3 n = normalize(vN);
  float relief = clamp(dot(n, normalize(vec3(-0.5, 0.7071, -0.5))), 0.0, 1.0); // fixed light from the north-west
  float b;
  if (uHasSun > 0.5) {
    float lit = texture2D(uLit, (vUv * (uN - 1.0) + 0.5) / uN).r;
    float face = clamp(dot(n, uL) * 6.0, 0.0, 1.0);
    b = lit * (0.40 + 0.60 * face) + (1.0 - lit) * 0.10 * relief;
  } else {
    b = 0.08 + 0.62 * relief;
  }
  b *= 1.0 - smoothstep(0.80, 1.0, length(vP.xz) / (uS * 0.5)); // the edge dissolves into black
  float L = b * 2.0;
  float t = min(floor(L) + step(b4(gl_FragCoord.xy), fract(L)), 2.0);
  gl_FragColor = vec4(t < 0.5 ? cSpace : (t < 1.5 ? cAsh : cReg), 1.0);
}`;

const rgb = (name: string) => new THREE.Color(color(name));
const vec = (name: string) => { const c = rgb(name); return new THREE.Vector3(c.r, c.g, c.b); };
// Direction toward a body in scene axes: x east, y up, -z north.
const skyDir = (p: SkyPosition) =>
  new THREE.Vector3(Math.sin(p.az * RAD) * Math.cos(p.el * RAD), Math.sin(p.el * RAD), -Math.cos(p.az * RAD) * Math.cos(p.el * RAD));

interface Engine {
  setGrid(grid: TerrainGrid): void;
  setSky(sun: SkyPosition | null, earth: SkyPosition | null): void;
  setPins(pins: MapPin[], selectedId: string): void;
  fly(dist: number): void;
  setPaused(p: boolean): void;
  dispose(): void;
}

function createEngine(
  hero: HTMLElement,
  canvas: HTMLCanvasElement,
  labelLayer: HTMLElement,
  cb: { select: (id: string) => void; open: () => void },
): Engine {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setClearColor(rgb("--space"), 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 400);
  camera.position.set(0, 5.6, 8.8);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.42, minDistance: 2.2, maxDistance: 15, rotateSpeed: 0.7, enablePan: false });

  const uniforms = {
    uLit: { value: null as THREE.DataTexture | null },
    uHasSun: { value: 0 },
    uN: { value: 2 },
    uS: { value: S },
    uL: { value: new THREE.Vector3(0, 1, 0) },
    cSpace: { value: vec("--space") },
    cAsh: { value: vec("--ash") },
    cReg: { value: vec("--regolith") },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
  let mesh: THREE.Mesh | null = null;
  let grid: TerrainGrid | null = null;
  let litData: Uint8Array<ArrayBuffer> | null = null;
  let mPerUnit = 1, h0 = 0;

  // Solid, never dithered (doc/style.md > Colour).
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: rgb("--sun") }));
  const earthDisc = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshBasicMaterial({ color: rgb("--earth") }));
  sunDisc.visible = earthDisc.visible = false;
  scene.add(sunDisc, earthDisc);

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 24), new THREE.MeshBasicMaterial({ color: rgb("--selected"), side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  // Terrain height (scene units) at a scene x / z, nearest cell.
  const groundY = (x: number, z: number) => {
    if (!grid || !mesh) return 0;
    const n = grid.size, pos = (mesh.geometry as THREE.BufferGeometry).attributes.position;
    const j = Math.round((x / S + 0.5) * (n - 1)), i = Math.round((z / S + 0.5) * (n - 1));
    return pos.getY(Math.min(n - 1, Math.max(0, i)) * n + Math.min(n - 1, Math.max(0, j)));
  };

  // ---- pins ----
  interface PinObj { id: string; group: THREE.Group; mat: THREE.MeshBasicMaterial; top: number; label: HTMLDivElement }
  let pinObjs: PinObj[] = [];
  let lastPins: { pins: MapPin[]; selectedId: string } | null = null;

  function buildPins() {
    for (const p of pinObjs) { scene.remove(p.group); p.label.remove(); }
    pinObjs = [];
    if (!grid || !lastPins) return;
    const half = ((grid.size - 1) / 2) * grid.spacingM;
    const cPin = rgb("--sun"), cSel = rgb("--selected");
    for (const pin of lastPins.pins) {
      const { east, north } = offsetM(grid, pin);
      if (Math.abs(east) > half * 0.92 || Math.abs(north) > half * 0.92) continue; // off this map
      const sel = pin.id === lastPins.selectedId;
      const x = east / mPerUnit, z = -north / mPerUnit;
      const total = 0.8 + ((pin.score ?? 0) / 100) * 2.2; // stem height is the score
      const mat = new THREE.MeshBasicMaterial({ color: sel ? cSel : cPin });
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.07, total, 0.07), mat);
      stem.position.y = total / 2;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat);
      head.position.y = total + 0.22;
      g.add(stem, head);
      g.position.set(x, groundY(x, z), z);
      scene.add(g);
      if (sel) { ring.position.set(x, groundY(x, z) + 0.05, z); ring.visible = true; }
      const label = document.createElement("div");
      const rank = pin.rank === null ? "--" : pad2(pin.rank);
      label.className = "pinlbl" + (sel ? " sel" : pin.dark ? " dim" : "");
      label.textContent = sel ? `${rank} ${pin.name.toUpperCase()}` : rank;
      labelLayer.appendChild(label);
      pinObjs.push({ id: pin.id, group: g, mat, top: total + 0.6, label });
    }
  }

  // ---- camera ----
  let tween: { t0: number; d: number; ft: THREE.Vector3; fp: THREE.Vector3; tt: THREE.Vector3; tp: THREE.Vector3 } | null = null;
  function fly(dist: number) {
    const sel = pinObjs.find((p) => p.id === lastPins?.selectedId);
    const tt = sel ? sel.group.position.clone().setY(sel.group.position.y + 0.6) : new THREE.Vector3(0, groundY(0, 0) + 0.6, 0);
    const tp = tt.clone().add(camera.position.clone().sub(controls.target).normalize().multiplyScalar(dist));
    if (reduce) { controls.target.copy(tt); camera.position.copy(tp); tween = null; return; }
    tween = { t0: performance.now(), d: 900, ft: controls.target.clone(), fp: camera.position.clone(), tt, tp };
  }

  // ---- sizing: low-res render, scaled up with the dot mask ----
  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h) return;
    const cell = w > 900 ? 2 : 3;
    const cols = Math.floor(w / cell), rows = Math.floor(h / cell);
    renderer.setSize(cols, rows, false);
    camera.aspect = cols / rows;
    camera.updateProjectionMatrix();
    canvas.style.width = cols * cell + "px";
    canvas.style.height = rows * cell + "px";
    canvas.style.setProperty("--cell", cell + "px");
  }
  const observer = new ResizeObserver(resize);
  observer.observe(hero);
  resize();

  // ---- tap a pin ----
  // Picked in screen space: each pin is the on-screen segment from its foot to its label anchor,
  // plus its label box, and the closest one within PICK_PX of the tap wins. (A 3D raycast against
  // big invisible hit spheres picked whichever sphere was nearest the camera, so close-together
  // pins stole each other's taps - BUG-008.)
  const PICK_PX = 20;
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  function pickPin(clientX: number, clientY: number): string | null {
    const r = canvas.getBoundingClientRect();
    const toPx = (v: THREE.Vector3) => { v.project(camera); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, front: v.z < 1 }; };
    let best: string | null = null, bestD = PICK_PX;
    for (const p of pinObjs) {
      if (p.label.style.display !== "none") {
        const lb = p.label.getBoundingClientRect();
        if (clientX >= lb.left && clientX <= lb.right && clientY >= lb.top && clientY <= lb.bottom) return p.id;
      }
      const a = toPx(pa.copy(p.group.position));
      const b = toPx(pb.copy(p.group.position).setY(p.group.position.y + p.top));
      if (!a.front || !b.front) continue;
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((clientX - a.x) * dx + (clientY - a.y) * dy) / len2));
      const d = Math.hypot(clientX - (a.x + t * dx), clientY - (a.y + t * dy));
      if (d < bestD) { bestD = d; best = p.id; }
    }
    return best;
  }
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 8 || dt > 500) return;
    const id = pickPin(e.clientX, e.clientY);
    if (!id) return;
    if (id === lastPins?.selectedId) cb.open(); // tapping the selected pin drills into it
    else cb.select(id);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  // ---- sunlight, recomputed at most once a frame ----
  let pendingSun: SkyPosition | null | undefined;
  function applySun() {
    if (pendingSun === undefined || !grid || !litData || !uniforms.uLit.value) return;
    const sun = pendingSun;
    pendingSun = undefined;
    if (!sun) { uniforms.uHasSun.value = 0; return; }
    const lit = sunlight(grid, sun.az, sun.el), n = grid.size;
    // Grid row 0 is north; texture row 0 is v = 0, the south edge of the plane.
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) litData[(n - 1 - i) * n + j] = Math.round(lit[i * n + j] * 255);
    uniforms.uLit.value.needsUpdate = true;
    uniforms.uL.value.copy(skyDir(sun));
    uniforms.uHasSun.value = 1;
  }

  const tmp = new THREE.Vector3();
  let raf = 0, paused = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (paused) return;
    applySun();
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.d), e = 1 - Math.pow(1 - k, 3);
      controls.target.lerpVectors(tween.ft, tween.tt, e);
      camera.position.lerpVectors(tween.fp, tween.tp, e);
      if (k >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    const w = hero.clientWidth, h = hero.clientHeight;
    for (const p of pinObjs) {
      tmp.copy(p.group.position);
      tmp.y += p.top;
      tmp.project(camera);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      p.label.style.display = vis ? "" : "none";
      if (vis) p.label.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    }
  };
  raf = requestAnimationFrame(frame);

  let lastSky: { sun: SkyPosition | null; earth: SkyPosition | null } = { sun: null, earth: null };

  return {
    setGrid(g) {
      grid = g;
      const n = g.size, c = (n - 1) / 2;
      mPerUnit = ((n - 1) * g.spacingM) / S;
      h0 = g.heights[Math.round(c) * n + Math.round(c)];
      const geo = new THREE.PlaneGeometry(S, S, n - 1, n - 1);
      geo.rotateX(-Math.PI / 2); // row 0 of the plane becomes -z, north
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const i = Math.floor(k / n), j = k % n;
        const dx = (j - c) * g.spacingM, dy = (i - c) * g.spacingM;
        const drop = (dx * dx + dy * dy) / (2 * MOON_RADIUS_M); // true scale, with the Moon's curvature
        pos.setY(k, (g.heights[k] - h0 - drop) / mPerUnit);
      }
      geo.computeVertexNormals();
      if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
      mesh = new THREE.Mesh(geo, material);
      scene.add(mesh);
      uniforms.uLit.value?.dispose();
      litData = new Uint8Array(n * n);
      const tex = new THREE.DataTexture(litData, n, n, THREE.RedFormat, THREE.UnsignedByteType);
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      uniforms.uLit.value = tex;
      uniforms.uN.value = n;
      uniforms.uHasSun.value = 0;
      pendingSun = lastSky.sun;
      buildPins();
      fly(7.5);
    },
    setSky(sun, earth) {
      lastSky = { sun, earth };
      pendingSun = sun;
      sunDisc.visible = !!sun && sun.el > -2;
      if (sun) sunDisc.position.copy(skyDir(sun).multiplyScalar(60));
      earthDisc.visible = !!earth && earth.el > -2;
      if (earth) earthDisc.position.copy(skyDir(earth).multiplyScalar(60));
    },
    setPins(pins, selectedId) {
      lastPins = { pins, selectedId };
      buildPins();
    },
    fly,
    setPaused(p) { paused = p; },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      for (const p of pinObjs) p.label.remove();
      controls.dispose();
      renderer.dispose();
    },
  };
}

export default function HeroMap({ site, selectedId, pins, sun, earth, paused, onSelect, onOpen3D, onTerrain, children }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [terrain, setTerrain] = useState<{ status: "loading" | "ready" | "error"; key: string; error?: string }>({ status: "loading", key: "" });
  const cb = useRef({ select: onSelect, open: onOpen3D, terrain: onTerrain });
  cb.current = { select: onSelect, open: onOpen3D, terrain: onTerrain };

  useEffect(() => {
    try {
      engine.current = createEngine(heroRef.current!, canvasRef.current!, labelsRef.current!, {
        select: (id) => cb.current.select(id),
        open: () => cb.current.open(),
      });
    } catch (e) {
      console.error("The map could not start:", e);
      setTerrain({ status: "error", key: "", error: "NO WEBGL" });
    }
    return () => { engine.current?.dispose(); engine.current = null; };
  }, []);

  // Load the terrain whenever the selected site moves.
  const key = site.lat + "|" + site.lon;
  useEffect(() => {
    const abort = new AbortController();
    setTerrain({ status: "loading", key });
    getTerrain(site.lat, site.lon, abort.signal)
      .then((grid) => {
        engine.current?.setGrid(grid);
        cb.current.terrain(grid);
        setTerrain({ status: "ready", key });
      })
      .catch((e) => {
        if (abort.signal.aborted) return;
        cb.current.terrain(null);
        setTerrain({ status: "error", key, error: e instanceof Error ? e.message : "Terrain failed." });
      });
    return () => abort.abort();
  }, [key]);

  // Only apply sky angles once the terrain under them is the selected site's.
  const ready = terrain.status === "ready" && terrain.key === key;
  const sunAz = sun?.az, sunEl = sun?.el, earthAz = earth?.az, earthEl = earth?.el;
  useEffect(() => {
    engine.current?.setSky(
      ready && sunAz !== undefined && sunEl !== undefined ? { az: sunAz, el: sunEl } : null,
      ready && earthAz !== undefined && earthEl !== undefined ? { az: earthAz, el: earthEl } : null,
    );
  }, [ready, sunAz, sunEl, earthAz, earthEl]);

  const pinsKey = JSON.stringify(pins) + selectedId;
  useEffect(() => { if (ready) engine.current?.setPins(pins, selectedId); }, [ready, pinsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { engine.current?.setPaused(paused); }, [paused]);

  return (
    <section className="hero" ref={heroRef} aria-label="3D terrain map of the selected site. Drag to orbit, pinch or scroll to zoom, tap a pin to select it, tap the selected pin for the full 3D view.">
      <canvas id="map" ref={canvasRef} />
      <div className="labels" ref={labelsRef} />
      {terrain.status !== "ready" && (
        <div className="hud map-note mono" role="status">
          {terrain.status === "loading" ? "ACQUIRING TERRAIN…" : "NO TERRAIN · " + terrain.error}
        </div>
      )}
      {children}
    </section>
  );
}
