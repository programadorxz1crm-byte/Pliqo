#!/usr/bin/env bash
set -euo pipefail

# ===== Pliqo deploy script (Ubuntu) =====
# - Frontend: HTTPS on pliqo.gonzabot.lat (Vite static)
# - Backend:  HTTPS on botapi.gonzabot.lat (Node via PM2)
# - Nginx: frontend sirve estático; frontend consume backend directo (sin /api proxy)
# - SSL: Let's Encrypt certificates for both domains
#
# Usage:
#   sudo bash deploy/install-ubuntu.sh [--frontend pliqo.gonzabot.lat] [--backend botapi.gonzabot.lat] [--email you@example.com]

FRONTEND_DOMAIN="pliqo.gonzabot.lat"
BACKEND_DOMAIN="botapi.gonzabot.lat"
CERTBOT_EMAIL="admin@pliqo.local" # change to your real email
REPO_URL="https://github.com/programadorxz1crm-byte/Pliqo.git"

DEPLOY_ROOT="/opt/pliqo"
APP_DIR="$DEPLOY_ROOT/app"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/backend"

WEBROOT="/var/www/pliqo-frontend"
DATA_DIR="/var/lib/pliqo-data"
BACKEND_PORT="4000"

for arg in "$@"; do
  case "$arg" in
    --frontend=*) FRONTEND_DOMAIN="${arg#*=}" ;;
    --backend=*) BACKEND_DOMAIN="${arg#*=}" ;;
    --email=*) CERTBOT_EMAIL="${arg#*=}" ;;
  esac
done

echo "Deploying Pliqo with:" 
echo "  Frontend domain : $FRONTEND_DOMAIN"
echo "  Backend domain  : $BACKEND_DOMAIN"
echo "  Certbot email   : $CERTBOT_EMAIL"

echo "\n[1/8] Updating system and installing packages..."
apt update && apt upgrade -y
apt install -y git curl nginx certbot python3-certbot-nginx rsync

echo "\n[2/8] Installing Node.js 18 and PM2..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
fi
npm install -g pm2

echo "\n[3/8] Preparing directories..."
mkdir -p "$DEPLOY_ROOT" "$WEBROOT" "$DATA_DIR"

echo "\n[4/8] Cloning or updating repository..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull --rebase
else
  cd "$DEPLOY_ROOT" && git clone "$REPO_URL" app
fi

echo "\n[5/8] Installing and starting backend (PM2)..."
cd "$BACKEND_DIR"
npm install

# Secrets (persist across deploys)
JWT_SECRET_FILE="$DEPLOY_ROOT/jwt.secret"
TRADING_SECRET_FILE="$DEPLOY_ROOT/trading.secret"
[ -f "$JWT_SECRET_FILE" ] || openssl rand -hex 32 | tee "$JWT_SECRET_FILE" >/dev/null
[ -f "$TRADING_SECRET_FILE" ] || openssl rand -hex 32 | tee "$TRADING_SECRET_FILE" >/dev/null
JWT_SECRET="$(cat "$JWT_SECRET_FILE")"
TRADING_KEYS_SECRET="$(cat "$TRADING_SECRET_FILE")"

pm2 start src/server.js --name pliqo-backend --time -- \
  env PORT="$BACKEND_PORT" DATA_DIR="$DATA_DIR" JWT_SECRET="$JWT_SECRET" TRADING_KEYS_SECRET="$TRADING_KEYS_SECRET"
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null || true

echo "Backend health:"
curl -fsS "http://127.0.0.1:$BACKEND_PORT/" || true

echo "\n[6/8] Building frontend..."
cd "$FRONTEND_DIR"
npm install
export VITE_API_URL="https://$BACKEND_DOMAIN"
npm run build
rsync -av --delete "$FRONTEND_DIR/dist/" "$WEBROOT/"

echo "\n[7/8] Configuring Nginx (frontend + backend, sin proxy)..."
rm -f /etc/nginx/sites-enabled/default || true

cat >/etc/nginx/sites-available/pliqo-frontend <<CONF
server {
  listen 80;
  server_name $FRONTEND_DOMAIN;

  root $WEBROOT;
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
CONF
ln -sf /etc/nginx/sites-available/pliqo-frontend /etc/nginx/sites-enabled/pliqo-frontend

cat >/etc/nginx/sites-available/pliqo-backend <<CONF
server {
  listen 80;
  server_name $BACKEND_DOMAIN;

  location / {
    proxy_pass http://127.0.0.1:$BACKEND_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
CONF
ln -sf /etc/nginx/sites-available/pliqo-backend /etc/nginx/sites-enabled/pliqo-backend

nginx -t
systemctl reload nginx

echo "\n[8/8] Issuing SSL certificates (Let's Encrypt)..."
certbot --nginx -d "$FRONTEND_DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect || true
certbot --nginx -d "$BACKEND_DOMAIN"  --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect || true
systemctl status certbot.timer || true

echo "\nDone. Verify:"
echo "  https://$BACKEND_DOMAIN/         => {\"ok\":true}"
echo "  https://$FRONTEND_DOMAIN/        => carga frontend (SPA)"
echo "  https://$FRONTEND_DOMAIN/register"
echo "Logs: 'pm2 logs pliqo-backend' | Restart: 'pm2 restart pliqo-backend'"