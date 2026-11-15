/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // Which frontend to build: "board" (default) or "classic". See main.tsx.
  readonly VITE_UI?: "board" | "classic";
}
