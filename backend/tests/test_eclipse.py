import math

import numpy as np
import pytest

from app.eclipse import angular_separation, occulted_fraction


def test_occulted_fraction_at_the_ends() -> None:
    sun, earth = 0.267, 0.95

    assert occulted_fraction(earth + sun, sun, earth) == 0.0          # just touching
    assert occulted_fraction(5.0, sun, earth) == 0.0                  # far apart
    assert occulted_fraction(earth - sun, sun, earth) == 1.0          # just fully covered
    assert occulted_fraction(0.0, sun, earth) == 1.0                  # centred


def test_occulted_fraction_matches_a_known_overlap() -> None:
    # Two equal circles whose centres are one radius apart overlap by
    # 2/3 - sqrt(3) / (2 pi) of either circle's area.
    expected = 2 / 3 - math.sqrt(3) / (2 * math.pi)

    assert float(occulted_fraction(1.0, 1.0, 1.0)) == pytest.approx(expected)


def test_occulted_fraction_grows_as_the_discs_close() -> None:
    separation = np.linspace(1.3, 0.6, 20)
    covered = occulted_fraction(separation, 0.267, 0.95)

    assert np.all(np.diff(covered) >= 0)
    assert covered[0] == 0.0 and covered[-1] == 1.0


def test_angular_separation() -> None:
    assert float(angular_separation(10.0, 0.0, 40.0, 0.0)) == pytest.approx(30.0)
    assert float(angular_separation(0.0, 90.0, 123.0, 0.0)) == pytest.approx(90.0)
    assert float(angular_separation(350.0, 1.0, 10.0, 1.0)) == pytest.approx(20.0, abs=0.01)
