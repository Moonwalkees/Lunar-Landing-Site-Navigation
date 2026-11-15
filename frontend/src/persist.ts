// Remembers the user's setup in this browser (localStorage), so a reload, or the board/classic
// switch (which reloads the page), keeps it. Nothing leaves the browser.
//
// Whatever comes back from storage is untrusted: old versions, hand edits and other tabs can all
// leave anything there. Every field is checked, and a bad one is dropped, never thrown on.
// Storage can also be unavailable (private window, site data off); then nothing is saved and the app
// runs as it did before.
import type { BoardSite, MissionWindow, SortKey } from "./board/data";
import { ROVER_RULES, type RoverSpec } from "./rovers";
import type { SiteInput } from "./types";

const BOARD_KEY = "lunar-board-v1";
const CLASSIC_KEY = "lunar-classic-v1";

function read(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    return isObject(value) ? value : null;
  } catch {
    return null; // blocked storage, or JSON that is not JSON
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Can't save (blocked, or full); the app still works for this visit.
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

// The same limits the forms and the backend enforce.
const validLat = (v: unknown): v is number => finite(v) && v >= -90 && v <= 90;
const validLon = (v: unknown): v is number => finite(v) && v >= -360 && v <= 360;

function parseRover(v: unknown): RoverSpec | null {
  if (!isObject(v) || !text(v.name, 40)) return null;
  const { solarW, batteryWh, loadW } = v;
  if (!finite(solarW) || !ROVER_RULES.solarW.ok(solarW)) return null;
  if (!finite(batteryWh) || !ROVER_RULES.batteryWh.ok(batteryWh)) return null;
  if (!finite(loadW) || !ROVER_RULES.loadW.ok(loadW)) return null;
  return { name: v.name, solarW, batteryWh, loadW };
}

function parseWindow(v: unknown): MissionWindow | null {
  if (!isObject(v)) return null;
  const rover = parseRover(v.rover);
  if (!rover) return null;
  if (typeof v.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.startDate)) return null;
  if (!finite(v.days) || !(v.days > 0 && v.days <= 400)) return null;
  if (!finite(v.stepHours) || !(v.stepHours > 0 && v.stepHours <= 24)) return null;
  return { startDate: v.startDate, days: v.days, stepHours: v.stepHours, rover };
}

// ---------- the board ----------

export interface SavedBoard {
  customs: BoardSite[]; // the user's own sites
  hidden: string[]; // ids of the presets the user deleted
  win?: MissionWindow; // only when the user ran their own window
  selectedId?: string; // only when the user picked a site
  sortKey?: SortKey;
}

const SORT_KEYS: SortKey[] = ["score", "sun", "com", "both"];

export function loadBoard(): SavedBoard {
  const raw = read(BOARD_KEY);
  const saved: SavedBoard = { customs: [], hidden: [] };
  if (!raw) return saved;

  if (Array.isArray(raw.customs)) {
    const ids = new Set<string>();
    for (const c of raw.customs) {
      if (!isObject(c) || !text(c.id, 40) || !c.id.startsWith("c:") || ids.has(c.id)) continue;
      if (!text(c.name, 80) || !validLat(c.lat) || !validLon(c.lon)) continue;
      ids.add(c.id);
      saved.customs.push({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, custom: true });
    }
  }
  if (Array.isArray(raw.hidden)) saved.hidden = raw.hidden.filter((h): h is string => text(h, 120) && h.startsWith("p:"));
  const win = parseWindow(raw.win);
  if (win) saved.win = win;
  if (text(raw.selectedId, 120)) saved.selectedId = raw.selectedId;
  if (typeof raw.sortKey === "string" && (SORT_KEYS as string[]).includes(raw.sortKey)) saved.sortKey = raw.sortKey as SortKey;
  return saved;
}

export const saveBoard = (state: SavedBoard): void => write(BOARD_KEY, state);

// ---------- the classic form ----------

export function loadClassic(): SiteInput | null {
  const raw = read(CLASSIC_KEY);
  if (!raw) return null;
  const win = parseWindow(raw); // the form is a site plus the same window fields the board saves
  if (!win || !text(raw.name, 80) || !validLat(raw.lat) || !validLon(raw.lon)) return null;
  return { name: raw.name, lat: raw.lat, lon: raw.lon, ...win };
}

export const saveClassic = (site: SiteInput): void => write(CLASSIC_KEY, site);

// Forget everything this file saved (the RESET button), so the next load starts from the defaults.
export function clearSaved(): void {
  try {
    localStorage.removeItem(BOARD_KEY);
    localStorage.removeItem(CLASSIC_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}
