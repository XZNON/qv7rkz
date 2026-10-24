# Wind Forecast Decision Cockpit — Spec v1

Pilot web app for a UK utility's day-ahead purchasing team. It replays the national wind forecast the team could actually have seen at the day-ahead decision time, shows how far to trust it, and scores it against metered wind.

Source research: `reports/Wind forecast decision support features.md` (not committed).

---

## 1. Goals and non-goals

**Goals**

1. For any delivery day in scope, show the latest WINDFOR forecast published **before** the chosen decision time.
2. Turn that single number into a plan: bias-adjusted line, 80% range from past errors, plan-for low in the evening peak.
3. Quantify forecast accuracy for January 2026 (MAE, bias, WAPE, breakdowns).
4. Flag conditions that historically came with larger errors, and show the evidence for each flag.

**Non-goals**

- No forecasting model of our own. No ML.
- No live data feed. January 2026 data are static and cached.
- No data beyond Elexon WINDFOR and FUELHH (WIND). No prices, demand, capacity or weather in the app.
- No auth, no user accounts, no database.

---

## 2. Scope and conventions

| Item | Decision |
|---|---|
| Delivery days | **2 Jan 2026 – 1 Feb 2026** (decisions made on D-1, all in January) |
| Default decision time | **09:20 UK on D-1** (EPEX GB 60-min auction gate) |
| Presets | 09:20 (EPEX 60-min), 09:50 (N2EX), 15:30 (EPEX 30-min), plus custom HH:MM |
| Selection rule | For each delivery hour: forecast row with the latest `publishTime` **strictly before** the cutoff |
| Error sign | `error = forecast − actual`. Positive = over-forecast = buyer under-bought. Always shown in words too |
| Alignment | WINDFOR is hourly. Actual per hour = mean of the two FUELHH half-hours in that hour |
| Time zone | All logic in UTC, days and cutoffs defined in `Europe/London`. January = GMT = UTC, but code must not rely on it |
| Units | GW to 1 decimal in headlines and axes. MW with thousands separators in tooltips, tables, exports |
| Peak window | 16:00–19:00 UK (forecast hours starting 16:00, 17:00, 18:00) |
| Normalisation | WAPE (MAE ÷ mean actual). No capacity-based % (capacity is outside the allowed data) |

---

## 3. Data

### 3.1 Sources

| Dataset | Call | Notes |
|---|---|---|
| WINDFOR | `GET /datasets/WINDFOR/stream?publishDateTimeFrom=…&publishDateTimeTo=…` | Hourly, 8 runs/day, 73 rows/run. `from`/`to` are silently ignored — never use them |
| FUELHH | `GET /datasets/FUELHH/stream?settlementDateFrom=yyyy-MM-dd&settlementDateTo=…&fuelType=WIND` | Half-hourly average MW. Don't mix settlement and publish filters |

Base URL: `https://data.elexon.co.uk/bmrs/api/v1`. No key. Rows arrive newest-first as a bare JSON array.

Never use `/forecast/generation/wind/latest`: it ignores any cutoff and returns forecasts published after the fact.

### 3.2 Fetch window

- WINDFOR publish times: **2025-11-28 → 2026-02-02**
- FUELHH settlement dates: **2025-11-28 → 2026-02-02**

December 2025 is included only as **calibration history**: the errors a trader would already have seen when making January decisions. See open question Q1.

### 3.3 Storage

- `backend/scripts/fetch_data.py` fetches once, keeps only needed columns, de-duplicates on key, sorts, writes:
  - `backend/data/windfor.csv.gz` — `publish_time, start_time, generation_mw`
  - `backend/data/fuelhh_wind.csv.gz` — `start_time, settlement_date, settlement_period, generation_mw`
  - `backend/data/manifest.json` — fetch timestamp, query URLs, row counts, SHA-256 of each file
- Files are committed. The app never calls Elexon at runtime.
- Fetch script retries on HTTP 429/5xx with backoff.

### 3.4 Known data facts the code must handle

- Each run includes up to ~25.5 h of hours already past at publish time. Exclude negative lead times from accuracy stats.
- Publish schedule is irregular: 15 Jan 2026 has no 11:30 run and an extra 12:25 run. Never hard-code run times.
- WINDFOR sits ~1.7–1.9 GW above FUELHH on average, ~2.8 GW when forecast ≥ 15 GW. Likely curtailment plus coverage difference; not officially confirmed. The UI explains this in one tooltip and in the About panel.
- Both datasets exclude embedded (distribution-connected) wind.

---

## 4. Core logic (backend, pure functions, unit-tested)

### 4.1 Selection — `selection.py`

`select_forecast(forecasts, delivery_day, cutoff_local) -> DataFrame`

For each of the delivery day's hours (UK local day):

- `forecast_mw`, `publish_time` of the latest run with `publish_time < cutoff_utc`
- `lead_h` = `start_time − cutoff_utc` in hours
- `prev_forecast_mw`, `prev_publish_time` from the run immediately before it
- `revision_mw` = `forecast_mw − prev_forecast_mw`

Missing hour (no qualifying run) → row present with nulls, flagged; never silently dropped.

### 4.2 Alignment and errors — `metrics.py`

- `hourly_actuals(fuelhh)` → mean of the `hh:00` and `hh:30` half-hours. Hour with one half missing → null, not a half-value.
- `error_mw = forecast_mw − actual_mw`

### 4.3 Calibration — `calibration.py`

Rolling and look-ahead free. For decision day D-1 at cutoff `t`:

1. **Training set** = delivery days in `[D − 31, D − 2]` (all actuals known before the cutoff), each with its forecast selected by the **same cutoff time-of-day**.
2. Bin training hours by **forecast level**: `<5`, `5–10`, `10–15`, `≥15` GW.
3. Per bin: error quantiles `q10`, `q50`, `q90`, and `n`. If `n < 30`, merge with the adjacent bin; if still short, use all training hours.
4. For each delivery hour, using its bin:
   - `adjusted_mw = forecast_mw − q50`
   - `band_low_mw = max(0, forecast_mw − q90)`
   - `band_high_mw = max(0, forecast_mw − q10)`

   (Sign inversion: the actual's P10 is the forecast minus the error's P90.)

Output also carries `calibration = {train_from, train_to, n_hours, bins: […]}` for display.

### 4.4 Signals — `signals.py`

Computed per delivery hour from information available at the cutoff:

| Signal | Rule | Meaning shown to user |
|---|---|---|
| `high_wind` | `forecast_mw ≥ 15,000` | Over-forecast / curtailment risk |
| `steep_ramp` | \|forecast(h+3) − forecast(h)\| ≥ 3,000 MW | Timing risk |
| `big_revision` | \|`revision_mw`\| ≥ 1,000 | Forecast unstable between runs |
| `low_wind_peak` | `forecast_mw < 3,000` in the peak window | Price risk (not an error signal) |

**Back-test** over all January delivery days at the chosen cutoff: MAE and bias for flagged vs unflagged hours, `n_flagged`, ratio. A signal is labelled **"Backed by January data"** only if `n_flagged ≥ 24` and flagged MAE ≥ 1.2 × unflagged MAE. Otherwise **"Not confirmed"**, still displayed. Stretch: day-block bootstrap 90% CI on the MAE difference.

### 4.5 Scorecard — `metrics.py`

Over all in-scope delivery hours at the chosen cutoff (lead ≥ 0 only):

- MAE, bias, RMSE, WAPE, P90 absolute error, % hours within ±1 GW
- MAE of `adjusted_mw` vs raw (improvement %), 80%-band coverage (target ≈ 80%)
- By lead time (6 h buckets), by forecast level bin
- Daily table: date, mean forecast, mean actual, MAE, bias → worst 5 days
- Day × hour signed error matrix (could-have, for heatmap)

---

## 5. API (FastAPI)

All `GET`, JSON, Pydantic response models. Results cached per `(date, cutoff)` with `lru_cache`.

| Endpoint | Returns |
|---|---|
| `/api/health` | `{status: "ok"}` |
| `/api/meta` | Delivery-day range, presets, data manifest (fetch time, row counts), sources, conventions |
| `/api/day?date=2026-01-28&cutoff=09:20` | Hourly rows (§4.1 + §4.3 fields, `actual_mw`, `signals[]`), half-hourly actuals, peak tiles, day summary (GWh, MAE, bias), run used, calibration info |
| `/api/scorecard?cutoff=09:20` | §4.5 metrics and breakdowns |
| `/api/signals?cutoff=09:20` | §4.4 back-test results |
| `/api/evolution?start=2026-01-28T17:00Z` | Could-have: every run's forecast for one hour |

Validation: date outside scope or malformed cutoff → `422` with a readable message.

---

## 6. Frontend (React + Vite + TypeScript + Recharts + Tailwind)

State (`view`, `date`, `cutoff`, `actuals` toggle) lives in URL query params so every view is a shareable link. Dev server proxies `/api` to `localhost:8000`.

### 6.1 Decision Cockpit (default view) — Must

- **Controls:** delivery-day picker (2 Jan – 1 Feb), decision-time presets as a segmented control + custom time.
- **Provenance chip:** "Forecast as known at 09:20 Tue 27 Jan · run published 07:30 · 1 h 50 min old".
- **Headline sentence** (generated): e.g. "Evening peak: 12.4 GW expected (raw forecast 14.9 GW). Plan for at least 9.8 GW. Up 1.1 GW since the previous run."
- **Tiles:** peak-window expected (adjusted, raw beneath), plan-for low (min of `band_low` in peak), change since previous run in peak, daily energy (GWh).
- **Main chart** (UK time axis, 24 h):
  - Forecast at decision time — blue `#0072B2`, dashed
  - Bias-adjusted ("metered-equivalent") — blue, solid
  - 80% range — light blue area, labelled on the chart: "80% of past misses at this level fell inside this range"
  - Previous run — thin grey
  - Peak window — shaded background
  - Signal markers on flagged hours
  - **"Show what actually happened"** toggle: actual (black, solid, half-hourly) + gap fill (over-forecast vermilion `#D55E00`, under-forecast sky `#56B4E9`)
- **Tooltip:** UK time, settlement period, forecast, adjusted, range, actual, error in words, publish time, lead time.
- **Signals list** for the day, each linking to its back-test evidence.
- **Hourly table** (collapsible) + CSV download — Could.

### 6.2 January Scorecard — Must

- KPI tiles: typical miss (MAE), bias in words, WAPE, 1-in-10 miss (P90), % within ±1 GW, range coverage, adjusted-line improvement.
- Daily MAE/bias bars — click a day → opens the cockpit for that day.
- Error by lead time; error and bias by forecast level.
- Signals back-test table (`/api/signals`).
- Day × hour heatmap (CSS grid) — Could. Forecast vs actual scatter — Could.
- Chart titles state the takeaway ("Forecasts were too high on 27 of 31 days").

### 6.3 About the data (drawer) — Must

What each dataset covers, the selection rule, alignment, sign convention, the structural gap and its likely cause, small-sample caveat (one month < IEA 90-day guidance), data fetch time and source links.

### 6.4 UI rules

- One colour = one meaning everywhere (Okabe-Ito). Colour always paired with line style; ≥ 3:1 contrast.
- "Actual (metered)", not "FUELHH WIND". Dataset codes only in the About drawer.
- Max 2–4 annotations per chart.
- Skeleton placeholders while loading; readable error state if the API fails.
- Usable at laptop width; tables scroll horizontally on narrow screens.

---

## 7. Repository layout

```
/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, routes, static file serving (Docker)
│   │   ├── data.py          # load cached CSVs
│   │   ├── selection.py     # as-of forecast selection
│   │   ├── metrics.py       # alignment, errors, scorecard
│   │   ├── calibration.py   # rolling bands + adjusted line
│   │   ├── signals.py       # flags + back-test
│   │   └── schemas.py       # Pydantic response models
│   ├── data/                # cached Elexon data + manifest.json
│   ├── scripts/fetch_data.py
│   └── tests/
├── frontend/                # Vite + React + TS
├── api/index.py             # Vercel Python entry, re-exports backend app
├── requirements.txt         # Python deps (Vercel + Docker)
├── vercel.json
├── Dockerfile               # multi-stage: build frontend, serve with FastAPI
├── docker-compose.yml
├── .github/workflows/ci.yml # pytest + ruff + frontend typecheck/build
├── docs/spec.md
└── README.md
```

`.gitignore` excludes `research_notes/`, `reports/`, `.claude/`, the assignment `.docx`, `node_modules/`, `dist/`, `__pycache__/`, `.venv/`.

---

## 8. Deployment and Docker

- **Live:** Vercel. Frontend built as static files; `api/index.py` runs FastAPI as a Python function; `vercel.json` rewrites `/api/*` to it and includes `backend/data/**` in the function bundle.
- **Docker:** one multi-stage image (Node builds the frontend → `python:3.12-slim` serves API + static files). `docker compose up` → app on `http://localhost:8000`. Same code path as Vercel except static serving.
- `tzdata` in requirements (slim images and serverless lack a system tz database).
- **De-risk early:** deploy the skeleton (health endpoint + placeholder page) to Vercel in the first build session, before features. Risk: pandas bundle size / cold start on Vercel. Fallback: precompute preset cutoffs to JSON at build time.
- Final check: open the live URL, repo and video in an incognito window.

---

## 9. Testing and practices

**Backend (pytest) — required cases**

- Selection uses strictly-before: a run stamped exactly at 15:30 is excluded at a 15:30 cutoff.
- 15 Jan 2026: missing 11:30 run handled, 12:25 run selected where appropriate.
- Decision on 31 Dec / delivery 1 Jan boundary and delivery 1 Feb.
- Negative-lead rows excluded from metrics.
- Hourly alignment = mean of two half-hours; one missing half → null.
- Band arithmetic: low = forecast − q90, high = forecast − q10, clipped at 0.
- Calibration never uses delivery days ≥ D-1 (look-ahead test).
- Metrics on a small hand-computed fixture.
- API: happy path + 422 cases.

**Frontend:** typecheck + build in CI; formatter unit tests (GW/MW/time) with Vitest — Could.

**Practices:** small modules with pure functions; typed API contracts (Pydantic ↔ TS types); ruff; CI on every push; README covers layout, run, deploy link, AI-tools disclosure.

---

## 10. Build plan (16 h cap)

| # | Block | Est. |
|---|---|---|
| 1 | Repo skeleton, Vite + FastAPI hello world, Dockerfile, **early Vercel deploy** | 1.5 h |
| 2 | Fetch script + cached data + manifest | 1.0 h |
| 3 | Selection + alignment + tests | 1.5 h |
| 4 | Calibration + metrics + signals + tests | 2.5 h |
| 5 | API endpoints + schemas | 1.0 h |
| 6 | Decision Cockpit | 3.0 h |
| 7 | Scorecard + About drawer | 2.0 h |
| 8 | Final deploy, CI, README | 1.5 h |
| 9 | Video: script + record | 1.5 h |
| — | Buffer | 0.5 h |
| | **Total** | **16.0 h** |

Could-haves (heatmap, evolution, CSV, scatter, bootstrap CIs) only if blocks 1–8 finish early.

---

## 11. Demo story (video outline)

**Part 1 — client pitch (≤ 5 min)**

1. Problem in one line: you buy tomorrow's power at 09:20 today, betting on a wind forecast.
2. Open the cockpit on **28 Jan**: what you saw at 09:20 — forecast, range, plan-for low.
3. Click "Show what actually happened": 11.1 GW forecast vs 5.8 GW actual.
4. **12 Jan**: windy day, 19.3 GW forecast vs 14.5 GW actual → the structural gap. Adjusted line shows what turned up.
5. Scorecard: typical miss, 27 of 31 days too high, range coverage.
6. Signals: what to watch, honestly labelled ("backed by data" vs "not confirmed").
7. Close: next steps (longer history, adding curtailment data, live feed).

**Part 2 — tech lead (≤ 5 min)**

1. Architecture diagram: cached data → pure-function core → FastAPI → React; Vercel + Docker.
2. As-of selection rule and its tests (15 Jan, 15:30 boundary).
3. Alignment, sign convention, look-ahead-free calibration.
4. Code tour: module layout, typed contracts, CI.
5. Trade-offs and what I'd do next.

---

## 12. Open questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Use December 2025 as calibration history, given the brief says "data relevant only for purchase decisions in January 2026"? | **Yes.** It is exactly what a trader would have known when deciding in January. State it in README and About panel. Fallback: expanding window within January only (weak early in the month) |
| Q2 | Headline number: raw or adjusted forecast? | Show both. Tiles lead with adjusted ("expected metered wind"), raw directly beneath |
| Q3 | Include custom decision time or presets only? | Include custom; it is cheap once selection is a function of cutoff |
| Q4 | Repo name | Random string, e.g. `qv7rkz` |
