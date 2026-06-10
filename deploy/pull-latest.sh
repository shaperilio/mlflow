#!/usr/bin/env bash
# Update the deployment to the latest tip of the branch and bring it live.
#
# For the DEPLOYMENT HOST only (no development happens here). This DISCARDS any
# local changes and hard-resets the checkout to the remote branch, then forces
# the frontend to rebuild and restarts the container.
#
# Usage:
#   ./pull-latest.sh
#
# Override the branch/remote if needed:
#   DEPLOY_BRANCH=some-branch DEPLOY_REMOTE=origin ./pull-latest.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./_lib.sh
DEPLOY_DIR="$(pwd)"
REPO_DIR="$(cd .. && pwd)"
BRANCH="${DEPLOY_BRANCH:-3.9.0-custom}"
REMOTE="${DEPLOY_REMOTE:-origin}"

cd "$REPO_DIR"
echo "==> Fetching ${REMOTE}/${BRANCH}..."
git fetch --prune "$REMOTE"

# Ensure we're on the branch (create a tracking branch the first time), then
# hard-reset to the remote tip. Any local edits to tracked files are discarded.
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "${REMOTE}/${BRANCH}"
echo "==> Hard-resetting to ${REMOTE}/${BRANCH} (local changes are discarded)..."
git reset --hard "${REMOTE}/${BRANCH}"

echo "==> Clearing the previous build so the frontend rebuilds..."
rm -rf "${REPO_DIR}/mlflow/server/js/build"

cd "$DEPLOY_DIR"
resolve_compose || exit 1
if command -v systemctl >/dev/null 2>&1 && \
   systemctl list-unit-files 2>/dev/null | grep -q '^mlflow-frontend\.service'; then
  echo "==> Restarting via systemd..."
  sudo systemctl restart mlflow-frontend
else
  echo "==> Restarting the container..."
  "${COMPOSE_CMD[@]}" up -d --build --force-recreate
fi

# --- Wait until it's actually serving again, then print the URL ---
wait_for_serving "$(read_port)"
