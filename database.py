import sqlite3
import json
import os
from dotenv import load_dotenv

load_dotenv()

DEFAULT_DB_PATH = "/tmp/most-optimal-path.db" if os.getenv("VERCEL") else "data.db"
DB_PATH = os.getenv("DB_PATH", DEFAULT_DB_PATH)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS graphs (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT    NOT NULL,
            nodes     TEXT    NOT NULL,
            edges     TEXT    NOT NULL,
            directed  INTEGER NOT NULL DEFAULT 0,
            created_at TEXT   DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS run_results (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id           TEXT,
            graph_name       TEXT,
            algorithm        TEXT    NOT NULL,
            distance         REAL,
            execution_time_ms REAL,
            path             TEXT,
            created_at       TEXT    DEFAULT (datetime('now'))
        );
    """)
    # Migration douce : ajoute run_id si une ancienne base existe sans cette colonne
    cols = [r[1] for r in conn.execute("PRAGMA table_info(run_results)").fetchall()]
    if "run_id" not in cols:
        conn.execute("ALTER TABLE run_results ADD COLUMN run_id TEXT")
    conn.commit()
    conn.close()
