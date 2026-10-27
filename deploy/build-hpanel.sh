#!/usr/bin/env bash
# Builds an upload-ready package for Hostinger hPanel (or any Apache/LiteSpeed shared host).
#
#   deploy/dist/public_html/            → upload contents into your domain's public_html
#     ├── index.html, *.js, *.css       (Angular app)
#     ├── .htaccess                     (SPA routing + caching)
#     └── backend/                      (Laravel API → https://yourdomain.com/backend/api)
#           ├── index.php, .htaccess
#           └── core/                   (Laravel app incl. vendor/, blocked from web)
#   deploy/dist/database/*.sql          → import with phpMyAdmin
#
# Usage: bash deploy/build-hpanel.sh   (needs node/npm, php 8.3 and composer)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy/dist"
TPL="$ROOT/deploy/templates"

rm -rf "$OUT" && mkdir -p "$OUT/public_html/backend/core" "$OUT/database"

echo "▶ Building Angular (production)…"
(cd "$ROOT/frontend" && npm ci --no-audit --no-fund && npx ng build --configuration production)
cp -r "$ROOT/frontend/dist/v-one/browser/." "$OUT/public_html/"
cp "$TPL/frontend.htaccess" "$OUT/public_html/.htaccess"

echo "▶ Packaging Laravel…"
CORE="$OUT/public_html/backend/core"
(cd "$ROOT/backend" && tar --exclude=./vendor --exclude=./node_modules --exclude=./.env --exclude='./storage/logs/*.log' \
  --exclude='./storage/framework/sessions/*' --exclude='./storage/framework/views/*.php' --exclude='./storage/framework/cache/data/*' \
  --exclude=./database/database.sqlite --exclude=./tests --exclude=./.phpunit.result.cache -cf - .) | (cd "$CORE" && tar xf -)
(cd "$CORE" && composer install --no-dev --optimize-autoloader --no-interaction --no-progress)
rm -f "$CORE/bootstrap/cache/config.php" "$CORE/bootstrap/cache/routes-v7.php"
cp "$TPL/backend-index.php" "$OUT/public_html/backend/index.php"
cp "$TPL/backend.htaccess" "$OUT/public_html/backend/.htaccess"
cp "$TPL/core.htaccess" "$CORE/.htaccess"
cp "$CORE/public/robots.txt" "$OUT/public_html/backend/robots.txt" 2>/dev/null || true

# Production .env with a fresh APP_KEY — edit DB_* values in hPanel File Manager after upload.
cp "$CORE/.env.example" "$CORE/.env"
KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
sed -i "s|^APP_KEY=.*|APP_KEY=$KEY|" "$CORE/.env"

if [ -f "$ROOT/deploy/sql/v-one-schema.sql" ]; then cp "$ROOT"/deploy/sql/*.sql "$OUT/database/"; fi
cp "$ROOT/README.md" "$OUT/README.md" 2>/dev/null || true

echo "✔ Done → $OUT"
