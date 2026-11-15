import { useEffect, useRef, useState } from "react";

export interface SiteActions {
  onGo: () => void; // select the site and bring the map into view
  onSurface: () => void; // open the detail (surface) view for it
  onDelete: (() => void) | null; // null when it can't be deleted (the last site left)
}

interface Props extends SiteActions {
  name: string;
}

// The ⋮ menu for one site on each board row. The map console shows the same actions as buttons.
// Clicks and keys inside it never reach the row underneath.
export default function SiteMenu({ name, onGo, onSurface, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // don't also close the detail view
      setOpen(false);
      btn.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", away); window.removeEventListener("keydown", key, true); };
  }, [open]);

  const run = (f: () => void) => () => { setOpen(false); f(); };

  return (
    <div className="smenu" ref={box} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        ref={btn}
        className="smenu-btn"
        aria-label={"More options for " + name}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >⋮</button>
      {open && (
        <div className="smenu-list" role="menu" aria-label={name}>
          <button role="menuitem" onClick={run(onGo)} autoFocus>GO TO SITE</button>
          <button role="menuitem" onClick={run(onSurface)}>SURFACE VIEW</button>
          <button role="menuitem" className="del" disabled={!onDelete} onClick={onDelete ? run(onDelete) : undefined}
            title={onDelete ? undefined : "The board needs at least one site"}>DELETE</button>
        </div>
      )}
    </div>
  );
}
