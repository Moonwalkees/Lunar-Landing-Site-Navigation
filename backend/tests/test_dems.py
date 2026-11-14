"""Checks on the GeoTIFFs written by `fetch_data.py dems` (ticket 1.3)."""

from pathlib import Path

import pytest

rasterio = pytest.importorskip("rasterio")
from rasterio.crs import CRS  # noqa: E402
from rasterio.warp import transform  # noqa: E402

DEM_DIR = Path(__file__).resolve().parent.parent / "data" / "dem"
POLAR = DEM_DIR / "ldem_85s_20m_crop.tif"
GLOBAL = DEM_DIR / "ldem_64.tif"

if not (POLAR.exists() and GLOBAL.exists()):
    pytest.skip(
        "DEMs missing: run `python scripts/fetch_data.py dems`", allow_module_level=True
    )

MOON_LONLAT = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs")


def height_m(ds, lat: float, lon: float) -> float:
    if ds.crs.to_dict()["proj"] == "eqc":
        # Index the global map by lon/lat like app/horizon.py does: its CRS
        # metadata is off for lon > 180 (BUG-004), but the pixel grid is right.
        row = int((90.0 - lat) * ds.height / 180.0)
        col = int((lon % 360.0) * ds.width / 360.0)
    else:
        xs, ys = transform(MOON_LONLAT, ds.crs, [lon], [lat])
        row, col = ds.index(xs[0], ys[0])
    assert 0 <= row < ds.height and 0 <= col < ds.width, (lat, lon)
    return float(ds.read(1, window=((row, row + 1), (col, col + 1)))[0, 0]) * ds.scales[0]


@pytest.fixture(scope="module")
def polar():
    with rasterio.open(POLAR) as ds:
        yield ds


@pytest.fixture(scope="module")
def glob():
    with rasterio.open(GLOBAL) as ds:
        yield ds


def test_polar_crs_and_resolution(polar):
    p = polar.crs.to_dict()
    assert p["proj"] == "stere" and p["lat_0"] == -90 and p["R"] == 1737400
    assert polar.res == pytest.approx((20.0, 20.0))
    assert polar.scales[0] == 0.5


def test_global_crs_and_resolution(glob):
    p = glob.crs.to_dict()
    assert p["proj"] == "eqc" and p["R"] == 1737400
    assert (glob.width, glob.height) == (23040, 11520)
    assert glob.res == pytest.approx((473.802, 473.802), abs=0.01)
    assert glob.scales[0] == 0.5


@pytest.mark.parametrize(
    "lat,lon,low,high",
    [
        (-90.0, 0.0, 1000, 1600),       # pole, on Shackleton's rim
        (-89.67, 129.78, -3200, -2400),  # Shackleton crater floor
        (-89.45, 222.7, 1700, 2200),    # Connecting Ridge
        (-86.0, 2.9, 4800, 5400),       # Malapert Massif
    ],
)
def test_polar_heights_plausible(polar, lat, lon, low, high):
    assert low < height_m(polar, lat, lon) < high


@pytest.mark.parametrize("lat,lon", [(-89.67, 129.78), (-89.45, 222.7), (-86.0, 2.9)])
def test_polar_and_global_agree(polar, glob, lat, lon):
    assert height_m(polar, lat, lon) == pytest.approx(height_m(glob, lat, lon), abs=50)


def test_apollo_11_mare_height(glob):
    # Mare Tranquillitatis sits about 1.9 km below the 1737.4 km sphere.
    assert -2200 < height_m(glob, 0.674, 23.473) < -1600


def test_total_size_fits_docker_budget():
    total_mb = (POLAR.stat().st_size + GLOBAL.stat().st_size) / 1e6
    assert total_mb < 400
