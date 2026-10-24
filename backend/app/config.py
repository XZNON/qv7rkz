"""Scope, conventions and thresholds. Single source of truth; see docs/spec.md."""

from datetime import date, time
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")

# Purchase decisions made in January 2026 are for delivery days 2 Jan - 1 Feb.
FIRST_DELIVERY_DAY = date(2026, 1, 2)
LAST_DELIVERY_DAY = date(2026, 2, 1)

# Day-ahead gate closures on D-1, UK local time.
PRESET_CUTOFFS = {
    "EPEX 60-min auction": time(9, 20),
    "N2EX auction": time(9, 50),
    "EPEX 30-min auction": time(15, 30),
}
DEFAULT_CUTOFF = time(9, 20)

# Evening peak: forecast hours starting 16:00, 17:00 and 18:00 UK time.
PEAK_HOURS = (16, 17, 18)

# Calibration: errors from the 30 delivery days settled before the decision,
# grouped by forecast level. Small groups borrow from neighbours.
CALIBRATION_DAYS = 30
LEVEL_EDGES_MW = (0, 5_000, 10_000, 15_000)
LEVEL_LABELS = ("Below 5 GW", "5-10 GW", "10-15 GW", "15 GW and above")
MIN_BIN_HOURS = 30

# Signals visible at the decision time.
HIGH_WIND_MW = 15_000
RAMP_MW = 3_000
RAMP_HOURS = 3
BIG_REVISION_MW = 1_000
LOW_WIND_MW = 3_000

# A signal counts as backed by the data if flagged hours had clearly larger errors.
SIGNAL_MIN_FLAGGED_HOURS = 24
SIGNAL_MIN_MAE_RATIO = 1.2
