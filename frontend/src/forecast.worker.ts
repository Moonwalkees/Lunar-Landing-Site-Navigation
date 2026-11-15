// Web Worker for the forecast overlay (ticket 7.7). Driven by useForecast() in forecast.ts.

import { combine, FrameCache, forecastSteps, sampleSteps, type ForecastBody, type ForecastGrid, type ForecastTracks } from "./forecastCore";

export interface SetupMessage {
  type: "setup";
  grid: ForecastGrid;
  tracks: ForecastTracks;
}

export interface RequestMessage {
  type: "request";
  id: number;
  body: ForecastBody;
  i: number;
  k: number;
  early: boolean;
}

export interface ReplyMessage {
  id: number;
  body: ForecastBody;
  early: boolean;
  i: number;
  steps: number;
  now: Float32Array;
  delta: Float32Array;
  deltaAt: Uint8Array;
  dip: Float32Array;
  dipAt: Uint8Array;
}

// tsconfig has the DOM lib, not WebWorker, so type the worker scope by hand.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SetupMessage | RequestMessage>) => void) | null;
  postMessage(message: ReplyMessage, transfer: Transferable[]): void;
};

let cache: FrameCache | null = null;
let stepCount = 0;
let setupCount = 0;
let wanted: RequestMessage | null = null;
let running = false;

// Yield so queued messages are delivered. MessageChannel has no 4 ms minimum, unlike setTimeout.
const channel = new MessageChannel();
let resume: (() => void) | null = null;
channel.port1.onmessage = () => resume?.();
const breathe = () => new Promise<void>((done) => { resume = done; channel.port2.postMessage(0); });

async function run() {
  if (running) return;
  running = true;
  while (wanted && cache) {
    const request = wanted, frames = cache, setup = setupCount;
    const steps = forecastSteps(request.i, request.k, stepCount);
    const at = sampleSteps(request.i, steps);
    const window: Float32Array[] = [];
    let stale = false;
    for (const t of at) {
      const fresh = !frames.has(request.body, t, request.early);
      window.push(frames.frame(request.body, t, request.early));
      if (!fresh) continue;
      // After each new frame (~13 ms), drop this request if a newer one has arrived.
      await breathe();
      if (wanted !== request || setupCount !== setup) { stale = true; break; }
    }
    if (stale) continue;
    wanted = null;
    const out = combine(window, at.map((t) => t - request.i));
    scope.postMessage(
      { id: request.id, body: request.body, early: request.early, i: request.i, steps, ...out },
      [out.now.buffer, out.delta.buffer, out.deltaAt.buffer, out.dip.buffer, out.dipAt.buffer],
    );
  }
  running = false;
}

scope.onmessage = ({ data }) => {
  if (data.type === "setup") {
    cache = new FrameCache(data.grid, data.tracks);
    stepCount = data.tracks.sunAz.length;
    setupCount++;
    wanted = null;
    return;
  }
  wanted = data;
  void run();
};
