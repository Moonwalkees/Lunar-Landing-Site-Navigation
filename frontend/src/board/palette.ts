// Colour tokens from doc/style.md > Colour. board.css defines the same values on :root;
// canvas and WebGL code read them from there, falling back to these if the stylesheet isn't in yet.
const TOKENS: Record<string, string> = {
  "--space": "#000000",
  "--umbra": "#1B2230",
  "--regolith": "#D9D6CF",
  "--ash": "#8C867A",
  "--ash-dim": "#3A3832",
  "--sun": "#FFB43B",
  "--earth": "#2FB5C4",
  "--ok": "#7BD66B",
  "--selected": "#FF5A36",
};

export function color(name: string): string {
  const css = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return css || TOKENS[name] || "#ff00ff";
}
