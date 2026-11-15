import type { Analysis } from "./types";

// Lunar eclipses in an analysis: seen from the Moon, the Earth passing in front of the Sun.
// The backend already gives, for every time step, the share of the Sun's disc the Earth covers
// (sun.behindEarth, ticket 6.1); this only finds the runs of steps where it is above zero.
// Shared by the board and the classic UI (ticket 7.4).

export interface Eclipse {
  start: number; // first time step with part of the Sun covered
  end: number; // last such step
  peak: number; // the step with the most covered
  covered: number; // the most covered, 0 to 1
}

export function eclipses(a: Analysis): Eclipse[] {
  const b = a.sun.behindEarth;
  const out: Eclipse[] = [];
  for (let i = 0; i < b.length; i++) {
    if (!(b[i] > 0)) continue;
    let peak = i;
    let j = i;
    while (j + 1 < b.length && b[j + 1] > 0) {
      j++;
      if (b[j] > b[peak]) peak = j;
    }
    out.push({ start: i, end: j, peak, covered: b[peak] });
    i = j;
  }
  return out;
}

// The eclipse under the scrubber, if any.
export const eclipseAt = (list: Eclipse[], i: number) => list.find((e) => i >= e.start && i <= e.end) ?? null;

// The next eclipse after the scrubber, or the first one again once past the last.
export const nextEclipse = (list: Eclipse[], i: number) => list.find((e) => e.start > i) ?? list[0] ?? null;

export const pctCovered = (f: number) => (f < 0.005 ? "under 1%" : Math.round(f * 100) + "%");
