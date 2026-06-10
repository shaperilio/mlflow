#!/usr/bin/env bash
# Installs Docker Engine + the Compose plugin on Ubuntu.
#
# This is the Linux equivalent of "Docker Desktop": the Docker Engine daemon
# (managed by systemd) plus the `docker` CLI and `docker compose` plugin.
#
# Usage:  sudo ./install-docker.sh
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: please run as root: sudo $0" >&2
  exit 1
fi

echo "==> Installing prerequisites"
apt-get update
apt-get install -y ca-certificates curl

echo "==> Adding Docker's official APT repository"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-${VERSION_CODENAME}}")"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

echo "==> Installing Docker Engine + Compose plugin"
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Enabling and starting the Docker daemon"
systemctl enable --now docker

# Let the invoking (non-root) user run docker without sudo.
if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
  usermod -aG docker "${SUDO_USER}"
  echo ""
  echo "Added '${SUDO_USER}' to the 'docker' group."
  echo "Log out and back in (or run 'newgrp docker') before running ./start.sh."
fi

echo ""
echo "Docker installed:"
docker --version
docker compose version
