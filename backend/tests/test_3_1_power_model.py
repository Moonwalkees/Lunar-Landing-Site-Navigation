import math

import numpy as np
import pytest

from app.utils import disc_fraction, power, summarize_power


def test_disc_fraction_reaches_expected_horizon_boundaries() -> None:
    solar_radius = math.radians(0.267)
    skyline_el = math.radians(5)
    sun_el = np.array(
        [skyline_el - solar_radius, skyline_el, skyline_el + solar_radius]
    )

    fractions = disc_fraction(sun_el, skyline_el)

    np.testing.assert_allclose(fractions, [0.0, 0.5, 1.0])
    assert np.isfinite(fractions).all()
    assert np.all((fractions >= 0.0) & (fractions <= 1.0))


def test_power_uses_vertical_panel_irradiance_and_disc_fraction() -> None:
    watts = power(
        sun_el=math.pi / 3,
        fraction=0.5,
        area=2.0,
        efficiency=0.25,
    )

    assert watts == pytest.approx(170.125)


def test_summarize_power_reports_daily_energy_and_sunlit_share() -> None:
    metrics = summarize_power(np.array([0.0, 100.0, 200.0, 0.0]), step_hours=6)

    assert metrics.watt_hours_per_day == 1_800.0
    assert metrics.percent_time_sunlit == 50.0
