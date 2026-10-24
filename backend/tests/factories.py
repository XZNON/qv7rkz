import pandas as pd


def make_runs(runs: dict[str, float], start: str, hours: int) -> pd.DataFrame:
    """Synthetic WINDFOR rows: each run (publish time -> flat MW) covers `hours` from `start`."""
    starts = pd.date_range(start, periods=hours, freq="h", tz="UTC")
    rows = [
        {"publish_time": pd.Timestamp(publish), "start_time": s, "generation_mw": value}
        for publish, value in runs.items()
        for s in starts
    ]
    return pd.DataFrame(rows)
