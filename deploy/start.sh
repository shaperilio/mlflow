#!/usr/bin/env bash
# One-shot launcher for the MLflow custom frontend container.
#
# Ensures the Docker daemon is running, then builds the image (if needed)
# and starts the container. Safe to re-run.
#
# Usage:
#   ./start.sh            Start (or restart) the frontend container.
#   ./start.sh --rebuild  Force a fresh frontend build (clears build/).
set -euo pipefail
cd "$(dirname "$0")"
source ./_lib.sh

# --- Require configuration ---
if [ ! -f .env ]; then
  echo "ERROR: deploy/.env not found." >&2
  echo "       Copy .env.example to .env and set BACKEND_URL, then re-run." >&2
  exit 1
fi

# --- Ensure Docker is installed ---
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed." >&2
  echo "       Run ./install-docker.sh (Ubuntu) or see README.md, then re-run." >&2
  exit 1
fi

# --- Ensure the Docker daemon is running ---
if ! docker info >/dev/null 2>&1; then
  echo "==> Docker daemon is not responding; attempting to start it..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start docker
  else
    echo "ERROR: Cannot reach the Docker daemon and systemctl is unavailable." >&2
    echo "       Start Docker manually, then re-run." >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  docker info >/dev/null 2>&1 || { echo "ERROR: Docker did not come up." >&2; exit 1; }
fi

# --- Resolve the compose command (plugin vs legacy) ---
resolve_compose || exit 1

# --- Optional forced rebuild of the frontend ---
if [ "${1:-}" = "--rebuild" ]; then
  echo "==> Forcing a frontend rebuild (clearing build/)..."
  clear_build "$(cd .. && pwd)/mlflow/server/js/build"
fi

echo "==> Building image (if needed) and starting the container..."
"${COMPOSE_CMD[@]}" up -d --build

# --- Wait until it's actually serving, then print the URL ---
wait_for_serving "$(read_port)"
