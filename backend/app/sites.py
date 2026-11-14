"""Preset observer sites returned by ``GET /sites``.

Coordinates are approximate (degrees, east-positive longitude).
"""

PRESETS: list[dict[str, float | str]] = [
    {"name": "Shackleton crater (Artemis III)", "lat": -89.67, "lon": 129.78},
    {"name": "Connecting Ridge (Artemis III)", "lat": -89.45, "lon": 222.7},
    {"name": "Malapert Massif (Artemis III)", "lat": -86.0, "lon": 2.9},
    {"name": "Apollo 11", "lat": 0.674, "lon": 23.473},
    {"name": "Apollo 17", "lat": 20.191, "lon": 30.772},
]
