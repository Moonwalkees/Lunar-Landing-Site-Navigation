from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True)
class PowerMetrics:
    watt_hours_per_day: float
    percent_time_sunlit: float


@dataclass(frozen=True)
class BatteryResult:
    charge_wh: NDArray[np.float64]
    minimum_wh: float
    survives: bool
