"""Everything ``POST /analyze`` returns for one site and time window.

This only joins the other modules together: Sun and Earth positions (ephemeris), the
terrain skyline (horizon), the power, battery and comms model (utils) and eclipses.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.constants import (
    DEFAULT_BATTERY_CAPACITY_WH,
    DEFAULT_LOAD_W,
    DEFAULT_PANEL_AREA_M2,
    DEFAULT_PANEL_EFFICIENCY,
    SOLAR_CONSTANT_W_PER_M2,
)
from app.eclipse import angular_separation, disc_radii, occulted_fraction
from app.ephemeris import sun_earth_azel
from app.horizon import MAST_M, height_at, skyline, skyline_at
from app.utils import (
    comms_margin,
    comms_metrics,
    comms_state,
    disc_fraction,
    longest_run,
    power,
    simulate_battery,
    summarize_power,
)

MAX_STEPS = 20_000


def _next_drop(times: list[str], up: NDArray[np.bool_]) -> str | None:
    """The first time after the start at which a condition that was true becomes false."""
    drops = np.flatnonzero(up[:-1] & ~up[1:])
    return times[int(drops[0]) + 1] + "Z" if drops.size else None


def analyze(
    lat: float,
    lon: float,
    start: date,
    days: float,
    step_hours: float,
    solar_w: float | None = None,
    battery_wh: float | None = None,
    load_w: float | None = None,
) -> dict[str, Any]:
    """Skyline, Sun and Earth tracks, power, battery, comms and the headline metrics."""
    steps = int(np.floor(days * 24 / step_hours))
    if steps + 1 > MAX_STEPS:
        raise ValueError(f"That window has {steps + 1} time steps; the limit is {MAX_STEPS}. Use a larger step.")
    begin = datetime(start.year, start.month, start.day)
    times = [(begin + timedelta(hours=i * step_hours)).strftime("%Y-%m-%dT%H:%M:%S") for i in range(steps + 1)]

    ground = float(height_at(lat, lon))
    sky_az, sky_el = skyline(lat, lon)
    # The ephemeris and the model work in radians; the skyline, eclipse and the response are in degrees.
    sky = {name: np.degrees(angle) for name, angle in sun_earth_azel(lat, lon, times).items()}
    sun_radius, earth_radius = disc_radii(lat, lon, times)

    # Sun: share of the disc above the terrain, less whatever the Earth is covering.
    sun_skyline = skyline_at(sky["sun_az"], sky_az, sky_el)
    above_terrain = np.atleast_1d(disc_fraction(np.radians(sky["sun_el"]), np.radians(sun_skyline)))
    behind_earth = occulted_fraction(
        angular_separation(sky["sun_az"], sky["sun_el"], sky["earth_az"], sky["earth_el"]),
        sun_radius, earth_radius,
    )
    fraction = above_terrain * (1.0 - behind_earth)
    lit = fraction > 0

    # The rover: its solar power with the whole Sun in view, its battery and the power it uses.
    # Any left out are the VIPER defaults in constants.py. A given solar power scales the panel.
    default_solar_w = SOLAR_CONSTANT_W_PER_M2 * DEFAULT_PANEL_AREA_M2 * DEFAULT_PANEL_EFFICIENCY
    solar_w = default_solar_w if solar_w is None else float(solar_w)
    battery_wh = DEFAULT_BATTERY_CAPACITY_WH if battery_wh is None else float(battery_wh)
    load_w = DEFAULT_LOAD_W if load_w is None else float(load_w)
    area_m2 = DEFAULT_PANEL_AREA_M2 * solar_w / default_solar_w

    power_w = np.atleast_1d(power(np.radians(sky["sun_el"]), fraction, area_m2, DEFAULT_PANEL_EFFICIENCY))
    summary = summarize_power(power_w, step_hours)

    # Earth: clearance above the skyline in its direction.
    earth_skyline = skyline_at(sky["earth_az"], sky_az, sky_el)
    margin_rad = np.atleast_1d(comms_margin(np.radians(sky["earth_el"]), np.radians(earth_skyline)))
    comms = comms_metrics(margin_rad, step_hours)
    margin = np.degrees(margin_rad)
    linked = margin >= 0

    battery = simulate_battery(power_w, load_w=load_w, capacity_wh=battery_wh, dt_h=step_hours)

    return {
        "site": {"lat": lat, "lon": lon, "heightM": round(ground, 1), "mastM": MAST_M},
        "times": [t + "Z" for t in times],
        "stepHours": step_hours,
        "rover": {"solarW": round(solar_w, 1), "batteryWh": round(battery_wh, 1), "loadW": round(load_w, 1)},
        "skyline": {"az": sky_az.tolist(), "el": np.round(sky_el, 3).tolist()},
        "sun": {
            "az": np.round(sky["sun_az"], 3).tolist(),
            "el": np.round(sky["sun_el"], 3).tolist(),
            "fraction": np.round(fraction, 3).tolist(),
            "behindEarth": np.round(behind_earth, 3).tolist(),
        },
        "earth": {
            "az": np.round(sky["earth_az"], 3).tolist(),
            "el": np.round(sky["earth_el"], 3).tolist(),
            "margin": np.round(margin, 3).tolist(),
        },
        "powerW": np.round(power_w, 1).tolist(),
        "batteryWh": np.round(battery.charge_wh, 1).tolist(),
        "comms": np.atleast_1d(comms_state(margin_rad)).tolist(),
        "metrics": {
            "powerW": float(power_w[0]),
            "whPerDay": summary.watt_hours_per_day,
            "pctSunlit": summary.percent_time_sunlit,
            "longestNightH": longest_run(~lit, step_hours),
            "batteryMinWh": battery.minimum_wh,
            "survives": battery.survives,
            "earthClearanceDeg": float(np.degrees(comms.current_clearance_radians)),
            "pctEarthVisible": comms.percent_visible,
            "longestBlackoutH": comms.longest_blackout_hours,
            "nextSunset": _next_drop(times, lit),
            "nextEarthset": _next_drop(times, linked),
            "pctPowerAndComms": float(np.count_nonzero(lit & linked) * 100 / lit.size),
        },
    }
