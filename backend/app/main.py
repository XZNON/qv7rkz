"""FastAPI application.

Serves the JSON API under /api. When STATIC_DIR points at the built frontend
(Docker image), it also serves the React app from the same origin.
"""

import os
from datetime import date, time
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app import schemas, views
from app.config import DEFAULT_CUTOFF, FIRST_DELIVERY_DAY, LAST_DELIVERY_DAY

app = FastAPI(title="Wind Forecast Decision Cockpit", version="0.1.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def cache_api_responses(request: Request, call_next) -> Response:
    """The data are static, so API responses can be cached by browsers and the CDN."""
    response = await call_next(request)
    if request.url.path.startswith("/api/") and response.status_code == 200:
        response.headers["Cache-Control"] = "public, max-age=3600"
    return response


def parse_cutoff(
    cutoff: Annotated[
        str,
        Query(
            pattern=r"^([01]\d|2[0-3]):[0-5]\d$",
            description="Decision time, HH:MM UK local time on the day before delivery",
        ),
    ] = DEFAULT_CUTOFF.strftime("%H:%M"),
) -> time:
    return time.fromisoformat(cutoff)


Cutoff = Annotated[time, Depends(parse_cutoff)]


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/meta", response_model=schemas.Meta)
def meta() -> schemas.Meta:
    return views.meta()


@app.get("/api/day", response_model=schemas.DayView)
def day(date: Annotated[date, Query(description="Delivery day, YYYY-MM-DD")], cutoff: Cutoff):
    if not FIRST_DELIVERY_DAY <= date <= LAST_DELIVERY_DAY:
        raise HTTPException(
            status_code=422,
            detail=f"Delivery day must be between {FIRST_DELIVERY_DAY} and {LAST_DELIVERY_DAY}.",
        )
    return views.day_view(date, cutoff)


@app.get("/api/scorecard", response_model=schemas.Scorecard)
def scorecard(cutoff: Cutoff) -> schemas.Scorecard:
    return views.scorecard(cutoff)


@app.get("/api/signals", response_model=schemas.SignalsReport)
def signals(cutoff: Cutoff) -> schemas.SignalsReport:
    return views.signals_report(cutoff)


# Registered last so /api routes take precedence over static files.
static_dir = os.environ.get("STATIC_DIR")
if static_dir and Path(static_dir).is_dir():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
