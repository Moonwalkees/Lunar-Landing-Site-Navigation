// Which of the two frontends to show: the dot-matrix board (src/board/) or the classic UI (App.tsx).
// Order: ?ui=board|classic in the URL, then the user's remembered choice, then VITE_UI, then board.
// Each UI brings its own global CSS, so switching saves the choice and reloads the page.
export type Ui = "board" | "classic";

const KEY = "lunar-ui";
const valid = (v: string | null | undefined): Ui | null => (v === "board" || v === "classic" ? v : null);

export function currentUi(): Ui {
  const fromUrl = valid(new URLSearchParams(location.search).get("ui"));
  if (fromUrl) return fromUrl;
  try {
    const saved = valid(localStorage.getItem(KEY));
    if (saved) return saved;
  } catch {
    // Storage blocked (private window, site data off): fall through to the build default.
  }
  return valid(import.meta.env.VITE_UI) ?? "board";
}

export function switchUi(ui: Ui) {
  try {
    localStorage.setItem(KEY, ui);
  } catch {
    // Can't remember it; the ?ui= link below still carries the choice for this visit.
  }
  const url = new URL(location.href);
  url.searchParams.set("ui", ui);
  location.assign(url.toString());
}
