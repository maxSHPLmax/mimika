#!/usr/bin/env python3
"""Мимика — backup server for a Raspberry Pi.

Stores exercise sessions sent by the Мимика app in SQLite. Python standard library only.
Meant to sit behind `tailscale serve`, which provides HTTPS; this process listens on
127.0.0.1 and is not reachable from the network on its own.

Endpoints (all under /api, Bearer token required except /api/health):
  GET  /api/health   -> {"ok": true, "version": ..., "sessions": N}
  POST /api/sync     -> body {"sessions": [...], "notes": [...], "settings": {...}}
  GET  /api/export   -> {"sessions": [...], "notes": [...], "settings": {...}}
  GET  /dashboard    -> dashboard page (no data inside; it loads /api/export with the token)
"""
import json
import os
import secrets
import sqlite3
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "2"
BASE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.environ.get("MIMIKA_CONFIG", os.path.join(BASE, "config.json"))
MAX_BODY = 5 * 1024 * 1024  # 5 MB: years of sessions fit easily


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)
    cfg.setdefault("host", "127.0.0.1")
    cfg.setdefault("port", 8765)
    cfg.setdefault("db", os.path.join(BASE, "data", "mimika.db"))
    cfg.setdefault("allowed_origins", [])
    if not cfg.get("token"):
        sys.exit("config.json: 'token' is missing")
    return cfg


CFG = load_config()
DB_LOCK = threading.Lock()


def db():
    os.makedirs(os.path.dirname(CFG["db"]), exist_ok=True)
    conn = sqlite3.connect(CFG["db"])
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS sessions (
             id TEXT PRIMARY KEY, started_at TEXT, updated_at TEXT, received_at REAL, body TEXT NOT NULL)"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS notes (
             key TEXT PRIMARY KEY, at TEXT, body TEXT NOT NULL)"""
    )
    conn.execute("CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL)")
    return conn


def upsert(payload):
    sessions = payload.get("sessions") or []
    notes = payload.get("notes") or []
    settings = payload.get("settings")
    if not isinstance(sessions, list) or not isinstance(notes, list):
        raise ValueError("sessions and notes must be lists")
    stored = 0
    with DB_LOCK:
        conn = db()
        try:
            for s in sessions:
                if not isinstance(s, dict) or not isinstance(s.get("id"), str):
                    continue
                incoming = s.get("updatedAt") or s.get("endedAt") or s.get("startedAt") or ""
                row = conn.execute("SELECT updated_at FROM sessions WHERE id = ?", (s["id"],)).fetchone()
                # Keep the newer copy; never let an old phone state overwrite newer data.
                if row and row[0] and incoming and row[0] > incoming:
                    continue
                conn.execute(
                    "INSERT OR REPLACE INTO sessions (id, started_at, updated_at, received_at, body) VALUES (?,?,?,?,?)",
                    (s["id"], s.get("startedAt"), incoming, time.time(), json.dumps(s, ensure_ascii=False)),
                )
                stored += 1
            for n in notes:
                if not isinstance(n, dict) or "at" not in n:
                    continue
                key = f'{n.get("at")}|{n.get("type", "")}'
                conn.execute(
                    "INSERT OR IGNORE INTO notes (key, at, body) VALUES (?,?,?)",
                    (key, n.get("at"), json.dumps(n, ensure_ascii=False)),
                )
            if isinstance(settings, dict):
                conn.execute(
                    "INSERT OR REPLACE INTO settings (id, body) VALUES (1, ?)",
                    (json.dumps(settings, ensure_ascii=False),),
                )
            conn.commit()
            total = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        finally:
            conn.close()
    return {"ok": True, "stored": stored, "sessions": total}


def export_all():
    with DB_LOCK:
        conn = db()
        try:
            sessions = [json.loads(r[0]) for r in conn.execute("SELECT body FROM sessions ORDER BY started_at")]
            notes = [json.loads(r[0]) for r in conn.execute("SELECT body FROM notes ORDER BY at")]
            row = conn.execute("SELECT body FROM settings WHERE id = 1").fetchone()
        finally:
            conn.close()
    return {"ok": True, "sessions": sessions, "notes": notes, "settings": json.loads(row[0]) if row else None}


def count_sessions():
    with DB_LOCK:
        conn = db()
        try:
            return conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        finally:
            conn.close()


class Handler(BaseHTTPRequestHandler):
    server_version = "Mimika/" + VERSION

    # tailscale serve may mount us under a path prefix; accept both /api/x and /<prefix>/api/x
    def route(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        i = path.find("/api/")
        return path[i:] if i >= 0 else path

    def cors(self):
        origin = self.headers.get("Origin")
        if origin and origin in CFG["allowed_origins"]:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Max-Age", "86400")
            # Chrome's Private Network Access preflight (harmless elsewhere)
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        auth = self.headers.get("Authorization", "")
        return auth.startswith("Bearer ") and secrets.compare_digest(auth[7:].strip(), CFG["token"])

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def send_page(self, name):
        path = os.path.join(BASE, name)
        try:
            body = open(path, "rb").read()
        except OSError:
            return self.reply(404, {"ok": False, "error": "not found"})
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
            "connect-src 'self'; img-src data:; frame-ancestors 'none'; base-uri 'none'",
        )
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        r = self.route()
        if r in ("/dashboard", "/dashboard.html"):
            return self.send_page("dashboard.html")
        if r == "/api/health":
            return self.reply(200, {"ok": True, "version": VERSION, "sessions": count_sessions() if self.authorized() else None})
        if not self.authorized():
            return self.reply(401, {"ok": False, "error": "unauthorized"})
        if r == "/api/export":
            return self.reply(200, export_all())
        return self.reply(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.route() != "/api/sync":
            return self.reply(404, {"ok": False, "error": "not found"})
        if not self.authorized():
            return self.reply(401, {"ok": False, "error": "unauthorized"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self.reply(413, {"ok": False, "error": "bad size"})
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            return self.reply(200, upsert(payload))
        except (ValueError, json.JSONDecodeError) as e:
            return self.reply(400, {"ok": False, "error": str(e)})

    def log_message(self, fmt, *args):  # quiet, one line per request, no bodies
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    db().close()
    srv = ThreadingHTTPServer((CFG["host"], CFG["port"]), Handler)
    print(f"Мимика backup server on {CFG['host']}:{CFG['port']}, db={CFG['db']}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
