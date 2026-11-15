from math import radians


SOLAR_CONSTANT_W_PER_M2 = 1361.0
SUN_ANGULAR_RADIUS_RADIANS = radians(0.267)

# Rover power defaults, taken from NASA's VIPER, the rover designed for solar power at the
# lunar south pole. Sources: NASA NTRS 20240013903 ("VIPER Rover Overview and Mobility and
# Hardware", LSIC 2024, slide 2) and NASA Science's VIPER In Depth page (Key Facts).
#
# Battery: "Battery capacity (start of life @ 0C): 5,420 W-hr".
DEFAULT_BATTERY_CAPACITY_WH = 5420.0
# Load: NASA gives no figure, only "50 hours survival in low power mode". 5420 Wh / 50 h.
# This is the low-power load, so "survives" means survives the dark while doing nothing else.
DEFAULT_LOAD_W = 108.0
# Panel: sized so that full Sun gives NASA's "peak power of 450 watts" at 30% efficiency
# (1361 * 1.1 * 0.3 = 449 W). The area is derived, not a published figure. VIPER states
# 320 W for one panel facing the Sun and 450 W with the Sun on a corner, lighting two.
DEFAULT_PANEL_AREA_M2 = 1.1
DEFAULT_PANEL_EFFICIENCY = 0.3

# The model uses radians, so convert the 0.5-degree product threshold once here.
MARGINAL_COMMS_CLEARANCE_RADIANS = radians(0.5)

SUN_RADIUS_KM = 695_700.0
EARTH_RADIUS_KM = 6378.137
