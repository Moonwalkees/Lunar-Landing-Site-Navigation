from typing import SupportsFloat

import numpy as np
from numpy.typing import ArrayLike, NDArray

from app.constants import (
    DEFAULT_BATTERY_CAPACITY_WH,
    DEFAULT_LOAD_W,
    SOLAR_CONSTANT_W_PER_M2,
    SUN_ANGULAR_RADIUS_RADIANS,
)
from app.model import BatteryResult, PowerMetrics


def scalar_or_array(value: NDArray[float]) -> float | NDArray[float]:
    if value.ndim == 0:
        return float(value)
    return value


def disc_fraction(sun_el: ArrayLike, skyline_el: ArrayLike) -> float | NDArray[np.float64]:
    """Return the visible fraction of the Sun's disc above the terrain horizon."""
    x = np.clip(
        (np.asarray(sun_el) - np.asarray(skyline_el)) / SUN_ANGULAR_RADIUS_RADIANS,
        -1.0,
        1.0,
    )
    fraction = 1.0 - (np.arccos(x) - x * np.sqrt(1.0 - x**2)) / np.pi
    fraction = np.clip(fraction, 0.0, 1.0)
    return scalar_or_array(fraction)


def power(
    sun_el: ArrayLike,
    fraction: ArrayLike,
    area: SupportsFloat,
    efficiency: SupportsFloat,
) -> float | NDArray[np.float64]:
    """Return vertical-panel solar power in watts for one or more time steps."""
    watts = (
        SOLAR_CONSTANT_W_PER_M2
        * float(area)
        * float(efficiency)
        * np.cos(np.asarray(sun_el))
        * np.asarray(fraction)
    )
    return scalar_or_array(watts)


def summarize_power(power_w: ArrayLike, step_hours: SupportsFloat) -> PowerMetrics:
    """Summarize sampled power as daily energy and the percentage of lit samples."""
    samples = np.asarray(power_w, dtype=float)
    if samples.size == 0:
        return PowerMetrics(watt_hours_per_day=0.0, percent_time_sunlit=0.0)

    interval_hours = float(step_hours)
    if interval_hours <= 0:
        raise ValueError("step_hours must be greater than zero")

    total_hours = samples.size * interval_hours
    return PowerMetrics(
        watt_hours_per_day=float(samples.sum() * interval_hours * 24 / total_hours),
        percent_time_sunlit=float(np.count_nonzero(samples > 0) * 100 / samples.size),
    )


def simulate_battery(
    power_w: ArrayLike,
    load_w: SupportsFloat = DEFAULT_LOAD_W,
    capacity_wh: SupportsFloat = DEFAULT_BATTERY_CAPACITY_WH,
    dt_h: SupportsFloat = 1.0,
) -> BatteryResult:
    """Simulate a battery that starts full and clamps its charge each time step."""
    interval_hours = float(dt_h)
    capacity = float(capacity_wh)
    if interval_hours <= 0:
        raise ValueError("dt_h must be greater than zero")
    if capacity <= 0:
        raise ValueError("capacity_wh must be greater than zero")

    samples = np.asarray(power_w, dtype=float)
    charge_wh = np.empty_like(samples, dtype=float)
    charge = capacity
    for index, watts in enumerate(samples):
        charge = float(
            np.clip(
                charge + (watts - float(load_w)) * interval_hours,
                0,
                capacity,
            )
        )
        charge_wh[index] = charge

    minimum_wh = float(charge_wh.min()) if charge_wh.size else capacity
    return BatteryResult(
        charge_wh=charge_wh,
        minimum_wh=minimum_wh,
        survives=bool(np.all(charge_wh > 0)),
    )


def longest_run(mask: ArrayLike, dt_h: SupportsFloat) -> float:
    """Return the duration in hours of the longest contiguous true run."""
    interval_hours = float(dt_h)
    if interval_hours <= 0:
        raise ValueError("dt_h must be greater than zero")

    longest = 0
    current = 0
    for value in np.asarray(mask, dtype=bool):
        current = current + 1 if value else 0
        longest = max(longest, current)
    return longest * interval_hours
