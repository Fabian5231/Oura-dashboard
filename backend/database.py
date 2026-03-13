"""SQLite schema, upsert helpers, and query functions for the Oura dashboard."""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "oura.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── Schema ───────────────────────────────────────────────────────────────────

def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS personal_info (
            id TEXT PRIMARY KEY,
            age INTEGER,
            weight REAL,
            height REAL,
            biological_sex TEXT,
            email TEXT
        );

        CREATE TABLE IF NOT EXISTS daily_readiness (
            day TEXT PRIMARY KEY,
            score INTEGER,
            temperature_deviation REAL,
            contributors TEXT  -- JSON
        );

        CREATE TABLE IF NOT EXISTS daily_sleep (
            day TEXT PRIMARY KEY,
            score INTEGER,
            contributors TEXT  -- JSON
        );

        CREATE TABLE IF NOT EXISTS daily_activity (
            day TEXT PRIMARY KEY,
            score INTEGER,
            active_calories INTEGER,
            total_calories INTEGER,
            steps INTEGER,
            equivalent_walking_distance REAL,
            high_activity_time INTEGER,
            medium_activity_time INTEGER,
            low_activity_time INTEGER,
            sedentary_time INTEGER,
            resting_time INTEGER,
            non_wear_time INTEGER,
            target_calories INTEGER,
            target_meters REAL,
            contributors TEXT,  -- JSON
            met TEXT            -- JSON
        );

        CREATE TABLE IF NOT EXISTS daily_stress (
            day TEXT PRIMARY KEY,
            stress_high INTEGER,
            recovery_high INTEGER,
            day_summary TEXT
        );

        CREATE TABLE IF NOT EXISTS daily_spo2 (
            day TEXT PRIMARY KEY,
            spo2_average REAL,
            breathing_disturbance_index REAL
        );

        CREATE TABLE IF NOT EXISTS daily_cardiovascular_age (
            day TEXT PRIMARY KEY,
            vascular_age INTEGER
        );

        CREATE TABLE IF NOT EXISTS daily_resilience (
            day TEXT PRIMARY KEY,
            level TEXT,
            contributors TEXT  -- JSON
        );

        CREATE TABLE IF NOT EXISTS sleep (
            id TEXT PRIMARY KEY,
            day TEXT,
            type TEXT,
            bedtime_start TEXT,
            bedtime_end TEXT,
            total_sleep_duration INTEGER,
            deep_sleep_duration INTEGER,
            light_sleep_duration INTEGER,
            rem_sleep_duration INTEGER,
            awake_time INTEGER,
            efficiency INTEGER,
            latency INTEGER,
            lowest_heart_rate INTEGER,
            average_heart_rate REAL,
            average_hrv INTEGER,
            average_breath REAL,
            restless_periods INTEGER,
            time_in_bed INTEGER,
            heart_rate TEXT,  -- JSON
            hrv TEXT          -- JSON
        );
        CREATE INDEX IF NOT EXISTS idx_sleep_day ON sleep(day);

        CREATE TABLE IF NOT EXISTS heartrate (
            timestamp TEXT PRIMARY KEY,
            bpm INTEGER,
            source TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_hr_day ON heartrate(substr(timestamp, 1, 10));

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT,
            finished_at TEXT,
            status TEXT,
            records_synced INTEGER DEFAULT 0,
            error_message TEXT
        );
    """)
    conn.close()


# ── Upsert helpers ───────────────────────────────────────────────────────────

def upsert_personal_info(data: dict):
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO personal_info (id, age, weight, height, biological_sex, email) VALUES (?,?,?,?,?,?)",
        (data.get("id"), data.get("age"), data.get("weight"), data.get("height"),
         data.get("biological_sex"), data.get("email")),
    )
    conn.commit()
    conn.close()


def upsert_daily_readiness(records: list):
    conn = get_conn()
    conn.executemany(
        "INSERT OR REPLACE INTO daily_readiness (day, score, temperature_deviation, contributors) VALUES (?,?,?,?)",
        [(r["day"], r.get("score"), r.get("temperature_deviation"),
          json.dumps(r.get("contributors"))) for r in records],
    )
    conn.commit()
    conn.close()


def upsert_daily_sleep(records: list):
    conn = get_conn()
    conn.executemany(
        "INSERT OR REPLACE INTO daily_sleep (day, score, contributors) VALUES (?,?,?)",
        [(r["day"], r.get("score"), json.dumps(r.get("contributors"))) for r in records],
    )
    conn.commit()
    conn.close()


def upsert_daily_activity(records: list):
    conn = get_conn()
    conn.executemany(
        """INSERT OR REPLACE INTO daily_activity
           (day, score, active_calories, total_calories, steps,
            equivalent_walking_distance, high_activity_time, medium_activity_time,
            low_activity_time, sedentary_time, resting_time, non_wear_time,
            target_calories, target_meters, contributors, met)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(r["day"], r.get("score"), r.get("active_calories"), r.get("total_calories"),
          r.get("steps"), r.get("equivalent_walking_distance"),
          r.get("high_activity_time"), r.get("medium_activity_time"),
          r.get("low_activity_time"), r.get("sedentary_time"),
          r.get("resting_time"), r.get("non_wear_time"),
          r.get("target_calories"), r.get("target_meters"),
          json.dumps(r.get("contributors")), json.dumps(r.get("met")))
         for r in records],
    )
    conn.commit()
    conn.close()


def upsert_daily_stress(records: list):
    conn = get_conn()
    conn.executemany(
        "INSERT OR REPLACE INTO daily_stress (day, stress_high, recovery_high, day_summary) VALUES (?,?,?,?)",
        [(r["day"], r.get("stress_high"), r.get("recovery_high"), r.get("day_summary"))
         for r in records],
    )
    conn.commit()
    conn.close()


def upsert_daily_spo2(records: list):
    conn = get_conn()
    conn.executemany(
        "INSERT OR REPLACE INTO daily_spo2 (day, spo2_average, breathing_disturbance_index) VALUES (?,?,?)",
        [(r["day"],
          r.get("spo2_percentage", {}).get("average") if isinstance(r.get("spo2_percentage"), dict) else None,
          r.get("breathing_disturbance_index"))
         for r in records],
    )
    conn.commit()
    conn.close()


def upsert_daily_cardiovascular_age(records: list):
    conn = get_conn()
    conn.executemany(
        "INSERT OR REPLACE INTO daily_cardiovascular_age (day, vascular_age) VALUES (?,?)",
        [(r["day"], r.get("vascular_age")) for r in records],
    )
    conn.commit()
    conn.close()


def upsert_daily_resilience(records: list):
    conn = get_conn()
    conn.executemany(
        "INSERT OR REPLACE INTO daily_resilience (day, level, contributors) VALUES (?,?,?)",
        [(r["day"], r.get("level"), json.dumps(r.get("contributors"))) for r in records],
    )
    conn.commit()
    conn.close()


def upsert_sleep(records: list):
    conn = get_conn()
    conn.executemany(
        """INSERT OR REPLACE INTO sleep
           (id, day, type, bedtime_start, bedtime_end, total_sleep_duration,
            deep_sleep_duration, light_sleep_duration, rem_sleep_duration,
            awake_time, efficiency, latency, lowest_heart_rate, average_heart_rate,
            average_hrv, average_breath, restless_periods, time_in_bed,
            heart_rate, hrv)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(r.get("id"), r.get("day"), r.get("type"),
          r.get("bedtime_start"), r.get("bedtime_end"),
          r.get("total_sleep_duration"), r.get("deep_sleep_duration"),
          r.get("light_sleep_duration"), r.get("rem_sleep_duration"),
          r.get("awake_time"), r.get("efficiency"), r.get("latency"),
          r.get("lowest_heart_rate"), r.get("average_heart_rate"),
          r.get("average_hrv"), r.get("average_breath"),
          r.get("restless_periods"), r.get("time_in_bed"),
          json.dumps(r.get("heart_rate")), json.dumps(r.get("hrv")))
         for r in records],
    )
    conn.commit()
    conn.close()


def upsert_heartrate(records: list):
    if not records:
        return
    conn = get_conn()
    # Batch insert in chunks for performance
    batch_size = 500
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        conn.executemany(
            "INSERT OR REPLACE INTO heartrate (timestamp, bpm, source) VALUES (?,?,?)",
            [(r["timestamp"], r["bpm"], r.get("source")) for r in batch],
        )
    conn.commit()
    conn.close()


# ── Query helpers ────────────────────────────────────────────────────────────

def _rows_to_dicts(rows) -> list[dict]:
    return [dict(r) for r in rows]


def get_personal_info() -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM personal_info LIMIT 1").fetchone()
    conn.close()
    return dict(row) if row else None


def get_latest_scores(start: str | None = None, end: str | None = None) -> dict:
    conn = get_conn()
    if start and end:
        readiness = conn.execute("SELECT day, score FROM daily_readiness WHERE day BETWEEN ? AND ? ORDER BY day DESC LIMIT 1", (start, end)).fetchone()
        sleep = conn.execute("SELECT day, score FROM daily_sleep WHERE day BETWEEN ? AND ? ORDER BY day DESC LIMIT 1", (start, end)).fetchone()
        activity = conn.execute("SELECT day, score FROM daily_activity WHERE day BETWEEN ? AND ? ORDER BY day DESC LIMIT 1", (start, end)).fetchone()
        sleep_detail = conn.execute(
            "SELECT day, total_sleep_duration, lowest_heart_rate, average_hrv FROM sleep WHERE type='long_sleep' AND day BETWEEN ? AND ? ORDER BY day DESC LIMIT 1",
            (start, end)).fetchone()
    else:
        readiness = conn.execute("SELECT day, score FROM daily_readiness ORDER BY day DESC LIMIT 1").fetchone()
        sleep = conn.execute("SELECT day, score FROM daily_sleep ORDER BY day DESC LIMIT 1").fetchone()
        activity = conn.execute("SELECT day, score FROM daily_activity ORDER BY day DESC LIMIT 1").fetchone()
        sleep_detail = conn.execute(
            "SELECT day, total_sleep_duration, lowest_heart_rate, average_hrv FROM sleep WHERE type='long_sleep' ORDER BY day DESC LIMIT 1"
        ).fetchone()
    conn.close()
    return {
        "readiness": dict(readiness) if readiness else None,
        "sleep": dict(sleep) if sleep else None,
        "activity": dict(activity) if activity else None,
        "sleep_detail": dict(sleep_detail) if sleep_detail else None,
    }


def get_daily_scores(start: str, end: str) -> dict:
    conn = get_conn()
    readiness = _rows_to_dicts(conn.execute(
        "SELECT day, score FROM daily_readiness WHERE day BETWEEN ? AND ? ORDER BY day", (start, end)).fetchall())
    sleep = _rows_to_dicts(conn.execute(
        "SELECT day, score FROM daily_sleep WHERE day BETWEEN ? AND ? ORDER BY day", (start, end)).fetchall())
    activity = _rows_to_dicts(conn.execute(
        "SELECT day, score FROM daily_activity WHERE day BETWEEN ? AND ? ORDER BY day", (start, end)).fetchall())
    conn.close()
    return {"readiness": readiness, "sleep": sleep, "activity": activity}


def get_sleep_stages(start: str, end: str) -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        """SELECT day, deep_sleep_duration, light_sleep_duration, rem_sleep_duration, awake_time
           FROM sleep WHERE type='long_sleep' AND day BETWEEN ? AND ? ORDER BY day""",
        (start, end)).fetchall())
    conn.close()
    return rows


def get_hr_hrv(start: str, end: str) -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        """SELECT day, lowest_heart_rate, average_hrv
           FROM sleep WHERE type='long_sleep' AND day BETWEEN ? AND ? ORDER BY day""",
        (start, end)).fetchall())
    conn.close()
    return rows


def get_steps(start: str, end: str) -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        "SELECT day, steps FROM daily_activity WHERE day BETWEEN ? AND ? ORDER BY day",
        (start, end)).fetchall())
    conn.close()
    return rows


def get_stress(start: str, end: str) -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        "SELECT day, stress_high, recovery_high, day_summary FROM daily_stress WHERE day BETWEEN ? AND ? ORDER BY day",
        (start, end)).fetchall())
    conn.close()
    return rows


def get_spo2(start: str, end: str) -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        "SELECT day, spo2_average, breathing_disturbance_index FROM daily_spo2 WHERE day BETWEEN ? AND ? ORDER BY day",
        (start, end)).fetchall())
    conn.close()
    return rows


def get_cardiovascular_age() -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        "SELECT day, vascular_age FROM daily_cardiovascular_age ORDER BY day").fetchall())
    conn.close()
    return rows


def get_calories(start: str, end: str) -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        "SELECT day, active_calories, total_calories FROM daily_activity WHERE day BETWEEN ? AND ? ORDER BY day",
        (start, end)).fetchall())
    conn.close()
    return rows


def get_sleep_efficiency(start: str, end: str) -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        "SELECT day, efficiency FROM sleep WHERE type='long_sleep' AND day BETWEEN ? AND ? ORDER BY day",
        (start, end)).fetchall())
    conn.close()
    return rows


def get_heartrate(date: str) -> list[dict]:
    conn = get_conn()
    rows = _rows_to_dicts(conn.execute(
        "SELECT timestamp, bpm, source FROM heartrate WHERE substr(timestamp, 1, 10) = ? ORDER BY timestamp",
        (date,)).fetchall())
    conn.close()
    return rows


def get_date_range() -> dict:
    """Return earliest and latest day across main tables."""
    conn = get_conn()
    row = conn.execute("""
        SELECT MIN(day) as min_day, MAX(day) as max_day FROM (
            SELECT day FROM daily_activity
            UNION ALL SELECT day FROM daily_readiness
            UNION ALL SELECT day FROM daily_sleep
        )
    """).fetchone()
    conn.close()
    if row and row["min_day"]:
        return {"min_day": row["min_day"], "max_day": row["max_day"]}
    return {"min_day": None, "max_day": None}


def get_overview() -> dict:
    """Return first/last entry and record count for each main table."""
    conn = get_conn()
    tables = {
        "Readiness": "daily_readiness",
        "Schlaf": "daily_sleep",
        "Aktivität": "daily_activity",
        "Stress": "daily_stress",
        "SpO2": "daily_spo2",
        "Kardio-Alter": "daily_cardiovascular_age",
        "Schlaf-Detail": "sleep",
        "Herzfrequenz": "heartrate",
    }
    categories = []
    for label, table in tables.items():
        if table == "heartrate":
            row = conn.execute(
                "SELECT MIN(substr(timestamp,1,10)) as first_day, MAX(substr(timestamp,1,10)) as last_day, COUNT(*) as count FROM heartrate"
            ).fetchone()
        else:
            row = conn.execute(
                f"SELECT MIN(day) as first_day, MAX(day) as last_day, COUNT(*) as count FROM {table}"
            ).fetchone()
        if row and row["first_day"]:
            categories.append({
                "label": label,
                "first_day": row["first_day"],
                "last_day": row["last_day"],
                "count": row["count"],
            })
    conn.close()

    # Overall range
    overall_first = min((c["first_day"] for c in categories), default=None)
    overall_last = max((c["last_day"] for c in categories), default=None)
    total_days = 0
    if overall_first and overall_last:
        from datetime import datetime
        d1 = datetime.strptime(overall_first, "%Y-%m-%d")
        d2 = datetime.strptime(overall_last, "%Y-%m-%d")
        total_days = (d2 - d1).days + 1

    return {
        "overall_first": overall_first,
        "overall_last": overall_last,
        "total_days": total_days,
        "categories": categories,
    }


def get_data_days() -> list[dict]:
    """Return all unique days that have data, with info about which categories are present."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT day,
               MAX(has_readiness) as has_readiness,
               MAX(has_sleep) as has_sleep,
               MAX(has_activity) as has_activity,
               MAX(has_stress) as has_stress,
               MAX(has_spo2) as has_spo2,
               MAX(has_hr) as has_hr
        FROM (
            SELECT day, 1 as has_readiness, 0 as has_sleep, 0 as has_activity, 0 as has_stress, 0 as has_spo2, 0 as has_hr FROM daily_readiness
            UNION ALL SELECT day, 0, 1, 0, 0, 0, 0 FROM daily_sleep
            UNION ALL SELECT day, 0, 0, 1, 0, 0, 0 FROM daily_activity
            UNION ALL SELECT day, 0, 0, 0, 1, 0, 0 FROM daily_stress
            UNION ALL SELECT day, 0, 0, 0, 0, 1, 0 FROM daily_spo2
            UNION ALL SELECT substr(timestamp, 1, 10) as day, 0, 0, 0, 0, 0, 1 FROM heartrate
        )
        GROUP BY day
        ORDER BY day
    """).fetchall()
    conn.close()
    return _rows_to_dicts(rows)


def get_setting(key: str, default: str | None = None) -> str | None:
    conn = get_conn()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key: str, value: str):
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()


def get_latest_day(table: str) -> str | None:
    """Get the most recent day value from a given table."""
    conn = get_conn()
    row = conn.execute(f"SELECT MAX(day) as day FROM {table}").fetchone()
    conn.close()
    return row["day"] if row else None


def get_latest_heartrate_timestamp() -> str | None:
    conn = get_conn()
    row = conn.execute("SELECT MAX(timestamp) as ts FROM heartrate").fetchone()
    conn.close()
    return row["ts"] if row else None


# ── JSON import from existing data files ─────────────────────────────────────

def import_from_json(data_dir: Path):
    """Import existing JSON files into the database (first-run migration)."""
    def load(name):
        p = data_dir / f"{name}.json"
        if not p.exists():
            return None
        with open(p, encoding="utf-8") as f:
            return json.load(f)

    pi = load("personal_info")
    if pi and isinstance(pi, dict):
        upsert_personal_info(pi)

    for name, fn in [
        ("daily_readiness", upsert_daily_readiness),
        ("daily_sleep", upsert_daily_sleep),
        ("daily_activity", upsert_daily_activity),
        ("daily_stress", upsert_daily_stress),
        ("daily_spo2", upsert_daily_spo2),
        ("daily_cardiovascular_age", upsert_daily_cardiovascular_age),
        ("daily_resilience", upsert_daily_resilience),
        ("sleep", upsert_sleep),
        ("heartrate", upsert_heartrate),
    ]:
        data = load(name)
        if data and isinstance(data, list) and len(data) > 0:
            fn(data)

    return True
