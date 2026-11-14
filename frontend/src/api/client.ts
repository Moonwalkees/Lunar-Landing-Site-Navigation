import type { Analysis, Preset, SiteInput, TerrainGrid } from "../types";

const BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// The backend's preset sites. Throws if the backend is unreachable or answers badly.
export async function getSites(): Promise<Preset[]> {
  let response: Response;
  try {
    response = await fetch(BASE_URL + "/sites");
  } catch {
    throw new Error("Could not reach the backend at " + BASE_URL + ".");
  }
  if (!response.ok) throw new Error("The backend could not list sites (" + response.status + ").");
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error("The backend sent an unexpected site list.");
  return body.filter(
    (p): p is Preset =>
      typeof p?.name === "string" && Number.isFinite(p?.lat) && Number.isFinite(p?.lon),
  );
}

// Ask the backend for everything the panels need for one site and window.
export async function analyze(site: SiteInput): Promise<Analysis> {
  let response: Response;
  try {
    response = await fetch(BASE_URL + "/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: site.lat,
        lon: site.lon,
        startDate: site.startDate,
        days: site.days,
        stepHours: site.stepHours,
      }),
    });
  } catch {
    throw new Error("Could not reach the backend at " + BASE_URL + ".");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string" ? detail : "The backend could not analyze this site (" + response.status + ").",
    );
  }
  return response.json();
}

// The height grid the 2D terrain map draws (24 km square around the site, 100 m cells).
export async function getTerrain(lat: number, lon: number, signal?: AbortSignal): Promise<TerrainGrid> {
  let response: Response;
  try {
    response = await fetch(BASE_URL + "/terrain?lat=" + lat + "&lon=" + lon, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error("Could not reach the backend at " + BASE_URL + ".");
  }
  if (!response.ok) throw new Error("The backend could not load terrain for this site (" + response.status + ").");
  const body = await response.json();
  if (!Number.isInteger(body?.size) || !Array.isArray(body?.heights) || body.heights.length !== body.size * body.size) {
    throw new Error("The backend sent an unexpected terrain grid.");
  }
  return body;
}
