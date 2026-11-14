from math import radians


SOLAR_CONSTANT_W_PER_M2 = 1361.0
SUN_ANGULAR_RADIUS_RADIANS = radians(0.267)

# Temporary demo defaults. Replace after the mission power budget is defined.
DEFAULT_LOAD_W = 100.0
DEFAULT_BATTERY_CAPACITY_WH = 100.0
DEFAULT_PANEL_AREA_M2 = 1.0
DEFAULT_PANEL_EFFICIENCY = 0.3

# The model uses radians, so convert the 0.5-degree product threshold once here.
MARGINAL_COMMS_CLEARANCE_RADIANS = radians(0.5)

SUN_RADIUS_KM = 695_700.0
EARTH_RADIUS_KM = 6378.137
