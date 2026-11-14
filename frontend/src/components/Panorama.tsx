// Placeholder for the 360° horizon panorama (skyline + Sun/Earth tracks).
export default function Panorama({ timeIndex }: { timeIndex: number }) {
  return (
    <section className="panel">
      <h2>Horizon panorama</h2>
      <div className="placeholder tall">
        <span>Terrain skyline 0–360° azimuth · Sun & Earth tracks</span>
        <span className="muted">Scrubber position: {timeIndex}</span>
      </div>
      <div className="axis">
        {["N", "E", "S", "W", "N"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </section>
  );
}
