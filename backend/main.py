"""FastAPI backend for the Oura Ring Dashboard."""

import asyncio
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, Query, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from . import database as db
from . import oura_sync

app = FastAPI(title="Oura Dashboard")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


# Disable caching for static files during development
class NoCacheStaticMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response

app.add_middleware(NoCacheStaticMiddleware)

# Serve static frontend files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Track background sync
_sync_running = False
_scheduler_task: asyncio.Task | None = None


def _default_range(start: str | None, end: str | None) -> tuple[str, str]:
    """Default to last 30 days if not specified."""
    if not end:
        end = datetime.now().strftime("%Y-%m-%d")
    if not start:
        start = (datetime.strptime(end, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")
    return start, end


# ── Startup & Scheduler ─────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    db.init_db()

    # Import existing JSON data if DB is empty
    date_range = db.get_date_range()
    if date_range["min_day"] is None:
        data_dir = Path(__file__).resolve().parent.parent / "oura_data"
        if data_dir.exists():
            print("Importing existing JSON data into SQLite...")
            db.import_from_json(data_dir)
            print("Import complete.")

    # Start periodic sync scheduler
    _start_scheduler()


def _background_sync():
    global _sync_running
    _sync_running = True
    try:
        print("Starting background sync...")
        result = oura_sync.run_sync()
        print(f"Sync finished: {result}")
    finally:
        _sync_running = False


def _get_sync_interval() -> int:
    """Return sync interval in minutes from settings (0 = disabled)."""
    val = db.get_setting("sync_interval", "360")  # default 6h
    return int(val)


async def _sync_scheduler():
    """Periodically run sync based on configured interval."""
    # Run one initial sync on startup
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _background_sync)

    while True:
        interval = _get_sync_interval()
        if interval <= 0:
            # Disabled — check again in 60s whether it's been re-enabled
            await asyncio.sleep(60)
            continue
        await asyncio.sleep(interval * 60)
        if not _sync_running:
            await loop.run_in_executor(None, _background_sync)


def _start_scheduler():
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
    _scheduler_task = asyncio.create_task(_sync_scheduler())


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
async def index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/data")
async def data_page():
    return FileResponse(str(FRONTEND_DIR / "data.html"))


@app.get("/api/data-days")
async def data_days():
    return db.get_data_days()


@app.get("/api/personal-info")
async def personal_info():
    data = db.get_personal_info()
    return data or {}


@app.get("/api/date-range")
async def date_range():
    return db.get_date_range()


@app.get("/api/overview")
async def overview():
    return db.get_overview()


@app.get("/api/scores")
async def scores(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    return db.get_latest_scores(start, end)


@app.get("/api/daily-scores")
async def daily_scores(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_daily_scores(start, end)


@app.get("/api/sleep-stages")
async def sleep_stages(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_sleep_stages(start, end)


@app.get("/api/hr-hrv")
async def hr_hrv(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_hr_hrv(start, end)


@app.get("/api/steps")
async def steps(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_steps(start, end)


@app.get("/api/stress")
async def stress(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_stress(start, end)


@app.get("/api/spo2")
async def spo2(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_spo2(start, end)


@app.get("/api/cardiovascular-age")
async def cardiovascular_age():
    return db.get_cardiovascular_age()


@app.get("/api/calories")
async def calories(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_calories(start, end)


@app.get("/api/sleep-efficiency")
async def sleep_efficiency(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_sleep_efficiency(start, end)


@app.get("/api/heartrate")
async def heartrate(date: str | None = Query(None)):
    if not date:
        # Default to most recent day with HR data
        ts = db.get_latest_heartrate_timestamp()
        date = ts[:10] if ts else datetime.now().strftime("%Y-%m-%d")
    return db.get_heartrate(date)


@app.get("/api/heartrate-daily")
async def heartrate_daily(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    start, end = _default_range(start, end)
    return db.get_heartrate_daily(start, end)


@app.post("/api/sync")
async def trigger_sync(background_tasks: BackgroundTasks):
    global _sync_running
    if _sync_running:
        return {"status": "already_running"}
    background_tasks.add_task(_background_sync)
    return {"status": "started"}


@app.post("/api/sync/full")
async def trigger_full_sync(background_tasks: BackgroundTasks):
    global _sync_running
    if _sync_running:
        return {"status": "already_running"}

    def _bg():
        global _sync_running
        _sync_running = True
        try:
            print("Starting FULL sync...")
            result = oura_sync.run_full_sync()
            print(f"Full sync finished: {result}")
        finally:
            _sync_running = False

    background_tasks.add_task(_bg)
    return {"status": "started"}


@app.get("/api/sync/status")
async def sync_status():
    global _sync_running
    status = oura_sync.get_sync_status()
    return {
        "running": _sync_running,
        "last_sync": status,
    }


@app.get("/api/sync/interval")
async def get_sync_interval():
    val = db.get_setting("sync_interval", "360")
    return {"interval": int(val)}


class SyncIntervalBody(BaseModel):
    interval: int


@app.post("/api/sync/interval")
async def set_sync_interval(body: SyncIntervalBody):
    db.set_setting("sync_interval", str(body.interval))
    _start_scheduler()
    return {"interval": body.interval}
