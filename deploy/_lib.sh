# _lib.sh — shared helpers for the MLflow frontend deploy scripts.
# Sourced by start.sh and pull-latest.sh; not executed directly.

CONTAINER_NAME="mlflow-frontend"

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

# Print the PORT from .env (default 42069). Run from the deploy/ directory.
read_port() {
  local p
  p="$(grep -E '^PORT=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')"
  printf '%s' "${p:-42069}"
}

# Block until the frontend is actually serving on <port>, then print the URL.
# Bails out (non-zero) with recent logs if the container crashes or restart-loops
# instead of hanging for the whole timeout. Requires COMPOSE_CMD to be set.
#
# Usage: wait_for_serving <port>
# Env:   SERVE_TIMEOUT (seconds, default 1800)
wait_for_serving() {
  local port="$1"
  local waited=0 interval=5 timeout="${SERVE_TIMEOUT:-1800}"
  local baseline_restarts status restarts

  baseline_restarts="$(docker inspect -f '{{.RestartCount}}' "$CONTAINER_NAME" 2>/dev/null || echo 0)"

  echo ""
  echo "==> Waiting for the frontend to finish building and start serving..."
  echo "    Watch the build live in another terminal with:"
  echo "        ${COMPOSE_CMD[*]} logs -f"
  echo "    (Ctrl-C is safe — the container keeps running in the background.)"

  while :; do
    # Serving? Probe nginx from inside the container (avoids docker-proxy
    # accepting the published port before nginx is actually up).
    if docker exec "$CONTAINER_NAME" curl -fsS -o /dev/null -m 3 \
         "http://localhost:${port}/" >/dev/null 2>&1; then
      printf '\r%*s\r' 40 ''   # clear the heartbeat line
      echo "==> Serving. Open:  http://$(hostname):${port}/"
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
