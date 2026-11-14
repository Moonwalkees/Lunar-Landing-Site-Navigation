import math

import numpy as np

from app.horizon import MOON_RADIUS_M, terrain_grid


def _peak_at(peak_lat: float, peak_lon: float):
    def one_peak(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
        north = np.radians(lat - peak_lat) * MOON_RADIUS_M
        east = np.radians(lon - peak_lon) * MOON_RADIUS_M * math.cos(math.radians(peak_lat))
        return 1000.0 * np.exp(-(north**2 + east**2) / (2 * 300.0**2))
    return one_peak


def test_grid_is_square_and_centred_on_the_site() -> None:
    grid = terrain_grid(10.0, 40.0, half_m=1000.0, spacing_m=100.0, height_fn=_peak_at(10.0, 40.0))
    assert grid.shape == (21, 21)
    assert np.unravel_index(np.argmax(grid), grid.shape) == (10, 10)


def test_north_is_up_and_east_is_right() -> None:
    site_lat, site_lon, offset_m = 10.0, 40.0, 3000.0
    # A peak 3 km due east of the site, and one 3 km due north.
    east_lon = site_lon + math.degrees(offset_m / (MOON_RADIUS_M * math.cos(math.radians(site_lat))))
    north_lat = site_lat + math.degrees(offset_m / MOON_RADIUS_M)

    east = terrain_grid(site_lat, site_lon, half_m=5000.0, spacing_m=100.0, height_fn=_peak_at(site_lat, east_lon))
    north = terrain_grid(site_lat, site_lon, half_m=5000.0, spacing_m=100.0, height_fn=_peak_at(north_lat, site_lon))

    centre = 50
    assert np.unravel_index(np.argmax(east), east.shape) == (centre, centre + 30)
    assert np.unravel_index(np.argmax(north), north.shape) == (centre - 30, centre)
