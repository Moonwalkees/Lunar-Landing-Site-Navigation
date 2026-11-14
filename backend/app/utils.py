from typing import SupportsFloat

import numpy as np
from numpy.typing import ArrayLike, NDArray

from app.constants import SOLAR_CONSTANT_W_PER_M2, SUN_ANGULAR_RADIUS_RADIANS
from app.model import PowerMetrics


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
