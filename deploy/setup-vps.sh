#!/usr/bin/env bash
set -euo pipefail
APP_ROOT=/opt/fasl-apps/CAOS_OreFlow
REPO=https://github.com/fsantibanezleal/CAOS_OreFlow.git
CERT=/etc/letsencrypt/live/oreflow.ml.fasl-work.com/fullchain.pem
# install only what is missing: installing a package that is present upgrades it, and nginx serves
# every other site on this host
missing=()
for pkg in git nginx curl ca-certificates python3-venv certbot python3-certbot-nginx; do
  dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
done
if [ "${#missing[@]}" -gt 0 ]; then apt-get update && apt-get install -y "${missing[@]}"; fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || printf '0')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
mkdir -p /opt/fasl-apps
if ! id fasl >/dev/null 2>&1; then
  useradd --system --home-dir /opt/fasl-apps --shell /usr/sbin/nologin fasl
fi
git config --global --get-all safe.directory | grep -xF "$APP_ROOT" >/dev/null || git config --global --add safe.directory "$APP_ROOT"
if [ ! -d "$APP_ROOT/.git" ]; then git clone "$REPO" "$APP_ROOT"; else git -C "$APP_ROOT" fetch origin && git -C "$APP_ROOT" checkout main && git -C "$APP_ROOT" pull --ff-only; fi
chown -R fasl:fasl "$APP_ROOT"
python3 -m venv "$APP_ROOT/.venv"
"$APP_ROOT/.venv/bin/pip" install --upgrade pip
"$APP_ROOT/.venv/bin/pip" install -r "$APP_ROOT/requirements.txt" -r "$APP_ROOT/requirements-api.txt"
(cd "$APP_ROOT/frontend" && npm ci && npm run build)
install -m 0644 "$APP_ROOT/deploy/oreflow.service" /etc/systemd/system/oreflow.service
# with a certificate in place the TLS virtual host goes in directly: the plain one, which a first install
# needs for certbot, has no 443 server, and while it was loaded HTTPS for this name reached another site
if [ -s "$CERT" ]; then SITE=oreflow.nginx.tls; else SITE=oreflow.nginx; fi
install -m 0644 "$APP_ROOT/deploy/$SITE" /etc/nginx/sites-available/oreflow.ml.fasl-work.com
ln -sfn /etc/nginx/sites-available/oreflow.ml.fasl-work.com /etc/nginx/sites-enabled/oreflow.ml.fasl-work.com
nginx -t
systemctl daemon-reload
systemctl enable --now oreflow
# enable --now starts a stopped service but leaves a running one on the code it loaded
systemctl restart oreflow
systemctl reload nginx
if [ "$SITE" = oreflow.nginx ]; then
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email --redirect -d oreflow.ml.fasl-work.com
  install -m 0644 "$APP_ROOT/deploy/oreflow.nginx.tls" /etc/nginx/sites-available/oreflow.ml.fasl-work.com
  nginx -t
  systemctl reload nginx
fi
# the port refuses connections for a moment after the restart
curl --fail --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:8146/healthz
curl --fail --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:8146/api/cases
