import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BoardApp from "./BoardApp";
import "./board.css";

// The dot-matrix board UI (doc/style.md), the app's only frontend (see main.tsx).
export function mount(root: HTMLElement) {
  document.title = "Moonwalker's Wiki";
  // Doto wght 100-900 and Geist Mono 400/500 (doc/style.md > Type).
  for (const [rel, href, cross] of [
    ["preconnect", "https://fonts.googleapis.com", false],
    ["preconnect", "https://fonts.gstatic.com", true],
    ["stylesheet", "https://fonts.googleapis.com/css2?family=Doto:wght@100..900&family=Geist+Mono:wght@400;500&display=swap", false],
  ] as const) {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    if (cross) link.crossOrigin = "";
    document.head.appendChild(link);
  }
  createRoot(root).render(
    <StrictMode>
      <BoardApp />
    </StrictMode>,
  );
}
