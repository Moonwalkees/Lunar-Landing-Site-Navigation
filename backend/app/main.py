"""HTTP routes: ``GET /sites`` and ``POST /analyze``.

Run from backend/ with ``uvicorn app.main:app --reload``.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from app.analysis import analyze
from app.ephemeris import load_kernels
from app.horizon import TERRAIN_SPACING_M, map_resolution_m, terrain_grid
from app.sites import PRESETS

# The frontend's dev server. Add hosted origins with FRONTEND_ORIGINS="https://a,https://b".
ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"] + [
    origin.strip() for origin in os.environ.get("FRONTEND_ORIGINS", "").split(",") if origin.strip()
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_kernels()          # once at startup, so no request pays for it
    yield


app = FastAPI(title="Lunar Landing Site Navigator", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])
# The terrain grid is about 250 kB of JSON; compressed it is well under 100 kB.
app.add_middleware(GZipMiddleware, minimum_size=1000)


class Site(BaseModel):
    name: str
    lat: float
    lon: float


class Rover(BaseModel):
    """A rover's power numbers. Left out, the analysis uses NASA's VIPER (constants.py)."""

    solarW: float = Field(gt=0, le=100_000)       # solar power with the whole Sun in view
    batteryWh: float = Field(gt=0, le=10_000_000)  # battery capacity
    loadW: float = Field(ge=0, le=100_000)         # power it uses all the time


class AnalyzeRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-360, le=360)
    startDate: date
    days: float = Field(gt=0, le=400)
    stepHours: float = Field(gt=0, le=24)
    rover: Rover | None = None


class SiteInfo(BaseModel):
    lat: float
    lon: float
    heightM: float
    mastM: float


class Skyline(BaseModel):
    az: list[float]
    el: list[float]


class SunTrack(BaseModel):
    az: list[float]
    el: list[float]
    fraction: list[float]       # share of the disc that is visible, 0 to 1
    behindEarth: list[float]    # share of the disc the Earth is covering (lunar eclipse)


class EarthTrack(BaseModel):
    az: list[float]
    el: list[float]
    margin: list[float]         # degrees above the skyline in the Earth's direction


class Metrics(BaseModel):
    """Field names match ``Metrics`` in frontend/src/types.ts."""

    powerW: float | None
    whPerDay: float | None
    pctSunlit: float | None
    longestNightH: float | None
    batteryMinWh: float | None
    survives: bool | None
    earthClearanceDeg: float | None
    pctEarthVisible: float | None
    longestBlackoutH: float | None
    nextSunset: str | None
    nextEarthset: str | None
    pctPowerAndComms: float | None


class TerrainResponse(BaseModel):
    lat: float
    lon: float
    size: int                   # cells per side; the grid is size x size
    spacingM: float             # distance between neighbouring cells
    sourceM: float              # pixel size of the elevation map the heights come from
    heights: list[int]          # metres above the 1737.4 km sphere, row by row from the north edge, west to east


class AnalyzeResponse(BaseModel):
    site: SiteInfo
    times: list[str]
    stepHours: float
    rover: Rover
    skyline: Skyline
    sun: SunTrack
    earth: EarthTrack
    powerW: list[float]
    batteryWh: list[float]
    comms: list[Literal["blocked", "marginal", "clear"]]
    metrics: Metrics


@app.get("/sites", response_model=list[Site])
def sites() -> list[dict[str, float | str]]:
    return PRESETS


@app.post("/analyze", response_model=AnalyzeResponse)
def post_analyze(request: AnalyzeRequest) -> dict:
    try:
        rover = request.rover
        return analyze(
            request.lat, request.lon, request.startDate, request.days, request.stepHours,
            solar_w=rover.solarW if rover else None,
            battery_wh=rover.batteryWh if rover else None,
            load_w=rover.loadW if rover else None,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/terrain", response_model=TerrainResponse)
def get_terrain(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-360, le=360)) -> dict:
    """A north-up height grid around a site for the 2D map (24 km square, 100 m cells)."""
    try:
        grid = terrain_grid(lat, lon)
        source = map_resolution_m(lat, lon)
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {
        "lat": lat,
        "lon": lon,
        "size": grid.shape[0],
        "spacingM": TERRAIN_SPACING_M,
        "sourceM": round(source, 1),
        "heights": [int(h) for h in grid.round().ravel()],
    }
