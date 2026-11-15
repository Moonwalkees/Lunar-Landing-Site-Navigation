// The frontend: the dot-matrix departure board (src/board/, doc/style.md). The original "classic"
// panel layout was removed (ticket 4.30); old ?ui=classic links simply open the board.
import { guardTextInput } from "./keyGuard";

// Before anything else, so the Unity 3D view can never swallow keys typed into a text box (BUG-006).
// The board is imported after it for the same reason.
guardTextInput();

import("./board").then((m) => m.mount(document.getElementById("root")!));
