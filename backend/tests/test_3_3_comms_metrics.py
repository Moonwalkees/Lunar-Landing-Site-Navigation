import numpy as np

from app.utils import comms_margin, comms_metrics, comms_state


def test_comms_state_uses_blocked_marginal_and_clear_thresholds() -> None:
    states = comms_state(np.radians(np.array([-1.0, 0.0, 0.49, 0.51])))

    assert states.tolist() == ["blocked", "marginal", "marginal", "clear"]


def test_comms_metrics_report_clearance_visibility_and_blackout() -> None:
    margins = comms_margin(
        earth_el=np.radians(np.array([1.0, -1.0, -1.0, 0.0])),
        skyline_el=np.zeros(4),
    )

    metrics = comms_metrics(margins, dt_h=2.0, current_index=3)

    assert metrics.current_clearance_radians == 0.0
    assert metrics.percent_visible == 50.0
    assert metrics.longest_blackout_hours == 4.0


def test_comms_metrics_accepts_a_scalar_clearance() -> None:
    metrics = comms_metrics(np.radians(1.0), dt_h=1.0)

    assert metrics.current_clearance_radians == np.radians(1.0)
    assert metrics.percent_visible == 100.0
    assert metrics.longest_blackout_hours == 0.0
