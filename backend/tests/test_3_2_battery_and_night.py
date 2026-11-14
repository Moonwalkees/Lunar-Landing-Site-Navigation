import numpy as np

from app.utils import longest_run, simulate_battery


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
