// Two frontends share this entry:
//   "board":   the dot-matrix departure board (src/board/, doc/style.md)
//   "classic": the original panel layout (App.tsx, styles.css)
// currentUi() picks one at load time (?ui=, then the user's saved choice from the top-right
// switch, then VITE_UI). Each is its own chunk with its own CSS, so a page only loads one of them.
import { guardTextInput } from "./keyGuard";
import { currentUi } from "./uiChoice";

// Before anything else, so the Unity 3D view can never swallow keys typed into a text box (BUG-006).
guardTextInput();

const ui = currentUi();

const mount = ui === "classic" ? import("./classic") : import("./board");
mount.then((m) => m.mount(document.getElementById("root")!));
