#!/usr/bin/env bash
# Container entrypoint for the MLflow custom frontend.
#
# 1. Installs JS deps (if missing)
# 2. Builds the frontend (if not already built)
# 3. Renders the nginx config from a template using BACKEND_URL / PORT
# 4. Serves the build in the foreground
#
# All inputs come from the environment (set via deploy/.env -> docker-compose).
set -euo pipefail

JS_DIR="/mlflow/mlflow/server/js"

: "${BACKEND_URL:?BACKEND_URL is required (set it in deploy/.env)}"
: "${PORT:=42069}"

echo "==> MLflow frontend starting"
echo "    backend : ${BACKEND_URL}"
echo "    port    : ${PORT}"

if [ ! -d "$JS_DIR" ]; then
  echo "ERROR: $JS_DIR not found. Is the repo bind-mounted at /mlflow?" >&2
  exit 1
fi
cd "$JS_DIR"

# 1. Install JS dependencies if they're missing, or if the lockfile changed
#    (e.g. after pull-latest pulled new code with updated dependencies).
if [ ! -d node_modules ] || [ yarn.lock -nt node_modules ]; then
  echo "==> Installing JS dependencies (yarn install)... this takes a few minutes"
  yarn install
fi

# 2. Build the frontend if there's no build yet.
#    Delete the build/ directory (or run start.sh --rebuild) to force a rebuild.
if [ ! -f build/index.html ]; then
  echo "==> Building frontend (yarn build)... this takes several minutes"
  yarn build
else
  echo "==> Existing build found; serving it as-is."
fi

# 3. Render the nginx config (only PORT and BACKEND_URL are substituted).
echo "==> Configuring nginx..."
export PORT BACKEND_URL
envsubst '${PORT} ${BACKEND_URL}' \
  < /etc/nginx/mlflow.conf.template \
  > /etc/nginx/sites-available/mlflow
ln -sf /etc/nginx/sites-available/mlflow /etc/nginx/sites-enabled/mlflow
rm -f /etc/nginx/sites-enabled/default
nginx -t

# 4. Serve.
echo "==> Serving on port ${PORT}"
exec nginx -g 'daemon off;'
