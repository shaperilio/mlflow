#!/usr/bin/env bash
# Container entrypoint for the optional local MLflow backend.
#
# 1. Upgrades an existing database if the MLflow version changed, backing it up first
# 2. Serves the tracking server in the foreground
#
# Everything is stored under /data, which docker-compose mounts from DATA_DIR.
set -euo pipefail

DB_PATH="/data/mlflow.db"
DB_URI="sqlite:///${DB_PATH}"
VERSION_FILE="/data/.mlflow-version"

version="$(mlflow --version)"
version="${version##* }"

# A brand new database needs no upgrade; `mlflow server` creates it.
if [ -f "$DB_PATH" ] && [ "$(cat "$VERSION_FILE" 2>/dev/null || true)" != "$version" ]; then
  # Named by version so a failing upgrade can't pile up copies while the container restarts.
  backup="/data/backups/before-${version}.db"
  if [ ! -f "$backup" ]; then
    echo "==> MLflow version changed; backing up the database to ${backup}"
    mkdir -p /data/backups
    python -c 'import sqlite3, sys; sqlite3.connect(sys.argv[1]).backup(sqlite3.connect(sys.argv[2]))' \
      "$DB_PATH" "$backup"
  fi
  echo "==> Upgrading the database schema..."
  mlflow db upgrade "$DB_URI"
fi
echo "$version" > "$VERSION_FILE"

# nginx reaches this container as mlflow-backend:5000 (see docker-compose.yml). Extra origins come
# from ALLOWED_ORIGINS, via MLFLOW_SERVER_CORS_ALLOWED_ORIGINS.
echo "==> Serving the MLflow ${version} backend"
exec mlflow server \
  --host 0.0.0.0 \
  --port 5000 \
  --backend-store-uri "$DB_URI" \
  --artifacts-destination /data/artifacts \
  --allowed-hosts mlflow-backend:5000
