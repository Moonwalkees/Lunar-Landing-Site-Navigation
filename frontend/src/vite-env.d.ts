/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // Where mission card links point (board/share.ts); the hosted app when unset.
  readonly VITE_PUBLIC_URL?: string;
}
