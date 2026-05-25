#!/bin/sh
# Wait for MySQL TCP, run Alembic migrations, then start Gunicorn.
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-3306}"
WAIT_SECONDS="${DB_WAIT_SECONDS:-90}"

echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT} (up to ${WAIT_SECONDS}s)..."
python <<PY
import os, socket, time
host = os.environ.get("DB_HOST", "db")
port = int(os.environ.get("DB_PORT", "3306"))
deadline = time.time() + int(os.environ.get("DB_WAIT_SECONDS", "90"))
while time.time() < deadline:
    try:
        s = socket.create_connection((host, port), timeout=3)
        s.close()
        print("MySQL port is open.")
        raise SystemExit(0)
    except OSError:
        time.sleep(1)
print("Timeout waiting for MySQL.")
raise SystemExit(1)
PY

if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "Running database migrations..."
  ok=0
  for i in $(seq 1 30); do
    if flask db upgrade; then
      echo "Migrations applied."
      ok=1
      break
    fi
    echo "Migration attempt $i failed; retrying in 2s..."
    sleep 2
  done
  if [ "$ok" -ne 1 ]; then
    echo "Migrations failed after retries." >&2
    exit 1
  fi
fi

exec gunicorn \
  --bind "0.0.0.0:${GUNICORN_PORT:-5000}" \
  --workers "${GUNICORN_WORKERS:-3}" \
  --threads "${GUNICORN_THREADS:-1}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile - \
  --error-logfile - \
  "run:app"
