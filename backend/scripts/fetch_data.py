"""Fetch the Elexon wind datasets once and cache them in backend/data/.

The app never calls Elexon at runtime: January 2026 data are static, so they
are fetched here, trimmed to the columns the app uses, and committed.

Usage (from the repo root):
    python backend/scripts/fetch_data.py
"""

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# December 2025 is calibration history: the errors a trader had already seen
# when making January decisions. See docs/spec.md, section 3.2.
WINDOW_START = "2025-11-28"
WINDOW_END = "2026-02-02"

# Deterministic gzip output (fixed mtime) so file hashes only change with the data.
GZIP = {"method": "gzip", "mtime": 0}


def get_json(path: str, params: dict[str, str], attempts: int = 5) -> list[dict]:
    url = f"{BASE_URL}{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(url, timeout=120) as response:
                body = json.load(response)
            break
        except urllib.error.HTTPError as err:
            if err.code not in (429, 500, 502, 503, 504) or attempt == attempts:
                raise
        except urllib.error.URLError:
            if attempt == attempts:
                raise
        time.sleep(2**attempt)
    # Stream endpoints return a bare array; others wrap rows in "data".
    rows = body["data"] if isinstance(body, dict) else body
    print(f"  {len(rows):>6} rows  {url}")
    return rows


def fetch_windfor() -> tuple[pd.DataFrame, str]:
    params = {
        "publishDateTimeFrom": f"{WINDOW_START}T00:00:00Z",
        "publishDateTimeTo": f"{WINDOW_END}T00:00:00Z",
    }
    rows = get_json("/datasets/WINDFOR/stream", params)
    df = pd.DataFrame(rows)[["publishTime", "startTime", "generation"]]
    df.columns = ["publish_time", "start_time", "generation_mw"]
    df = df.drop_duplicates(["publish_time", "start_time"]).sort_values(
        ["publish_time", "start_time"]
    )
    return df, f"/datasets/WINDFOR/stream?{urllib.parse.urlencode(params)}"


def fetch_fuelhh() -> tuple[pd.DataFrame, str]:
    params = {
        "settlementDateFrom": WINDOW_START,
        "settlementDateTo": WINDOW_END,
        "fuelType": "WIND",
    }
    rows = get_json("/datasets/FUELHH/stream", params)
    df = pd.DataFrame(rows)
    df = df[df["fuelType"] == "WIND"]
    df = df[["startTime", "settlementDate", "settlementPeriod", "generation"]]
    df.columns = ["start_time", "settlement_date", "settlement_period", "generation_mw"]
    df = df.drop_duplicates(["start_time"]).sort_values("start_time")
    return df, f"/datasets/FUELHH/stream?{urllib.parse.urlencode(params)}"


def write(df: pd.DataFrame, name: str) -> dict:
    path = DATA_DIR / name
    df.to_csv(path, index=False, compression=GZIP)
    return {
        "file": name,
        "rows": len(df),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    print("Fetching from Elexon BMRS...")
    windfor, windfor_query = fetch_windfor()
    fuelhh, fuelhh_query = fetch_fuelhh()

    manifest = {
        "fetched_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "source": BASE_URL,
        "datasets": {
            "WINDFOR": {
                "query": windfor_query,
                "publish_time_range": [windfor.publish_time.min(), windfor.publish_time.max()],
                "runs": int(windfor.publish_time.nunique()),
                **write(windfor, "windfor.csv.gz"),
            },
            "FUELHH": {
                "query": fuelhh_query,
                "start_time_range": [fuelhh.start_time.min(), fuelhh.start_time.max()],
                **write(fuelhh, "fuelhh_wind.csv.gz"),
            },
        },
    }
    (DATA_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
