import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// The original UI. Chosen with the top-right switch, ?ui=classic or VITE_UI=classic (see main.tsx).
export function mount(root: HTMLElement) {
  document.title = "Lunar Landing Site Navigator";
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
