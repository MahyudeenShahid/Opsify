# File: action_brain/db.py
#
# ## Purpose
# SQLite database manager for System 3: Action Brain.
# Persists dispatch jobs and rider availability across server restarts.

import os
import sqlite3
from typing import Any

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "opsify_action.db")


def get_jobs_db() -> sqlite3.Connection:
    """Return a connection to the Action Brain SQLite DB with row_factory set."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # Better concurrency
    conn.execute("PRAGMA foreign_keys=1")
    _ensure_schema(conn)
    return conn


def _ensure_schema(conn: sqlite3.Connection) -> None:
    """Create tables if they don't exist yet (idempotent)."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS jobs (
            job_id           TEXT PRIMARY KEY,
            order_id         TEXT NOT NULL,
            rider_id         TEXT NOT NULL,
            rider_name       TEXT NOT NULL,
            rider_phone      TEXT NOT NULL,
            rider_vehicle    TEXT NOT NULL,
            rider_rating     REAL NOT NULL,
            destination_zone TEXT NOT NULL,
            item             TEXT NOT NULL,
            customer_name    TEXT NOT NULL,
            customer_phone   TEXT NOT NULL,
            route_json       TEXT NOT NULL,
            status           TEXT NOT NULL DEFAULT 'DISPATCHED',
            status_index     INTEGER NOT NULL DEFAULT 0,
            timeline_json    TEXT NOT NULL DEFAULT '[]',
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS riders (
            rider_id  TEXT PRIMARY KEY,
            status    TEXT NOT NULL DEFAULT 'AVAILABLE'
        );
    """)
    conn.commit()


def sync_rider_pool(rider_pool: list) -> None:
    """
    Upsert all riders from the pool into the riders table.
    Preserves existing status (BUSY riders stay BUSY).
    Called once at startup from riders.py.
    """
    conn = get_jobs_db()
    for rider in rider_pool:
        conn.execute(
            "INSERT OR IGNORE INTO riders (rider_id, status) VALUES (?, 'AVAILABLE')",
            (rider["id"],),
        )
    conn.commit()
    conn.close()


def get_rider_statuses() -> dict:
    """Return {rider_id: status} mapping from the DB."""
    conn = get_jobs_db()
    rows = conn.execute("SELECT rider_id, status FROM riders").fetchall()
    conn.close()
    return {r["rider_id"]: r["status"] for r in rows}
