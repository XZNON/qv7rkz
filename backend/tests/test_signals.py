from datetime import date

import pandas as pd

from app.signals import backtest, flag_signals

DAY = date(2026, 1, 20)


def day_frame(forecasts: list[float], revisions: list[float] | None = None) -> pd.DataFrame:
    hours = len(forecasts)
    return pd.DataFrame(
        {
            "start_time": pd.date_range("2026-01-20T00:00Z", periods=hours, freq="h"),
            "delivery_day": DAY,
            "forecast_mw": forecasts,
            "revision_mw": revisions if revisions is not None else [0.0] * hours,
        }
    )


def test_high_wind_and_big_revision_flags() -> None:
    out = flag_signals(day_frame([14_999, 15_000], revisions=[-999, 1_000]))

    assert list(out["sig_high_wind"]) == [False, True]
    assert list(out["sig_big_revision"]) == [False, True]


def test_steep_ramp_flags_every_hour_within_three_hours_of_a_big_step() -> None:
    # 3 GW step between hours 3 and 4: any 3-hour window spanning it qualifies.
    out = flag_signals(day_frame([5_000.0] * 4 + [8_000.0] * 4))

    assert list(out["sig_steep_ramp"]) == [False, True, True, True, True, True, True, False]


def test_low_wind_only_flags_evening_peak_hours() -> None:
    out = flag_signals(day_frame([2_000.0] * 24))

    flagged_hours = out.loc[out["sig_low_wind_peak"], "start_time"].dt.hour.tolist()
    assert flagged_hours == [16, 17, 18]


def scored(errors_flagged: list[float], errors_other: list[float]) -> pd.DataFrame:
    n_flagged, n_other = len(errors_flagged), len(errors_other)
    df = pd.DataFrame({"error_mw": errors_flagged + errors_other})
    df["sig_high_wind"] = [True] * n_flagged + [False] * n_other
    for key in ("steep_ramp", "big_revision", "low_wind_peak"):
        df[f"sig_{key}"] = False
    return df


def verdicts(df: pd.DataFrame) -> dict[str, str]:
    return {r["key"]: r["verdict"] for r in backtest(df)}


def test_signal_is_backed_when_flagged_hours_have_clearly_larger_errors() -> None:
    result = verdicts(scored([3_000.0] * 24, [1_000.0] * 100))

    assert result["high_wind"] == "backed"
    assert result["steep_ramp"] == "not_confirmed"
    assert result["low_wind_peak"] == "price_risk"


def test_signal_is_not_confirmed_with_too_few_flagged_hours() -> None:
    assert verdicts(scored([3_000.0] * 23, [1_000.0] * 100))["high_wind"] == "not_confirmed"


def test_signal_is_not_confirmed_when_errors_are_similar() -> None:
    assert verdicts(scored([1_100.0] * 50, [1_000.0] * 100))["high_wind"] == "not_confirmed"
