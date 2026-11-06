# MLflow custom frontend — containerized deployment

Runs this fork's MLflow web UI in a Docker container and serves it on a port of
your choice, **proxying all API calls to an MLflow backend**, which is either:

- **A local backend** running next to it, keeping its database and artifacts in a
  folder you choose.
- **An existing backend** running somewhere else, in which case no backend,
  database, or artifact store runs here.

```
browser  ─┐
          ├─▶ nginx (frontend container, port $PORT) ──▶ MLflow backend ($BACKEND_URL)
clients  ─┘            └── serves the static React build
```

## Layout

| File                      | Purpose                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `Dockerfile`              | Image with Node + nginx that builds and serves the frontend                                   |
| `entrypoint.sh`           | Builds the frontend (if needed) and starts nginx                                              |
| `backend-entrypoint.sh`   | Upgrades the local backend's database (if needed) and starts the backend                      |
| `nginx.conf.template`     | nginx site; `${PORT}`/`${BACKEND_URL}`/`${LOGO_FILE}` filled in at runtime                    |
| `docker-compose.yml`      | The frontend and optional backend services; bind-mounts the repo, reads `.env`                |
| `.env.example`            | Template for your local config (copy to `.env`)                                               |
| `start.sh`                | One-shot launcher: starts Docker if needed, brings the container up, waits until it's serving |
| `pull-latest.sh`          | Pull the latest branch tip, rebuild/restart, wait until serving (deployment host)             |
| `_lib.sh`                 | Shared helpers sourced by the scripts (compose detection, wait-for-serving)                   |
| `install-docker.sh`       | Installs Docker Engine + Compose on Ubuntu                                                    |
| `install-service.sh`      | Installs a systemd unit so it starts on boot                                                  |
| `mlflow-frontend.service` | systemd unit template                                                                         |

`.env` is **gitignored** — your backend URL never gets committed.

## Settings

Everything is configured in `deploy/.env`:

| Variable          | Meaning                                                                                        | Default     |
| ----------------- | ---------------------------------------------------------------------------------------------- | ----------- |
| `DATA_DIR`        | Set it to run a local backend here; the folder for its database and artifacts                  | —           |
| `BACKEND_URL`     | Set it *instead* to use an existing backend: where nginx forwards API calls, with scheme+port  | —           |
| `PORT`            | Port the UI (and, through it, the backend) is served on                                        | `42069`     |
| `BIND_ADDRESS`    | Interface the port is published on; `0.0.0.0` opens it to the network                          | `127.0.0.1` |
| `ALLOWED_ORIGINS` | Local backend only: URLs other than `localhost` you open the UI at, comma-separated             | empty       |
| `LOGO_FILE`       | Filename of a custom sidebar logo placed in `deploy/`                                          | empty       |

Exactly one of `DATA_DIR` and `BACKEND_URL` must be set; the scripts refuse to
start otherwise. Each setting is explained in the sections below. After changing
one, run `./start.sh` again (or `sudo systemctl restart mlflow-frontend` if you
installed the service); it picks up the new values.

## Quick start

On your server:

```bash
# 0. Get the code (first time only)
git clone -b master --single-branch https://github.com/shaperilio/mlflow.git
cd mlflow
cd deploy

# 1. Configure (choose a local or existing backend, and a PORT)
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

To apply a change to `.env` while it's running, run `./start.sh` again (or
`sudo systemctl restart mlflow-frontend` if you installed the service).

On Windows, start Docker Desktop and run the `.sh` scripts from Git Bash, skipping
step 2.

## Choosing a backend

`.env` selects one of these by which variable you set (`.env.example` shows
both).

### Local backend

```bash
DATA_DIR=/srv/mlflow-data
```

Setting `DATA_DIR` adds an `mlflow-backend` container running the stock MLflow image. It
publishes no ports of its own, so the UI and your training scripts all go through
nginx on `PORT` — the port `.env` sets, `42069` unless you change it:

```bash
export MLFLOW_TRACKING_URI=http://localhost:42069   # or whatever PORT you chose
```

`DATA_DIR` is created if it doesn't exist. Keep it outside the repo and back it
up; nothing here does that for you. It holds:

| Path         | Contents                                                      |
| ------------ | ------------------------------------------------------------- |
| `mlflow.db`  | Experiments, runs, metrics, parameters and the model registry |
| `artifacts/` | Logged artifacts and models                                   |
| `backups/`   | The database as it was before each MLflow upgrade             |

When the image in `docker-compose.yml` moves to a new MLflow version, the next
start saves a copy of the database in `backups/` and applies any migrations. To
bring in an existing `mlflow.db`, stop the backend and copy it into `DATA_DIR`; it
gets the same treatment on the next start.

### Existing backend

```bash
BACKEND_URL=http://my-mlflow-host:5000
```

Leave `DATA_DIR` unset. `BACKEND_URL` is where nginx forwards every API call;
the UI itself is still served on `PORT`. If you open the UI at anything other
than `localhost`, a recent backend rejects what it does until that URL is in the
backend's own `--cors-allowed-origins`.

## Reaching it from other machines

Nothing here requires a login: anyone who can reach the port can read and change
everything. So by default the port is only published on `127.0.0.1`.

With [Tailscale](https://tailscale.com), keep that default and share the port
with your own devices only:

```bash
tailscale serve --bg 42069
```

Then tell the local backend about the URL that prints, in `.env`, and apply it
with `./start.sh`:

```bash
ALLOWED_ORIGINS=https://my-pc.my-tailnet.ts.net
```

Without that, pages load but the backend rejects everything the UI does from that
URL, including listing runs. Training scripts don't need it; point
`MLFLOW_TRACKING_URI` at the same URL.

To open the port on every network interface instead, set `BIND_ADDRESS=0.0.0.0`.
Don't do that on a network you don't trust.

## Run on boot (always-on)

```bash
cd deploy
sudo ./install-service.sh
```

This installs and enables `mlflow-frontend.service`, which brings the container
up at boot via Compose (the containers themselves use `restart: unless-stopped`).
The unit bakes in which backend `.env` chose, so re-run the installer if you
later switch between `DATA_DIR` and `BACKEND_URL`.

```bash
systemctl status mlflow-frontend     # check it
sudo systemctl stop mlflow-frontend  # stop it
sudo systemctl disable mlflow-frontend
```

On Windows, the containers come back whenever Docker Desktop does. Turn on its
"Start Docker Desktop when you sign in" setting, and stop the PC from sleeping.

## Updating to the latest code

Development happens elsewhere and is pushed to the `master` branch on the fork.
On the deployment host, just pull and relaunch:

```bash
cd deploy
./pull-latest.sh
```

This fetches the branch tip, **force-checks it out** (discarding any local
changes — nothing is developed on the server), clears the old build, and
restarts the container (via systemd if installed, otherwise Compose). Like
`start.sh`, it waits for the rebuilt frontend to come up and prints the URL once
it's serving (and shows the logs if the build fails).

To deploy a different branch, set `DEPLOY_BRANCH` (and `DEPLOY_REMOTE` if it's
not `origin`):

```bash
DEPLOY_BRANCH=some-branch ./pull-latest.sh
```

The script fetches that branch by name, so this works even on a
`--single-branch` clone of another branch (a plain `git fetch` there only ever
fetches the branch it was cloned with).

A deployment that predates `BIND_ADDRESS` publishes its port on every interface,
and updating moves it to `127.0.0.1`. If you rely on reaching it over the network,
add `BIND_ADDRESS=0.0.0.0` to its `.env` first.

### Moving an existing `3.9.0-custom` deployment to `master` (one time)

A checkout of the old `3.9.0-custom` branch still has that branch's
`pull-latest.sh`, which only ever deploys `3.9.0-custom`. Switch it over by hand
once, from the repo root (this discards local changes, like the script does):

```bash
git fetch origin +refs/heads/master:refs/remotes/origin/master
git checkout -f -B master origin/master
cd deploy
./pull-latest.sh
```

From then on, `./pull-latest.sh` alone keeps it up to date. The first run
rebuilds the image (the frontend now needs Node 24) and reinstalls the JS
dependencies, so it takes a while.

## Custom logo

Replace the MLflow wordmark in the sidebar with your own logo:

1. Put the image file in this `deploy/` directory (PNG with a transparent
   background works best; it's scaled to fit the top of the left sidebar — at
   most 140×48 px — keeping its aspect ratio).
2. Set `LOGO_FILE` in `.env` to its filename, e.g. `LOGO_FILE=custom_logo.png`.
3. Run `./start.sh` again (or `sudo systemctl restart mlflow-frontend`) so the
   change is picked up.

nginx then serves it at `/branding/logo.png` and the sidebar uses it. Leave
`LOGO_FILE` empty (or remove the file) to fall back to the default MLflow logo.
No rebuild is needed — swapping the logo is just a file change plus a restart.

## Requirements

- Linux host with **Docker Engine + Compose** (use `install-docker.sh` on Ubuntu),
  or Windows with **Docker Desktop**.
- At least **8 GB RAM** available for the one-time frontend build.
- With an existing backend:
  - Network reachability from the host to your `BACKEND_URL`.
  - A backend that's as new as this frontend. The UI is built from the fork's
    `master` (based on the 3.17.2 release) and calls APIs that older releases
    don't have, so run MLflow 3.17.2 or newer there. An older backend (e.g.
    3.9.0) will leave parts of the UI broken.

## Notes

- Everything is driven by `deploy/.env` (see [Settings](#settings)); there are
  no host-specific paths in any committed file (the repo is bind-mounted via a
  relative path).
