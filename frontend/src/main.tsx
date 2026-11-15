// Two frontends share this entry. VITE_UI picks one at build time:
//   unset or "board": the dot-matrix departure board (src/board/, doc/style.md)
//   "classic":        the original panel layout (App.tsx, styles.css)
// Each is its own chunk with its own CSS, so a build only ever loads one of them.
import { guardTextInput } from "./keyGuard";

// Before anything else, so the Unity 3D view can never swallow keys typed into a text box (BUG-006).
guardTextInput();

const ui = import.meta.env.VITE_UI === "classic" ? "classic" : "board";

const mount = ui === "classic" ? import("./classic") : import("./board");
mount.then((m) => m.mount(document.getElementById("root")!));
