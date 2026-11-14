"""Lunar eclipses: seen from the Moon, the Earth passing in front of the Sun."""

from __future__ import annotations

import numpy as np
import spiceypy as sp
from numpy.typing import ArrayLike, NDArray

from app.constants import EARTH_RADIUS_KM, SUN_RADIUS_KM
from app.ephemeris import SPICE_LOCK, load_kernels, site_position


def disc_radii(lat_deg: float, lon_deg: float, times: list[str]) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Angular radius of the Sun's and the Earth's disc (degrees) at each UTC time.

    Both change with distance: the Earth's from about 0.90 to 1.02 degrees over a month.
    """
    site = site_position(lat_deg, lon_deg)
    radii = np.empty((2, len(times)))
    with SPICE_LOCK:
        load_kernels()
        for i, when in enumerate(times):
            et = sp.str2et(when)
            for row, (body, radius_km) in enumerate((("SUN", SUN_RADIUS_KM), ("EARTH", EARTH_RADIUS_KM))):
                state, _ = sp.spkcpo(body, et, "MOON_ME", "OBSERVER", "LT+S", site, "MOON", "MOON_ME")
                radii[row, i] = np.degrees(np.arcsin(radius_km / np.linalg.norm(state[:3])))
    return radii[0], radii[1]


def angular_separation(az1: ArrayLike, el1: ArrayLike, az2: ArrayLike, el2: ArrayLike) -> NDArray[np.float64]:
    """Angle between two directions given as azimuth and elevation, all in degrees."""
    a1, e1, a2, e2 = (np.radians(np.asarray(v, dtype=float)) for v in (az1, el1, az2, el2))
    cosine = np.sin(e1) * np.sin(e2) + np.cos(e1) * np.cos(e2) * np.cos(a1 - a2)
    return np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0)))


def occulted_fraction(separation: ArrayLike, sun_radius: ArrayLike, earth_radius: ArrayLike) -> NDArray[np.float64]:
    """Share of the Sun's disc covered by the Earth's disc (0 to 1).

    The overlap of two circles: one of radius ``sun_radius``, one of ``earth_radius``,
    with centres ``separation`` apart. All three in the same angular unit.
    """
    d, r, big = np.broadcast_arrays(
        np.asarray(separation, dtype=float), np.asarray(sun_radius, dtype=float), np.asarray(earth_radius, dtype=float)
    )
    covered = np.zeros(d.shape)
    covered[d <= big - r] = 1.0                      # the Sun is wholly behind the Earth
    partial = (d < r + big) & (d > np.abs(big - r))
    if partial.any():
        dp, rp, bp = d[partial], r[partial], big[partial]
        sun_part = rp**2 * np.arccos(np.clip((dp**2 + rp**2 - bp**2) / (2 * dp * rp), -1.0, 1.0))
        earth_part = bp**2 * np.arccos(np.clip((dp**2 + bp**2 - rp**2) / (2 * dp * bp), -1.0, 1.0))
        lens = 0.5 * np.sqrt(np.maximum((-dp + rp + bp) * (dp + rp - bp) * (dp - rp + bp) * (dp + rp + bp), 0.0))
        covered[partial] = (sun_part + earth_part - lens) / (np.pi * rp**2)
    return np.clip(covered, 0.0, 1.0)
