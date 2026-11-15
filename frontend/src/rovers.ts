// Rover power presets for the analysis. Three plain numbers, the ones the battery model needs:
//   solarW    solar power with the whole Sun in view (W)
//   batteryWh battery capacity (Wh)
//   loadW     power the rover uses all the time (W)
// A preset is only listed when all three are published or follow directly from published
// figures (ticket 6.8 lists the rovers checked and why they are not here yet).

export interface RoverSpec {
  name: string;
  solarW: number;
  batteryWh: number;
  loadW: number;
}

export const CUSTOM_ROVER = "Custom";

export const ROVER_PRESETS: (RoverSpec & { source: string })[] = [
  {
    name: "VIPER (NASA)",
    solarW: 450, // "peak power of 450 watts" (NASA Science, VIPER In Depth)
    batteryWh: 5420, // "Battery capacity (start of life @ 0C): 5,420 W-hr" (NASA NTRS 20240013903)
    loadW: 108, // 5,420 Wh / NASA's "50 hours survival in low power mode"
    source: "NASA: 450 W peak, 5,420 Wh, 50 h on battery in low power mode",
  },
];

export const DEFAULT_ROVER: RoverSpec = ROVER_PRESETS[0];

// The allowed range of each number (the backend checks the same), and what to say outside it.
export const ROVER_RULES: Record<"solarW" | "batteryWh" | "loadW", { ok: (n: number) => boolean; message: string }> = {
  solarW: { ok: (n) => n > 0 && n <= 100_000, message: "Solar power must be more than 0 W." },
  batteryWh: { ok: (n) => n > 0 && n <= 10_000_000, message: "Battery must be more than 0 Wh." },
  loadW: { ok: (n) => n >= 0 && n <= 100_000, message: "Power use must be 0 W or more." },
};
