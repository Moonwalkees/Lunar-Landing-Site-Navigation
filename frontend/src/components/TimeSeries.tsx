interface Props {
  timeIndex: number;
  maxIndex: number;
  onScrub: (i: number) => void;
}

// Placeholder for power / battery / comms over the window, linked to the panorama by the scrubber.
export default function TimeSeries({ timeIndex, maxIndex, onScrub }: Props) {
  return (
    <section className="panel">
      <h2>Time series</h2>
      {["Power (W)", "Battery (Wh)", "Comms state"].map((name) => (
        <div className="placeholder row" key={name}>
          <span>{name}</span>
        </div>
      ))}
      <label className="scrubber">
        Time step {timeIndex} / {maxIndex}
        <input type="range" min={0} max={maxIndex} value={timeIndex}
          onChange={(e) => onScrub(Number(e.target.value))} />
      </label>
    </section>
  );
}
