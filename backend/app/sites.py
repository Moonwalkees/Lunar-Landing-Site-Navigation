"""Preset observer sites returned by ``GET /sites``.

Degrees, planetocentric latitude, east-positive longitude. Each point has a source (ticket 3.7):

- Connecting Ridge: the crest of NASA's LOLA 5 m "Site01: Connecting ridge" terrain (NASA PGDA,
  Barker et al. 2021; site numbering after Mazarico et al. 2011). On NASA's 2022 list of 13 Artemis III
  candidate regions, not on the October 2024 list of 9.
- Peak near Shackleton: the highest point of NASA's LOLA 5 m "Site07: Peak near Shackleton" terrain,
  0.7 km from the persistently lit spot (-88.79, 124.5) in Mahanti et al. 2024 (PSJ 5:62). On NASA's
  2022 list, not the 2024 list.
- Malapert Massif: NASA's notional Artemis III landing site on Mons Malapert, from Kring et al. 2025
  (JGR Planets). On NASA's October 2024 list of 9 candidate regions.
- Shackleton crater floor: the crater's centre in the IAU Gazetteer of Planetary Nomenclature, on its
  permanently shadowed floor (BUG-003). Kept as the dark case; not a landing region.
- Apollo 11 and 17: the lunar module positions in NASA's NSSDC Apollo landing site table.

The first south pole preset is the site the app opens on, so it is one that sees the Sun.
"""

PRESETS: list[dict[str, float | str]] = [
    {"name": "Connecting Ridge (Artemis III, 2022)", "lat": -89.45, "lon": 222.7},
    {"name": "Peak near Shackleton (Artemis III, 2022)", "lat": -88.8081, "lon": 123.718},
    {"name": "Malapert Massif (Artemis III)", "lat": -85.964, "lon": 357.681},
    {"name": "Shackleton crater floor", "lat": -89.67, "lon": 129.78},
    {"name": "Apollo 11", "lat": 0.67408, "lon": 23.47297},
    {"name": "Apollo 17", "lat": 20.1908, "lon": 30.77168},
]
