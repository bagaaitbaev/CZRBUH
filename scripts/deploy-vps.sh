#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

APP_DIR="/var/www/cezar-finance"
REPO_URL="https://github.com/bagaaitbaev/CZRBUH.git"
NGINX_SITE="/etc/nginx/sites-available/cezar-finance"

apt-get update
apt-get install -y git nginx ca-certificates

mkdir -p /var/www

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/master
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cat > "$NGINX_SITE" <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/cezar-finance;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/cezar-finance

nginx -t
systemctl enable nginx
systemctl reload nginx

echo "CEZAR_FINANCE_DEPLOYED"
