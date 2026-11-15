import type { Analysis } from "./types";

// What a rover parked at the analysed site is getting at one time step. It only reads the
// analysis (the same power and battery model as the time series) and works out no sunlight
// of its own, so it cannot disagree with the charts. Shared by the classic card
// (components/RoverStatus.tsx) and the board's card (board/RoverPanel.tsx).

export type RoverKind = "charging" | "full" | "battery" | "empty";

export interface RoverNow {
  kind: RoverKind;
  state: string;            // the status word
  hint: string;             // what happens next, e.g. "shadow in 13.0 days"
  sun: number;              // share of the Sun's disc in view, 0 to 1
  power: number;            // W
  battery: number;          // Wh
  capacity: number;         // Wh: the highest level in the window (the response has no capacity field)
  link: Analysis["comms"][number];
}

const span = (hours: number) => (hours < 48 ? Math.round(hours) + " h" : (hours / 24).toFixed(1) + " days");

export const roverCapacity = (analysis: Analysis) => Math.max(1, ...analysis.batteryWh);

export function roverAt(analysis: Analysis, index: number, capacity: number): RoverNow {
  const sun = analysis.sun.fraction[index];
  const power = analysis.powerW[index];
  const battery = analysis.batteryWh[index];
  const before = analysis.batteryWh[Math.max(0, index - 1)];

  // The next step at which a condition holds, as a time from now.
  const until = (test: (i: number) => boolean) => {
    for (let i = index + 1; i < analysis.times.length; i++) if (test(i)) return span((i - index) * analysis.stepHours);
    return null;
  };

  let kind: RoverKind, state: string, hint: string;
  if (battery <= 0.5) {
    const back = until((i) => analysis.sun.fraction[i] > 0);
    kind = "empty";
    state = "BATTERY EMPTY";
    hint = back ? "Sun returns in " + back : "no Sun before the window ends";
  } else if (power > 0 && battery >= before) {
    const dark = until((i) => analysis.sun.fraction[i] <= 0);
    kind = battery >= capacity - 0.5 ? "full" : "charging";
    state = kind === "full" ? "IN SUN, FULL" : "CHARGING";
    hint = dark ? "shadow in " + dark : "in Sun to the end of the window";
  } else {
    // Whichever comes first: the battery running out, or the Sun coming back to recharge it.
    let next = index + 1;
    while (next < analysis.times.length && analysis.batteryWh[next] > 0.5 && analysis.sun.fraction[next] <= 0) next++;
    const wait = span((next - index) * analysis.stepHours);
    kind = "battery";
    state = "ON BATTERY";
    hint = next >= analysis.times.length ? "lasts to the end of the window"
      : analysis.batteryWh[next] <= 0.5 ? "empty in " + wait : "Sun returns in " + wait;
  }
  return { kind, state, hint, sun, power, battery, capacity, link: analysis.comms[index] };
}

// The Sun's disc as words: hidden, a sliver, or a percentage.
export const sunShare = (sun: number) => (sun <= 0 ? "hidden" : sun < 0.005 ? "under 1%" : Math.round(sun * 100) + "%");
