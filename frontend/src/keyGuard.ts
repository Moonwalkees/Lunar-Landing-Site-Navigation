// Keeps keys typed into text fields away from the Unity WebGL build (BUG-006).
//
// Unity captures the whole page's keyboard (WebGLInput.captureAllKeyboardInput) and calls
// preventDefault on every key, so text boxes stop taking input. Its listeners can also outlive
// the 3D view when it is closed mid-load. These capture-phase listeners are added at app start,
// before Unity can add anything, so they always run first: a key aimed at a text field stops
// here and the browser still types it. Keys aimed at the Unity canvas are untouched.
function isEditable(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
}

let installed = false;
export function guardTextInput() {
  if (installed) return;
  installed = true;
  const stop = (e: Event) => { if (isEditable(e.target)) e.stopImmediatePropagation(); };
  for (const type of ["keydown", "keypress", "keyup"]) window.addEventListener(type, stop, true);
}
