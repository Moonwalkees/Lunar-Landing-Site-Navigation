"""Terrain heights and the skyline seen from a site, from the LOLA elevation maps.

The maps are made by ``scripts/fetch_data.py dems``: a 20 m polar map cropped around the
preset south pole sites, and the global 64 pixel-per-degree map (about 474 m) for
everywhere else and for the far horizon. Only the part of each map a request needs is
read from disk.
"""

from __future__ import annotations

import threading
from typing import Callable

import numpy as np
import rasterio
from numpy.typing import ArrayLike, NDArray
from rasterio.enums import Resampling
from rasterio.windows import Window

from app.ephemeris import BACKEND_DIR, local_enu

MOON_RADIUS_M = 1_737_400.0
DEM_DIR = BACKEND_DIR / "data" / "dem"
POLAR_FILE = "ldem_85s_20m_crop.tif"
GLOBAL_FILE = "ldem_64.tif"

SKYLINE_AZIMUTHS = 720          # one every half degree
MAST_M = 2.0                    # observer height above the ground
REACH_M = 150_000.0             # how far out terrain can still matter
NEAR_M = 12_000.0               # within this, use the finest heights available
COARSE_FACTOR = 8               # the polar map is read at 160 m for the far field

HeightFn = Callable[[NDArray, NDArray], NDArray]


def _bilinear(grid: NDArray, row: NDArray, col: NDArray, wrap_cols: bool = False) -> NDArray:
    """Sample a height grid at fractional row / column positions."""
    rows, cols = grid.shape
    r0 = np.clip(np.floor(row).astype(int), 0, rows - 2)
    tr = np.clip(row - r0, 0.0, 1.0)
    if wrap_cols:
        c0 = np.floor(col).astype(int)
        tc = col - c0
        c0, c1 = c0 % cols, (c0 + 1) % cols
    else:
        c0 = np.clip(np.floor(col).astype(int), 0, cols - 2)
        tc = np.clip(col - c0, 0.0, 1.0)
        c1 = c0 + 1
    top = grid[r0, c0] * (1 - tc) + grid[r0, c1] * tc
    bottom = grid[r0 + 1, c0] * (1 - tc) + grid[r0 + 1, c1] * tc
    return top * (1 - tr) + bottom * tr


class _PolarMap:
    """The cropped 20 m south polar map (stereographic: x = r sin lon, y = r cos lon)."""

    def __init__(self) -> None:
        self.ds = rasterio.open(DEM_DIR / POLAR_FILE)
        self.scale = self.ds.scales[0]
        t = self.ds.transform
        self.left, self.top, self.pixel = t.c, t.f, t.a
        self._coarse: NDArray | None = None

    @staticmethod
    def xy(lat: NDArray, lon: NDArray) -> tuple[NDArray, NDArray]:
        r = 2 * MOON_RADIUS_M * np.tan(np.radians(90.0 + lat) / 2)
        lam = np.radians(lon)
        return r * np.sin(lam), r * np.cos(lam)

    def rowcol(self, lat: NDArray, lon: NDArray) -> tuple[NDArray, NDArray]:
        x, y = self.xy(lat, lon)
        return (self.top - y) / self.pixel - 0.5, (x - self.left) / self.pixel - 0.5

    def covers(self, row: NDArray, col: NDArray) -> NDArray:
        return (row >= 0) & (row <= self.ds.height - 1) & (col >= 0) & (col <= self.ds.width - 1)

    def fine(self, row: NDArray, col: NDArray) -> NDArray:
        """Heights at full resolution, reading only the window that holds the points."""
        r0, c0 = int(np.floor(row.min())), int(np.floor(col.min()))
        r1 = min(int(np.ceil(row.max())) + 1, self.ds.height - 1)
        c1 = min(int(np.ceil(col.max())) + 1, self.ds.width - 1)
        window = Window(c0, r0, c1 - c0 + 1, r1 - r0 + 1)
        grid = self.ds.read(1, window=window).astype(np.float32) * self.scale
        return _bilinear(grid, row - r0, col - c0)

    def coarse(self, row: NDArray, col: NDArray) -> NDArray:
        """Heights from the whole map read once at 160 m, for the far field."""
        if self._coarse is None:
            shape = (self.ds.height // COARSE_FACTOR, self.ds.width // COARSE_FACTOR)
            self._coarse = self.ds.read(1, out_shape=shape, resampling=Resampling.average).astype(np.float32) * self.scale
        fy = self._coarse.shape[0] / self.ds.height
        fx = self._coarse.shape[1] / self.ds.width
        return _bilinear(self._coarse, (row + 0.5) * fy - 0.5, (col + 0.5) * fx - 0.5)


class _GlobalMap:
    """The global 64 pixel-per-degree map (row 0 at 90 N, column 0 at 0 E)."""

    def __init__(self) -> None:
        self.ds = rasterio.open(DEM_DIR / GLOBAL_FILE)
        self.scale = self.ds.scales[0]
        self.per_degree = self.ds.width / 360.0

    def sample(self, lat: NDArray, lon: NDArray) -> NDArray:
        row = (90.0 - lat) * self.per_degree - 0.5
        col = (lon % 360.0) * self.per_degree - 0.5
        r0 = max(int(np.floor(row.min())), 0)
        r1 = min(int(np.ceil(row.max())) + 1, self.ds.height - 1)
        # Full width, so points either side of 0 E need no special handling.
        grid = self.ds.read(1, window=Window(0, r0, self.ds.width, r1 - r0 + 1)).astype(np.float32) * self.scale
        return _bilinear(grid, row - r0, col, wrap_cols=True)


_polar: _PolarMap | None = None
_global: _GlobalMap | None = None
# An open map file must not be read from two threads at once, and FastAPI runs requests in a thread pool.
MAP_LOCK = threading.Lock()


def _maps() -> tuple[_PolarMap, _GlobalMap]:
    global _polar, _global
    if _polar is None or _global is None:
        if not (DEM_DIR / POLAR_FILE).exists() or not (DEM_DIR / GLOBAL_FILE).exists():
            raise FileNotFoundError(
                f"Elevation maps are missing from {DEM_DIR}. "
                "Run `python scripts/fetch_data.py dems` from backend/ first."
            )
        _polar, _global = _PolarMap(), _GlobalMap()
    return _polar, _global


def _heights(lat: NDArray, lon: NDArray, fine: bool) -> NDArray:
    lat, lon = np.asarray(lat, dtype=float), np.asarray(lon, dtype=float)
    out = np.empty(lat.shape, dtype=np.float32)
    with MAP_LOCK:
        polar, world = _maps()
        row, col = polar.rowcol(lat, lon)
        inside = (lat < -84.9) & polar.covers(row, col)
        if inside.any():
            sample = polar.fine if fine else polar.coarse
            out[inside] = sample(row[inside], col[inside])
        if (~inside).any():
            out[~inside] = world.sample(lat[~inside], lon[~inside])
    return out


def height_at(lat: ArrayLike, lon: ArrayLike) -> NDArray[np.float32]:
    """Terrain height in metres above the 1737.4 km sphere, with bilinear interpolation.

    Uses the 20 m polar map where it covers a point and the global map everywhere else.
    """
    lat_a, lon_a = np.broadcast_arrays(np.asarray(lat, dtype=float), np.asarray(lon, dtype=float))
    return _heights(lat_a, lon_a, fine=True)


def _distances(reach_m: float) -> NDArray:
    """Sample distances along each direction: fine steps near, coarser far."""
    out, d = [], 15.0
    while d < reach_m:
        out.append(d)
        d += max(15.0, d * 0.01)
    return np.array(out)


def skyline(
    lat: float,
    lon: float,
    mast_m: float = MAST_M,
    height_fn: HeightFn | None = None,
    reach_m: float = REACH_M,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """The terrain skyline seen from a site: ``(az[720], el[720])`` in degrees.

    For each half degree of azimuth (clockwise from north) this walks outward along the
    Moon's curved surface, looks up the terrain height, and keeps the highest elevation
    angle seen from the observer, who stands ``mast_m`` above the ground.

    ``height_fn(lat, lon)`` replaces the real maps, for tests.
    """
    azimuth = np.arange(SKYLINE_AZIMUTHS) * (360.0 / SKYLINE_AZIMUTHS)
    distance = _distances(reach_m)
    east, north, up = local_enu(lat, lon)

    # Every sample point as a direction from the Moon's centre (azimuths x distances x 3).
    bearing = np.radians(azimuth)
    level = north[None, :] * np.cos(bearing)[:, None] + east[None, :] * np.sin(bearing)[:, None]
    arc = distance / MOON_RADIUS_M
    unit = up[None, None, :] * np.cos(arc)[None, :, None] + level[:, None, :] * np.sin(arc)[None, :, None]
    point_lat = np.degrees(np.arcsin(np.clip(unit[..., 2], -1.0, 1.0)))
    point_lon = np.degrees(np.arctan2(unit[..., 1], unit[..., 0])) % 360.0

    if height_fn is not None:
        ground = float(np.asarray(height_fn(np.array([lat]), np.array([lon])))[0])
        height = np.asarray(height_fn(point_lat, point_lon), dtype=float)
    else:
        ground = float(height_at(lat, lon))
        near = distance <= NEAR_M
        height = np.empty(point_lat.shape, dtype=float)
        height[:, near] = _heights(point_lat[:, near], point_lon[:, near], fine=True)
        height[:, ~near] = _heights(point_lat[:, ~near], point_lon[:, ~near], fine=False)

    eye = up * (MOON_RADIUS_M + ground + mast_m)
    toward = unit * (MOON_RADIUS_M + height)[..., None] - eye
    elevation = np.degrees(np.arcsin(toward @ up / np.linalg.norm(toward, axis=-1)))
    return azimuth, np.nanmax(elevation, axis=1)


def skyline_at(azimuth: ArrayLike, sky_az: NDArray, sky_el: NDArray) -> NDArray[np.float64]:
    """Skyline elevation at any azimuth, interpolated around the full circle."""
    return np.interp(np.asarray(azimuth, dtype=float) % 360.0, sky_az, sky_el, period=360.0)


TERRAIN_HALF_M = 12_000.0       # the 2D map covers 24 km square around the site
TERRAIN_SPACING_M = 100.0       # one height every 100 m: light to send, still shows craters and ridges


def terrain_grid(
    lat: float,
    lon: float,
    half_m: float = TERRAIN_HALF_M,
    spacing_m: float = TERRAIN_SPACING_M,
    height_fn: HeightFn | None = None,
) -> NDArray[np.float32]:
    """Terrain heights on a square, north-up grid centred on a site, for the 2D map.

    Cell ``[i, j]`` lies ``half_m - i * spacing_m`` metres north and ``j * spacing_m - half_m``
    metres east of the site, measured along the Moon's surface (azimuthal equidistant), so
    row 0 is the north edge. North and east are the same as in ``skyline`` and the Sun and
    Earth azimuths. Heights are metres above the 1737.4 km sphere.
    """
    count = int(round(2 * half_m / spacing_m)) + 1
    offsets = np.linspace(-half_m, half_m, count)
    north_m, east_m = np.meshgrid(offsets[::-1], offsets, indexing="ij")
    east, north, up = local_enu(lat, lon)

    # Walk from the site along the great circle towards each cell, as skyline() does.
    arc = np.hypot(north_m, east_m) / MOON_RADIUS_M
    bearing = np.arctan2(east_m, north_m)
    level = north[None, None, :] * np.cos(bearing)[..., None] + east[None, None, :] * np.sin(bearing)[..., None]
    unit = up * np.cos(arc)[..., None] + level * np.sin(arc)[..., None]
    point_lat = np.degrees(np.arcsin(np.clip(unit[..., 2], -1.0, 1.0)))
    point_lon = np.degrees(np.arctan2(unit[..., 1], unit[..., 0])) % 360.0

    if height_fn is not None:
        return np.asarray(height_fn(point_lat, point_lon), dtype=np.float32)
    return _heights(point_lat, point_lon, fine=True)


def map_resolution_m(lat: float, lon: float) -> float:
    """Pixel size of the elevation map ``height_at`` uses at a site: 20 m polar or about 474 m global."""
    with MAP_LOCK:
        polar, world = _maps()
        row, col = polar.rowcol(np.array([lat]), np.array([lon]))
        if lat < -84.9 and bool(polar.covers(row, col)[0]):
            return float(polar.pixel)
        return float(2 * np.pi * MOON_RADIUS_M / world.ds.width)
