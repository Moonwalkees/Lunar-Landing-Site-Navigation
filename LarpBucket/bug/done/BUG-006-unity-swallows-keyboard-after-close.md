# BUG-006 Text boxes stop taking input after the surface view is closed mid-load

Status: done
Owner: Maddie
Severity: high
Affects: board frontend: Add custom site and Mission window inputs (any text field)
Note: done. Capture-phase key guard (`frontend/src/keyGuard.ts`, installed first thing in `main.tsx`) keeps keys typed into text fields away from Unity.

## Summary
After opening SURFACE VIEW and closing it before Unity finishes loading, no text box on the page accepts typing.

## Description
1. Click SURFACE VIEW.
2. Close it (CLOSE or Escape) within a few seconds, while the Unity build is still loading.
3. Open + ADD SITE and click into Lat.

The field takes focus (white border), but nothing you type appears. The page stays this way until it is reloaded. Typing is also blocked while the Unity view is open.

Reproduced in headless Chrome with real key events: closing after 300 ms, 1.5 s and 4 s all left the inputs dead. Closing after Unity had fully loaded did not.

## Intended behaviour
Text fields always accept typing. Unity only receives keys aimed at its own canvas.

## Where it happens
Every `<input>` on the board, for example `AddSite` and `Mission` in `frontend/src/board/Panels.tsx`.

## Cause
The Unity WebGL build captures keyboard input for the whole page (`WebGLInput.captureAllKeyboardInput`, on by default). Its key handler calls `preventDefault()`, so characters never reach the input. If the view is closed mid-load, `TerrainView3D` quits the instance as soon as it resolves, but the page-wide key listeners survive that early `Quit()`.

## File
`frontend/src/components/TerrainView3D.tsx:42` (Unity loader)

## Solution
**Chosen:** `guardTextInput()` in `frontend/src/keyGuard.ts`, called first thing in `frontend/src/main.tsx` (and again, as a no-op, from `loadUnityLoader()` in `TerrainView3D.tsx`). It is in place before Unity registers anything. A first version only installed it when the 3D view loaded, which could leave it behind Unity's own listeners after a hot reload. It adds capture-phase `keydown` / `keypress` / `keyup` listeners on `window`. When the event target is an input, textarea, select or contenteditable element, it calls `stopImmediatePropagation()`. Unity's handlers never see those keys, and the browser's default text entry still happens. Verified in headless Chrome with real mouse clicks and key events on every Add custom site and Mission window field: typing works on a fresh page, after closing the 3D view mid-load, and after closing it once loaded. A page already in the broken state needs one reload.

**Strengths**
- Works whether or not Unity's listeners are ever cleaned up, and in both the board and classic UIs (both use `TerrainView3D`).
- No rebuild of the Unity project is needed. Its source isn't in this repo.

**Limitations**
- Other page-level key handlers (for example React `onKeyDown` on an input) no longer see keys typed into text fields. No such handlers exist today.
- Unity's leftover listeners still exist after an early close. They are only kept away from text fields.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| Set `WebGLInput.captureAllKeyboardInput = false` in the Unity project | Unity source isn't in this repo; needs a Unity rebuild | Cleaner: fixes it at the source |
| Wait for Unity to finish loading before quitting | Still leaks if `Quit()` doesn't remove the listeners, and closing would be slow | No extra listener |
