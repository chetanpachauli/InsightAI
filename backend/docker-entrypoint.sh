#!/bin/sh
# Production entrypoint: apply database migrations, then start the API server.
set -e

echo "[entrypoint] Running database migrations..."
alembic upgrade head

echo "[entrypoint] Starting uvicorn..."
# Bind to $PORT when provided (Render injects PORT=10000), default 8000 for local Docker
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
