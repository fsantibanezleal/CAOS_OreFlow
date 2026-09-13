#!/usr/bin/env bash
set -euo pipefail
APP_ROOT=/opt/fasl-apps/CAOS_OreFlow
REPO=https://github.com/fsantibanezleal/CAOS_OreFlow.git
apt-get update
apt-get install -y git nginx curl ca-certificates python3-venv certbot python3-certbot-nginx
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || printf '0')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
fi
apt-get install -y nodejs
mkdir -p /opt/fasl-apps
if ! id fasl >/dev/null 2>&1; then
  useradd --system --home-dir /opt/fasl-apps --shell /usr/sbin/nologin fasl
fi
git config --global --add safe.directory "$APP_ROOT"
if [ ! -d "$APP_ROOT/.git" ]; then git clone "$REPO" "$APP_ROOT"; else git -C "$APP_ROOT" fetch origin && git -C "$APP_ROOT" checkout main && git -C "$APP_ROOT" pull --ff-only; fi
chown -R fasl:fasl "$APP_ROOT"
python3 -m venv "$APP_ROOT/.venv"
"$APP_ROOT/.venv/bin/pip" install --upgrade pip
"$APP_ROOT/.venv/bin/pip" install -r "$APP_ROOT/requirements.txt" -r "$APP_ROOT/requirements-api.txt"
(cd "$APP_ROOT/frontend" && npm ci && npm run build)
install -m 0644 "$APP_ROOT/deploy/oreflow.service" /etc/systemd/system/oreflow.service
install -m 0644 "$APP_ROOT/deploy/oreflow.nginx" /etc/nginx/sites-available/oreflow.ml.fasl-work.com
ln -sfn /etc/nginx/sites-available/oreflow.ml.fasl-work.com /etc/nginx/sites-enabled/oreflow.ml.fasl-work.com
nginx -t
systemctl daemon-reload
systemctl enable --now oreflow
systemctl reload nginx
if [ ! -s "/etc/letsencrypt/live/oreflow.ml.fasl-work.com/fullchain.pem" ]; then
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email --redirect -d oreflow.ml.fasl-work.com
fi
install -m 0644 "$APP_ROOT/deploy/oreflow.nginx.tls" /etc/nginx/sites-available/oreflow.ml.fasl-work.com
nginx -t
systemctl reload nginx
curl --fail --retry 5 http://127.0.0.1:8146/healthz
curl --fail --retry 5 http://127.0.0.1:8146/api/cases
