"""Sun and Earth azimuth/elevation from a point on the lunar surface (SPICE).

Thread safety: CSPICE keeps global state (loaded kernels, caches, error flag)
and is not thread-safe, while spiceypy releases the GIL during C calls. Every
SPICE call in this module therefore runs under SPICE_LOCK. Any other module
that calls spiceypy directly must hold SPICE_LOCK too.
"""

import threading
from pathlib import Path

import numpy as np
import spiceypy as sp

BACKEND_DIR = Path(__file__).resolve().parent.parent
METAKERNEL = BACKEND_DIR / "data" / "kernels" / "meta.tm"

# Re-entrant so locked helpers can call each other (e.g. load_kernels).
SPICE_LOCK = threading.RLock()

_kernels_loaded = False


def load_kernels() -> None:
    """Load the SPICE metakernel once per process; later calls do nothing.

    Call this at app startup (FastAPI lifespan) so no request pays for it.
    The other functions also call it lazily, for tests and scripts.
    """
    global _kernels_loaded
    with SPICE_LOCK:
        if _kernels_loaded:
            return
        if not METAKERNEL.exists():
            raise FileNotFoundError(
                f"SPICE metakernel not found at {METAKERNEL}. "
                "Run `python scripts/fetch_data.py kernels` from backend/ first."
            )
        sp.furnsh(str(METAKERNEL))
        _kernels_loaded = True


def moon_radius_km() -> float:
    """Mean lunar radius (km) from the loaded PCK (pck00011: a 1737.4 km sphere)."""
    with SPICE_LOCK:
        load_kernels()
        radii = sp.bodvrd("MOON", "RADII", 3)[1]
    return float(radii[0])


def site_position(lat_deg: float, lon_deg: float) -> np.ndarray:
    """Body-fixed position (km) of a surface site in MOON_ME.

    lat_deg: planetocentric latitude, degrees north.
    lon_deg: east longitude, degrees.
    """
    _check_lat_lon(lat_deg, lon_deg)
    radius = moon_radius_km()
    lat_rad = np.radians(lat_deg)
    lon_rad = np.radians(lon_deg)
    with SPICE_LOCK:
        return np.array(sp.latrec(radius, lon_rad, lat_rad))


def _check_lat_lon(lat_deg: float, lon_deg: float) -> None:
    if not -90.0 <= lat_deg <= 90.0:
        raise ValueError(f"latitude must be in [-90, 90] degrees, got {lat_deg}")
    if not np.isfinite(lon_deg):
        raise ValueError(f"longitude must be a finite number, got {lon_deg}")


def local_enu(lat_deg: float, lon_deg: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Unit vectors (east, north, up) at a surface site, expressed in MOON_ME.

    Azimuth convention (must match horizon.py): azimuth is measured from
    `north`, clockwise towards `east`. At the poles every direction is
    north/south, so `north` is taken along the meridian of the given
    longitude, e.g. at the south pole with lon=0 it points towards 0 deg
    longitude (the Earth-facing side).
    """
    _check_lat_lon(lat_deg, lon_deg)
    lat = np.radians(lat_deg)
    lon = np.radians(lon_deg)
    sin_lat, cos_lat = np.sin(lat), np.cos(lat)
    sin_lon, cos_lon = np.sin(lon), np.cos(lon)
    east = np.array([-sin_lon, cos_lon, 0.0])
    north = np.array([-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat])
    up = np.array([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat])
    return east, north, up


def body_directions(
    site_pos: np.ndarray, times: list[str], target: str
) -> np.ndarray:
    """Apparent unit direction (MOON_ME) from a surface site to `target`.

    site_pos: site position in MOON_ME (km), e.g. from site_position().
    times:    UTC time strings SPICE can parse, e.g. "2027-01-01T00:00:00".
    target:   SPICE body name, e.g. "SUN" or "EARTH".

    Returns an (N, 3) array of unit vectors, one per time. Uses spkcpo with
    the observer fixed on the Moon and "LT+S" (light time + stellar
    aberration), i.e. where the body appears in the sky.
    """
    site_pos = np.asarray(site_pos, dtype=float)
    dirs = np.empty((len(times), 3))
    with SPICE_LOCK:
        load_kernels()
        for i, t in enumerate(times):
            et = sp.str2et(t)
            state, _lt = sp.spkcpo(
                target, et, "MOON_ME", "OBSERVER", "LT+S", site_pos, "MOON", "MOON_ME"
            )
            dirs[i] = state[:3]
    return dirs / np.linalg.norm(dirs, axis=1, keepdims=True)


def azel(
    dirs: np.ndarray, east: np.ndarray, north: np.ndarray, up: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Azimuth and elevation (deg) of unit directions in a local E/N/U frame.

    Azimuth: [0, 360), from north, clockwise (towards east).
    Elevation: [-90, 90], above the local horizontal plane (no terrain).
    """
    dirs = np.asarray(dirs, dtype=float)
    el = np.degrees(np.arcsin(np.clip(dirs @ up, -1.0, 1.0)))
    az = np.degrees(np.arctan2(dirs @ east, dirs @ north)) % 360.0
    return az, el


def sun_earth_azel(lat_deg: float, lon_deg: float, times: list[str]) -> dict[str, np.ndarray]:
    """Sun and Earth azimuth/elevation (deg) seen from a lunar surface site.

    lat_deg, lon_deg: site, planetocentric degrees north / east.
    times:            UTC time strings, e.g. "2027-01-01T00:00:00".

    Returns {"sun_az", "sun_el", "earth_az", "earth_el"}, each a float array
    the same length as `times`. Elevation is against the smooth-sphere
    horizon; terrain is handled by horizon.py.
    """
    east, north, up = local_enu(lat_deg, lon_deg)
    site = site_position(lat_deg, lon_deg)
    sun_az, sun_el = azel(body_directions(site, times, "SUN"), east, north, up)
    earth_az, earth_el = azel(body_directions(site, times, "EARTH"), east, north, up)
    return {"sun_az": sun_az, "sun_el": sun_el, "earth_az": earth_az, "earth_el": earth_el}
