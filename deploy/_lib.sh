# _lib.sh — shared helpers for the MLflow frontend deploy scripts.
# Sourced by start.sh and pull-latest.sh; not executed directly.

CONTAINER_NAME="mlflow-frontend"
BACKEND_CONTAINER_NAME="mlflow-backend"

# On Windows, stop Git Bash from rewriting container paths like /mlflow into host paths.
export MSYS_NO_PATHCONV=1

# Resolve the compose command into the COMPOSE_CMD array.
# Returns non-zero if neither the plugin nor the legacy binary is available.
resolve_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
  else
    echo "ERROR: 'docker compose' is not available." >&2
    echo "       Run ./install-docker.sh (Ubuntu) or install the compose plugin." >&2
    return 1
  fi
}

# Print a setting from .env, or a default if it's unset. Run from the deploy/ directory.
# Usage: read_env <name> <default>
read_env() {
  local v
  v="$(grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')"
  printf '%s' "${v:-$2}"
}

# Print the PORT from .env (default 42069). Run from the deploy/ directory.
read_port() {
  read_env PORT 42069
}

# Print the host to open the UI at, given BIND_ADDRESS. Run from the deploy/ directory.
read_url_host() {
  local bind
  bind="$(read_env BIND_ADDRESS 127.0.0.1)"
  case "$bind" in
    127.0.0.1) printf 'localhost' ;;
    0.0.0.0) hostname ;;
    *) printf '%s' "$bind" ;;
  esac
}

# Remove the frontend build dir so the next start rebuilds it.
# The build is created by root inside the container, so on a Linux bind mount
# the host user normally can't delete it. Prefer deleting it from inside the
# running container (as root); fall back to a plain rm, then sudo.
# Usage: clear_build <host_path_to_build_dir>
clear_build() {
  local build_dir="$1"
  [ -e "$build_dir" ] || return 0
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER_NAME"; then
    docker exec "$CONTAINER_NAME" rm -rf /mlflow/mlflow/server/js/build
  elif rm -rf "$build_dir" 2>/dev/null; then
    :
  else
    echo "==> build/ is owned by the container; clearing it with sudo..."
    sudo rm -rf "$build_dir"
  fi
}

# Block until the frontend is actually serving on <port>, then print the URL. With
# the local backend enabled, also waits for the backend to answer through nginx.
# Bails out (non-zero) with recent logs if a container crashes or restart-loops
# instead of hanging for the whole timeout. Requires COMPOSE_CMD to be set.
#
# Usage: wait_for_serving <port>
# Env:   SERVE_TIMEOUT (seconds, default 1800)
wait_for_serving() {
  local port="$1"
  local waited=0 interval=5 timeout="${SERVE_TIMEOUT:-1800}"
  local baseline_restarts status restarts
  local baseline_backend_restarts backend_restarts probe_path="/"

  baseline_restarts="$(docker inspect -f '{{.RestartCount}}' "$CONTAINER_NAME" 2>/dev/null || echo 0)"
  baseline_backend_restarts="$(docker inspect -f '{{.RestartCount}}' "$BACKEND_CONTAINER_NAME" 2>/dev/null || echo 0)"
  case ",$(read_env COMPOSE_PROFILES '')," in
    *,backend,*) probe_path="/health" ;;
  esac

  echo ""
  echo "==> Waiting for the frontend to finish building and start serving..."
  echo "    Watch the build live in another terminal with:"
  echo "        ${COMPOSE_CMD[*]} logs -f"
  echo "    (Ctrl-C is safe — the container keeps running in the background.)"

  while :; do
    # Serving? Probe nginx from inside the container (avoids docker-proxy
    # accepting the published port before nginx is actually up).
    if docker exec "$CONTAINER_NAME" curl -fsS -o /dev/null -m 3 \
         "http://localhost:${port}${probe_path}" >/dev/null 2>&1; then
      printf '\r%*s\r' 40 ''   # clear the heartbeat line
      echo "==> Serving. Open:  http://$(read_url_host):${port}/"
      return 0
    fi

    # Crashed / gone / restart-looping? Fail fast with logs.
    status="$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo missing)"
    restarts="$(docker inspect -f '{{.RestartCount}}' "$CONTAINER_NAME" 2>/dev/null || echo "$baseline_restarts")"
    if [ "$status" = "missing" ] || [ "$status" = "exited" ] || [ "$status" = "dead" ] \
       || [ "${restarts:-0}" -gt "${baseline_restarts:-0}" ]; then
      printf '\r%*s\r' 40 ''
      echo "ERROR: container is not running cleanly (status: ${status}, restarts: ${restarts})." >&2
      echo "       The build likely failed. Recent logs:" >&2
      "${COMPOSE_CMD[@]}" logs --tail=40 2>&1 | sed 's/^/    /' >&2
      return 1
    fi

    backend_restarts="$(docker inspect -f '{{.RestartCount}}' "$BACKEND_CONTAINER_NAME" 2>/dev/null || echo "$baseline_backend_restarts")"
    if [ "${backend_restarts:-0}" -gt "${baseline_backend_restarts:-0}" ]; then
      printf '\r%*s\r' 40 ''
      echo "ERROR: the backend is restarting (restarts: ${backend_restarts}). Recent logs:" >&2
      "${COMPOSE_CMD[@]}" logs --tail=40 "$BACKEND_CONTAINER_NAME" 2>&1 | sed 's/^/    /' >&2
      return 1
    fi

    if [ "$waited" -ge "$timeout" ]; then
      printf '\r%*s\r' 40 ''
      echo "ERROR: not serving after ${timeout}s; giving up waiting." >&2
      echo "       Still building or stuck? Check:  ${COMPOSE_CMD[*]} logs -f" >&2
      return 1
    fi

    printf '\r    building… %ds elapsed' "$waited"
    sleep "$interval"
    waited=$((waited + interval))
  done
}
