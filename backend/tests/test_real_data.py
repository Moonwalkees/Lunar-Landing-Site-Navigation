"""Checks of the terrain and the whole analysis that need the downloaded kernels and elevation maps.

They are skipped when ``backend/data`` has not been filled by ``scripts/fetch_data.py``.
"""

import pytest

from app.ephemeris import BACKEND_DIR, METAKERNEL

DEM_DIR = BACKEND_DIR / "data" / "dem"
kernels = pytest.mark.skipif(not METAKERNEL.exists(), reason="run scripts/fetch_data.py kernels")
maps = pytest.mark.skipif(
    not (DEM_DIR / "ldem_64.tif").exists() or not (DEM_DIR / "ldem_85s_20m_crop.tif").exists(),
    reason="run scripts/fetch_data.py dems",
)


@maps
def test_heights_come_from_the_right_map() -> None:
    from app.horizon import height_at

    assert float(height_at(-89.45101, 222.7605)) == pytest.approx(1957.0, abs=15.0)   # Connecting Ridge crest
    assert float(height_at(0.674, 23.473)) == pytest.approx(-1925.0, abs=60.0)        # Apollo 11, global map


@kernels
@maps
def test_a_south_pole_rim_site_is_mostly_sunlit_over_a_year() -> None:
    from datetime import date

    from app.analysis import analyze

    result = analyze(-89.45101, 222.7605, date(2027, 1, 1), 365, 2.0)

    assert result["metrics"]["pctSunlit"] > 80.0
    assert len(result["times"]) == len(result["sun"]["az"]) == len(result["powerW"]) == 4381
    assert len(result["skyline"]["el"]) == 720


@kernels
@maps
def test_the_august_2027_eclipse_dims_the_sun() -> None:
    from datetime import date

    from app.analysis import analyze

    result = analyze(-89.45101, 222.7605, date(2027, 8, 17), 0.5, 1.0)
    behind = result["sun"]["behindEarth"]

    assert max(behind) > 0.3                 # the Earth covers a good part of the Sun around 07:00 UTC
    assert behind[0] == 0.0                  # and none of it at midnight
    peak = behind.index(max(behind))
    assert result["powerW"][peak] < result["powerW"][0]


@kernels
@maps
def test_analyze_endpoint_returns_the_frontend_metric_names() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    assert {site["name"] for site in client.get("/sites").json()} >= {"Apollo 11"}

    body = {"lat": -89.45, "lon": 222.7, "startDate": "2027-01-01", "days": 2, "stepHours": 1}
    response = client.post("/analyze", json=body)

    assert response.status_code == 200
    data = response.json()
    assert len(data["times"]) == 49
    assert set(data["metrics"]) == {
        "powerW", "whPerDay", "pctSunlit", "longestNightH", "batteryMinWh", "survives",
        "earthClearanceDeg", "pctEarthVisible", "longestBlackoutH", "nextSunset", "nextEarthset",
        "pctPowerAndComms",
    }
    assert client.post("/analyze", json={**body, "stepHours": 0}).status_code == 422


@kernels
@maps
def test_analyze_takes_the_rover_s_own_power_numbers() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    body = {"lat": -89.45, "lon": 222.7, "startDate": "2027-01-01", "days": 2, "stepHours": 1}

    viper = client.post("/analyze", json=body).json()
    assert viper["rover"] == {"solarW": 449.1, "batteryWh": 5420.0, "loadW": 108.0}

    small = client.post("/analyze", json={**body, "rover": {"solarW": 50, "batteryWh": 200, "loadW": 20}}).json()
    assert small["rover"] == {"solarW": 50.0, "batteryWh": 200.0, "loadW": 20.0}
    assert max(small["powerW"]) <= 50.0 < max(viper["powerW"])   # the panel scales to the given power
    assert max(small["batteryWh"]) <= 200.0                       # and the battery to the given size

    bad = {**body, "rover": {"solarW": 0, "batteryWh": 200, "loadW": 20}}
    assert client.post("/analyze", json=bad).status_code == 422
