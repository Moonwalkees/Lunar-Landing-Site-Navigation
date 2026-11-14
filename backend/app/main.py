"""HTTP routes: ``GET /sites`` and ``POST /analyze``.

Run from backend/ with ``uvicorn app.main:app --reload``.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.analysis import analyze
from app.ephemeris import load_kernels
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


class Site(BaseModel):
    name: str
    lat: float
    lon: float


class AnalyzeRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-360, le=360)
    startDate: date
    days: float = Field(gt=0, le=400)
    stepHours: float = Field(gt=0, le=24)


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


class AnalyzeResponse(BaseModel):
    site: SiteInfo
    times: list[str]
    stepHours: float
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
        return analyze(request.lat, request.lon, request.startDate, request.days, request.stepHours)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
