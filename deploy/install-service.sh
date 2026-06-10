#!/usr/bin/env bash
# Installs a systemd service so the MLflow frontend container starts on boot
# and is restarted automatically.
#
# Usage:  sudo ./install-service.sh
set -euo pipefail
cd "$(dirname "$0")"
DEPLOY_DIR="$(pwd)"

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: please run as root: sudo $0" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: deploy/.env not found." >&2
  echo "       Copy .env.example to .env and set BACKEND_URL before installing." >&2
  exit 1
fi

# Resolve an absolute compose command for the unit file.
if docker compose version >/dev/null 2>&1; then
  COMPOSE="$(command -v docker) compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="$(command -v docker-compose)"
else
  echo "ERROR: 'docker compose' is not available. Install it first (./install-docker.sh)." >&2
  exit 1
fi

UNIT=/etc/systemd/system/mlflow-frontend.service
echo "==> Writing ${UNIT}"
sed -e "s#__DEPLOY_DIR__#${DEPLOY_DIR}#g" \
    -e "s#__COMPOSE__#${COMPOSE}#g" \
    mlflow-frontend.service > "$UNIT"

echo "==> Enabling service to start on boot"
systemctl daemon-reload
systemctl enable mlflow-frontend.service

echo "==> Starting service now"
systemctl start mlflow-frontend.service

echo ""
echo "Installed. The frontend will start automatically on every boot."
echo "  Status:  systemctl status mlflow-frontend"
echo "  Logs:    ${COMPOSE} -f ${DEPLOY_DIR}/docker-compose.yml logs -f"
echo "  Stop:    sudo systemctl stop mlflow-frontend"
echo "  Disable: sudo systemctl disable mlflow-frontend"
