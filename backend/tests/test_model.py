import math

import numpy as np
import pytest

from app.model import disc_fraction, longest_run, power, simulate_battery, summarize_power


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


def test_simulate_battery_clamps_charge_at_both_bounds() -> None:
    result = simulate_battery(
        power_w=np.array([0.0, 200.0, 0.0]),
        load_w=100.0,
        capacity_wh=100.0,
        dt_h=1.0,
    )

    np.testing.assert_allclose(result.charge_wh, [0.0, 100.0, 0.0])
    assert result.minimum_wh == 0.0
    assert result.survives is False


def test_simulate_battery_reports_survival_without_depletion() -> None:
    result = simulate_battery(
        power_w=np.array([100.0, 100.0]),
        load_w=100.0,
        capacity_wh=100.0,
        dt_h=1.0,
    )

    assert result.minimum_wh == 100.0
    assert result.survives is True


def test_longest_run_reports_the_longest_true_interval() -> None:
    hours = longest_run(
        np.array([False, True, True, False, True, True, True]),
        dt_h=0.5,
    )

    assert hours == 1.5
