from dataclasses import dataclass


@dataclass(frozen=True)
class PowerMetrics:
    watt_hours_per_day: float
    percent_time_sunlit: float
