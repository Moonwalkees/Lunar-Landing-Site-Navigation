import { useEffect, useMemo, useRef, useState } from "react";
import type { Analysis, TerrainGrid } from "../types";
import type { BoardSite, MissionWindow } from "./data";
import { drawMissionCard } from "./drawCard";
import { samePlace, shareUrl } from "./share";

interface Props {
  site: BoardSite;
  analysis: Analysis | null;
  index: number; // the time step when the card was opened; the card keeps it while open
  win: MissionWindow;
  grid: TerrainGrid | null; // the hero map's terrain, used once it is the one for `site`
  onClose: () => void;
}

// The mission card overlay (ticket 8.1): the card as a picture, DOWNLOAD PNG, and the link the
// card's QR code opens, with COPY LINK.
export default function MissionCard({ site, analysis, index, win, grid, onClose }: Props) {
  const url = useMemo(() => shareUrl(site, win, index), [site, win, index]);
  const terrain = grid && samePlace(grid, site) ? grid : null;
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const made = useRef<string | null>(null);
  const linkBox = useRef<HTMLInputElement>(null);

  // Draw the card, and again once the terrain for this site comes in.
  useEffect(() => {
    if (!analysis) return;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    void drawMissionCard(canvas, { name: site.name, lat: site.lat, lon: site.lon, analysis, index, window: win, grid: terrain, url })
      .then(() => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")))
      .then((blob) => {
        if (cancelled || !blob) return;
        const next = URL.createObjectURL(blob);
        if (made.current) URL.revokeObjectURL(made.current);
        made.current = next;
        setPng(next);
      });
    return () => { cancelled = true; };
  }, [analysis, index, site, win, terrain, url]);
  useEffect(() => () => { if (made.current) URL.revokeObjectURL(made.current); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => linkBox.current?.select());
    else linkBox.current?.select();
  };
  const file = "mission-card-" + site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";

  return (
    <div className="mcard" role="dialog" aria-modal="true" aria-label={"Mission card for " + site.name} onClick={onClose}>
      <div className="mcard-box panel" onClick={(e) => e.stopPropagation()}>
        <span className="cap mono">Mission card · {site.name}</span>
        <div className="mcard-pic">
          {png ? <img src={png} alt={"Mission card for " + site.name} /> : <div className="mono">{analysis ? "Drawing…" : "Waiting for this site's analysis…"}</div>}
        </div>
        <label className="field mcard-link">
          <span className="mono">Link · opens this site, window, rover and time</span>
          <input ref={linkBox} readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
        <div className="mcard-btns">
          {png ? <a className="cbtn" href={png} download={file}>DOWNLOAD PNG</a> : <button className="cbtn" disabled>DOWNLOAD PNG</button>}
          <button className="cbtn" aria-pressed={copied} onClick={copy}>{copied ? "COPIED" : "COPY LINK"}</button>
          <button className="cbtn" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
