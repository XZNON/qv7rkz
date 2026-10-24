"""Load the cached Elexon datasets written by scripts/fetch_data.py."""

import json
from functools import cache
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@cache
def load_forecasts() -> pd.DataFrame:
    """WINDFOR rows: publish_time, start_time (UTC), generation_mw. One row per run and hour."""
    df = pd.read_csv(DATA_DIR / "windfor.csv.gz")
    df["publish_time"] = pd.to_datetime(df["publish_time"], utc=True)
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    return df


@cache
def load_actuals() -> pd.DataFrame:
    """FUELHH WIND rows: start_time (UTC), settlement_date, settlement_period, generation_mw."""
    df = pd.read_csv(DATA_DIR / "fuelhh_wind.csv.gz")
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    return df


@cache
def load_manifest() -> dict:
    return json.loads((DATA_DIR / "manifest.json").read_text())
