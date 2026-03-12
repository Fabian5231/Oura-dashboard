"""Oura API v2 → SQLite sync with incremental fetching."""

import os
from datetime import datetime, timedelta

import requests
from dotenv import load_dotenv

from . import database as db

load_dotenv()

TOKEN = os.environ.get("OURA_TOKEN", "")
BASE_URL = "https://api.ouraring.com/v2/usercollection"

# Endpoints to sync (mirrors oura_fetch.py)
SYNC_ENDPOINTS = [
    {"name": "daily_readiness",           "path": "daily_readiness",           "date_type": "date"},
    {"name": "daily_sleep",               "path": "daily_sleep",               "date_type": "date"},
    {"name": "daily_activity",            "path": "daily_activity",            "date_type": "date"},
    {"name": "daily_stress",              "path": "daily_stress",              "date_type": "date"},
    {"name": "daily_spo2",                "path": "daily_spo2",                "date_type": "date"},
    {"name": "daily_cardiovascular_age",  "path": "daily_cardiovascular_age",  "date_type": "date"},
    {"name": "daily_resilience",          "path": "daily_resilience",          "date_type": "date"},
    {"name": "sleep",                     "path": "sleep",                     "date_type": "date"},
    {"name": "heartrate",                 "path": "heartrate",                 "date_type": "datetime"},
]

UPSERT_MAP = {
    "daily_readiness": db.upsert_daily_readiness,
    "daily_sleep": db.upsert_daily_sleep,
    "daily_activity": db.upsert_daily_activity,
    "daily_stress": db.upsert_daily_stress,
    "daily_spo2": db.upsert_daily_spo2,
    "daily_cardiovascular_age": db.upsert_daily_cardiovascular_age,
    "daily_resilience": db.upsert_daily_resilience,
    "sleep": db.upsert_sleep,
    "heartrate": db.upsert_heartrate,
}


def _headers():
    return {"Authorization": f"Bearer {TOKEN}"}


def _fetch_paginated(endpoint: dict, start_date: str, end_date: str) -> list:
    url = f"{BASE_URL}/{endpoint['path']}"
    params = {}

    if endpoint["date_type"] == "date":
        params["start_date"] = start_date
        params["end_date"] = end_date
    elif endpoint["date_type"] == "datetime":
        params["start_datetime"] = f"{start_date}T00:00:00+00:00"
        params["end_datetime"] = f"{end_date}T23:59:59+00:00"

    all_data = []
    while True:
        resp = requests.get(url, headers=_headers(), params=params, timeout=30)
        if resp.status_code != 200:
            print(f"  [{endpoint['name']}] HTTP {resp.status_code}")
            break
        body = resp.json()
        data = body.get("data", [])
        all_data.extend(data)
        next_token = body.get("next_token")
        if next_token:
            params["next_token"] = next_token
        else:
            break
    return all_data


def _compute_start_date(endpoint_name: str) -> str:
    """Determine sync start: latest_day - 3 days (overlap) or 365 days back for first sync."""
    if endpoint_name == "heartrate":
        latest = db.get_latest_heartrate_timestamp()
        if latest:
            # Go back 3 days from latest timestamp
            latest_day = latest[:10]
            dt = datetime.strptime(latest_day, "%Y-%m-%d") - timedelta(days=3)
            return dt.strftime("%Y-%m-%d")
    else:
        latest = db.get_latest_day(endpoint_name)
        if latest:
            dt = datetime.strptime(latest, "%Y-%m-%d") - timedelta(days=3)
            return dt.strftime("%Y-%m-%d")

    # First sync: 365 days back
    return (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")


def run_sync() -> dict:
    """Run incremental sync for all endpoints. Returns summary."""
    if not TOKEN:
        return {"status": "error", "error": "OURA_TOKEN not set"}

    started = datetime.now().isoformat()
    total_records = 0
    end_date = datetime.now().strftime("%Y-%m-%d")

    # Log start
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO sync_log (started_at, status) VALUES (?, 'running')", (started,))
    log_id = cur.lastrowid
    conn.commit()
    conn.close()

    try:
        # Sync personal info (no date range)
        resp = requests.get(f"{BASE_URL}/personal_info", headers=_headers(), timeout=30)
        if resp.status_code == 200:
            db.upsert_personal_info(resp.json())
            total_records += 1

        # Sync dated endpoints
        for ep in SYNC_ENDPOINTS:
            start_date = _compute_start_date(ep["name"])
            print(f"  Syncing {ep['name']} from {start_date}...")
            records = _fetch_paginated(ep, start_date, end_date)
            if records:
                upsert_fn = UPSERT_MAP[ep["name"]]
                upsert_fn(records)
                total_records += len(records)
                print(f"    -> {len(records)} records")

        # Update log
        conn = db.get_conn()
        conn.execute(
            "UPDATE sync_log SET finished_at=?, status='success', records_synced=? WHERE id=?",
            (datetime.now().isoformat(), total_records, log_id))
        conn.commit()
        conn.close()

        return {"status": "success", "records_synced": total_records}

    except Exception as e:
        conn = db.get_conn()
        conn.execute(
            "UPDATE sync_log SET finished_at=?, status='error', error_message=? WHERE id=?",
            (datetime.now().isoformat(), str(e), log_id))
        conn.commit()
        conn.close()
        return {"status": "error", "error": str(e)}


def get_sync_status() -> dict | None:
    conn = db.get_conn()
    row = conn.execute("SELECT * FROM sync_log ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row) if row else None
