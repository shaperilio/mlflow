# Deployment image for the MLflow custom frontend.
#
# This image contains only what is needed to BUILD the React frontend and
# SERVE it via nginx. It does not run an MLflow backend -- API calls are
# proxied to a backend URL supplied at runtime (see entrypoint.sh / .env).
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# System deps:
#   nginx         - serves the static build + proxies the API
#   gettext-base  - provides `envsubst` to render the nginx config from a template
#   build-essential - some JS deps compile native addons during `yarn install`
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    ca-certificates \
    nginx \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Install Node via nvm (lets us match whatever version the repo needs)
ENV NVM_DIR="/root/.nvm"
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install --lts \
    && nvm use --lts \
    && npm install -g yarn

# Make node/npm/yarn available in non-login shells (e.g. the entrypoint)
RUN ln -sf $(ls -d /root/.nvm/versions/node/*/bin | tail -1)/node /usr/local/bin/node \
    && ln -sf $(ls -d /root/.nvm/versions/node/*/bin | tail -1)/npm /usr/local/bin/npm \
    && ln -sf $(ls -d /root/.nvm/versions/node/*/bin | tail -1)/yarn /usr/local/bin/yarn

WORKDIR /mlflow

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY nginx.conf.template /etc/nginx/mlflow.conf.template
RUN chmod +x /usr/local/bin/entrypoint.sh

# Served port is configurable; default documented here for clarity.
EXPOSE 42069

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
