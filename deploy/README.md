# MLflow custom frontend — containerized deployment

Runs this fork's MLflow web UI in a Docker container and serves it on a port of
your choice, **proxying all API calls to an existing MLflow backend**. No
backend, database, or artifact store runs here — the container only builds and
serves the frontend.

```
browser ──▶ nginx (this container, port $PORT) ──▶ your MLflow backend ($BACKEND_URL)
                     └── serves the static React build
```

## Layout

| File | Purpose |
|------|---------|
| `Dockerfile` | Image with Node + nginx that builds and serves the frontend |
| `entrypoint.sh` | Builds the frontend (if needed) and starts nginx |
| `nginx.conf.template` | nginx site; `${PORT}`/`${BACKEND_URL}` filled in at runtime |
| `docker-compose.yml` | Service definition; bind-mounts the repo, reads `.env` |
| `.env.example` | Template for your local config (copy to `.env`) |
| `start.sh` | One-shot launcher: starts Docker if needed, brings the container up, waits until it's serving |
| `pull-latest.sh` | Pull the latest branch tip, rebuild/restart, wait until serving (deployment host) |
| `_lib.sh` | Shared helpers sourced by the scripts (compose detection, wait-for-serving) |
| `install-docker.sh` | Installs Docker Engine + Compose on Ubuntu |
| `install-service.sh` | Installs a systemd unit so it starts on boot |
| `mlflow-frontend.service` | systemd unit template |

`.env` is **gitignored** — your backend URL never gets committed.

## Quick start
On your server:
```bash
# 0. Get the code (first time only)
git clone -b 3.9.0-custom --single-branch https://github.com/shaperilio/mlflow.git
cd mlflow
cd deploy

# 1. Configure (set BACKEND_URL to your MLflow server, choose a PORT)
cp .env.example .env
nano .env

# 2. Install Docker (first time only, Ubuntu). Skip if Docker is already present.
sudo ./install-docker.sh
#    If it added you to the 'docker' group, log out/in (or `newgrp docker`).

# 3. Launch
./start.sh
```

The **first** start runs `yarn install` + `yarn build` inside the container,
which takes several minutes. `start.sh` blocks until the build finishes and the
UI is actually serving, then prints the URL — you don't have to watch for it.
(If the build fails, it stops waiting and shows you the logs.) Subsequent starts
reuse the existing build and come up in seconds.

To follow the build live in another terminal while you wait:

```bash
docker compose logs -f
```

NOTE: if you have to change `.env` while the container is running, you'll have to do this:
```
docker compose up -d --force-recreate
#   …or if you installed the systemd service:
#   sudo systemctl restart mlflow-frontend
```
from within the `deploy` directory.

## Run on boot (always-on)

```bash
cd deploy
sudo ./install-service.sh
```

This installs and enables `mlflow-frontend.service`, which brings the container
up at boot via Compose (the container itself uses `restart: unless-stopped`).

```bash
systemctl status mlflow-frontend     # check it
sudo systemctl stop mlflow-frontend  # stop it
sudo systemctl disable mlflow-frontend
```

## Updating to the latest code

Development happens elsewhere and is pushed to the `3.9.0-custom` branch on the
fork. On the deployment host, just pull and relaunch:

```bash
cd deploy
./pull-latest.sh
```

This fetches the branch tip, **hard-resets** the checkout to it (discarding any
local changes — nothing is developed on the server), clears the old build, and
restarts the container (via systemd if installed, otherwise Compose). Like
`start.sh`, it waits for the rebuilt frontend to come up and prints the URL once
it's serving (and shows the logs if the build fails).

## Requirements

- Linux host with **Docker Engine + Compose** (use `install-docker.sh` on Ubuntu).
- At least **8 GB RAM** available for the one-time frontend build.
- Network reachability from the host to your `BACKEND_URL`.

## Notes

- Everything is driven by `deploy/.env`; there are no host-specific paths in any
  committed file (the repo is bind-mounted via a relative path).
- To change the port or backend, edit `.env` and restart (`./start.sh`).
