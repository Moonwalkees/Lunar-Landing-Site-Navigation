import math

import numpy as np
import pytest

from app.horizon import MOON_RADIUS_M, skyline, skyline_at

MAST_M = 2.0


def test_flat_terrain_gives_the_curvature_dip_in_every_direction() -> None:
    def flat(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
        return np.zeros_like(lat)

    azimuth, elevation = skyline(-88.0, 30.0, mast_m=MAST_M, height_fn=flat)

    # From 2 m up on a smooth sphere the horizon sits just below level.
    dip = -math.degrees(math.acos(MOON_RADIUS_M / (MOON_RADIUS_M + MAST_M)))
    assert azimuth.shape == elevation.shape == (720,)
    assert azimuth[0] == 0.0 and azimuth[1] == 0.5
    np.testing.assert_allclose(elevation, dip, atol=0.01)


def test_a_single_peak_shows_up_at_its_azimuth_with_the_expected_elevation() -> None:
    site_lat, site_lon = 10.0, 40.0
    peak_height, peak_distance, peak_azimuth = 3000.0, 20_000.0, 90.0

    # The peak sits due east of the site. Near the equator that is very nearly the same
    # latitude, at a longitude further east by the distance over the circle's radius there.
    peak_lat = site_lat
    peak_lon = site_lon + math.degrees(peak_distance / (MOON_RADIUS_M * math.cos(math.radians(site_lat))))

    def one_peak(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
        north = np.radians(lat - peak_lat) * MOON_RADIUS_M
        east = np.radians(lon - peak_lon) * MOON_RADIUS_M * math.cos(math.radians(peak_lat))
        return peak_height * np.exp(-(north**2 + east**2) / (2 * 1500.0**2))

    azimuth, elevation = skyline(site_lat, site_lon, mast_m=MAST_M, height_fn=one_peak)

    # Elevation of the summit seen across the curved surface.
    arc = peak_distance / MOON_RADIUS_M
    expected = math.degrees(math.atan2(
        (MOON_RADIUS_M + peak_height) * math.cos(arc) - (MOON_RADIUS_M + MAST_M),
        (MOON_RADIUS_M + peak_height) * math.sin(arc),
    ))
    assert azimuth[int(np.argmax(elevation))] == pytest.approx(peak_azimuth, abs=1.0)
    assert elevation.max() == pytest.approx(expected, abs=0.1)
    # Away from the peak the horizon is the smooth sphere's again.
    assert skyline_at(270.0, azimuth, elevation) == pytest.approx(-0.087, abs=0.01)


def test_skyline_at_interpolates_across_north() -> None:
    azimuth = np.arange(720) * 0.5
    elevation = np.where(azimuth < 180, 1.0, 3.0)

    assert skyline_at(359.75, azimuth, elevation) == pytest.approx(2.0)
    assert skyline_at(-90.0, azimuth, elevation) == pytest.approx(3.0)
