import type { Analysis, SiteInput } from "../types";

const BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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
