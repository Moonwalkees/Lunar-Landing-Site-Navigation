"""Tests for app/ephemeris.py (ticket 1.2). Needs the kernels from fetch_data.py."""

from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pytest
import spiceypy as sp

from app import ephemeris
from app.ephemeris import SPICE_LOCK, load_kernels, local_enu, sun_earth_azel

if not ephemeris.METAKERNEL.exists():
    pytest.skip(
        "SPICE kernels missing: run `python scripts/fetch_data.py kernels`",
        allow_module_level=True,
    )


def month_times(start: str, step_hours: int = 3, days: int = 30) -> list[str]:
    load_kernels()
    with SPICE_LOCK:
        et0 = sp.str2et(start)
        return [sp.et2utc(et0 + 3600.0 * h, "ISOC", 0) for h in range(0, days * 24, step_hours)]


def test_output_shape_and_ranges():
    times = month_times("2027-01-01", step_hours=24, days=5)
    out = sun_earth_azel(-89.45, -137.31, times)
    assert set(out) == {"sun_az", "sun_el", "earth_az", "earth_el"}
    for key, arr in out.items():
        assert arr.shape == (len(times),), key
    for key in ("sun_az", "earth_az"):
        assert np.all((out[key] >= 0) & (out[key] < 2 * np.pi))
    for key in ("sun_el", "earth_el"):
        assert np.all(np.abs(out[key]) <= np.pi / 2)


def test_empty_times():
    out = sun_earth_azel(0.0, 0.0, [])
    assert all(arr.shape == (0,) for arr in out.values())


@pytest.mark.parametrize("lat", [90.01, -90.5, float("nan")])
def test_bad_latitude_rejected(lat):
    with pytest.raises(ValueError):
        sun_earth_azel(lat, 0.0, ["2027-01-01T00:00:00"])


@pytest.mark.parametrize("lat,lon", [(0, 0), (45, 120), (-89.9, -137), (-90, 0), (90, 30)])
def test_local_enu_is_right_handed_orthonormal(lat, lon):
    e, n, u = local_enu(lat, lon)
    m = np.array([e, n, u])
    assert np.allclose(m @ m.T, np.eye(3))
    assert np.allclose(np.cross(e, n), u)


@pytest.mark.parametrize("t", ["2027-01-01T00:00:00", "2027-04-15T06:00:00", "2028-09-30T18:00:00"])
def test_sun_overhead_at_subsolar_point(t):
    load_kernels()
    with SPICE_LOCK:
        sun, _ = sp.spkpos("SUN", sp.str2et(t), "MOON_ME", "LT+S", "MOON")
        _, lon, lat = sp.reclat(sun)
    out = sun_earth_azel(np.degrees(lat), np.degrees(lon), [t])
    assert np.degrees(out["sun_el"][0]) == pytest.approx(90.0, abs=0.1)


def test_earth_high_and_steady_at_apollo_11():
    # Sub-Earth point is near (0, 0), so Earth sits ~90 - 23.5 = ~66 deg up.
    # Libration swings it about +/-8 deg over a month.
    el = np.degrees(sun_earth_azel(0.67, 23.47, month_times("2027-01-01"))["earth_el"])
    assert el.mean() == pytest.approx(66.0, abs=2.0)
    assert el.min() > 56.0 and el.max() < 76.0


def test_earth_near_horizon_at_south_pole():
    # Latitude libration (~6.7 deg) plus parallax keeps Earth within ~7 deg
    # of the horizon, and it must actually wobble (libration is modelled).
    el = np.degrees(sun_earth_azel(-90.0, 0.0, month_times("2027-01-01"))["earth_el"])
    assert np.all(np.abs(el) < 8.0)
    assert el.max() - el.min() > 5.0


def test_concurrent_calls_match_serial():
    times = month_times("2027-01-01", step_hours=6)
    sites = [(-89.45, -137.31), (0.67, 23.47), (-85.0, 30.0), (20.0, -60.0)] * 4
    serial = [sun_earth_azel(lat, lon, times) for lat, lon in sites]
    with ThreadPoolExecutor(max_workers=8) as pool:
        parallel = list(pool.map(lambda s: sun_earth_azel(*s, times), sites))
    for a, b in zip(serial, parallel):
        for key in a:
            np.testing.assert_array_equal(a[key], b[key])
