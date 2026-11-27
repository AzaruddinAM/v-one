#!/usr/bin/env bash
# Deploys VelouraOne to https://accounts.velouraone.in over SSH (used by .github/workflows/deploy-accounts.yml).
#
# Expects, from the repository root:
#   frontend/dist/v-one/browser/   Angular production build
#   backend/vendor/                composer install --no-dev already run
#
# On the server (DEPLOY_PATH = the folder holding index.html and backend/):
#   1. backup   ~/backups/accounts/<time>-<sha>.sql.gz (mysqldump using backend/core/.env) + code tarball; last 15 kept
#   2. backend  rsync backend/ → backend/core/   (.env, storage/, bootstrap/cache/ and .htaccess are never touched)
#   3. migrate  php artisan migrate --force, then clear caches
#   4. frontend rsync the Angular build → DEPLOY_PATH (server .htaccess and backend/ are left alone)
# The deployed commit is written to backend/core/.deploy-sha.
#
# Env: SSH_HOST SSH_USER SSH_KEY [SSH_PORT=65002] [DEPLOY_PATH] [PHP_BIN] GITHUB_SHA
# Usage: bash deploy/ssh-deploy-accounts.sh [check|deploy]
set -euo pipefail

: "${SSH_HOST:?Add the SSH_HOST secret}" "${SSH_USER:?Add the SSH_USER secret}" "${SSH_KEY:?Add the SSH_KEY secret}"
SSH_PORT=${SSH_PORT:-65002}
SHA=${GITHUB_SHA:-$(git rev-parse HEAD)}

KEYFILE=$(mktemp); trap 'rm -f "$KEYFILE"' EXIT
printf '%s\n' "$SSH_KEY" > "$KEYFILE"; chmod 600 "$KEYFILE"
SSH_OPTS=(-i "$KEYFILE" -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=20 -o BatchMode=yes)
remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$@"; }
push() { rsync -rlz --checksum --info=stats1 -e "ssh ${SSH_OPTS[*]}" "$@"; }

# Find the site folder and a PHP 8.3+ CLI on the server.
DEPLOY_PATH=$(remote "DEPLOY_PATH='${DEPLOY_PATH:-}' bash -s" <<'EOF'
set -e
for d in "$DEPLOY_PATH" ~/domains/accounts.velouraone.in/public_html ~/domains/velouraone.in/public_html/accounts ~/public_html/accounts; do
  [ -n "$d" ] && [ -f "$d/backend/core/artisan" ] && { cd "$d" && pwd; exit 0; }
done
echo "Could not find backend/core/artisan on the server. Set the DEPLOY_PATH secret." >&2; exit 1
EOF
)
PHP_BIN=$(remote "PHP_BIN='${PHP_BIN:-}' bash -s" <<'EOF'
for p in "$PHP_BIN" /opt/alt/php84/usr/bin/php /opt/alt/php83/usr/bin/php php; do
  [ -n "$p" ] && command -v "$p" >/dev/null 2>&1 && "$p" -r 'exit(PHP_VERSION_ID >= 80300 ? 0 : 1);' && { echo "$p"; exit 0; }
done
echo "No PHP 8.3+ CLI found on the server. Set the PHP_BIN secret." >&2; exit 1
EOF
)
CORE="$DEPLOY_PATH/backend/core"
echo "Site folder: $DEPLOY_PATH"
echo "PHP CLI:     $PHP_BIN ($(remote "$PHP_BIN -r 'echo PHP_VERSION;'"))"
echo "Live commit: $(remote "cat $CORE/.deploy-sha 2>/dev/null || echo unknown")"
echo "This commit: $SHA"

[ "${1:-deploy}" = check ] && { remote "cd $CORE && $PHP_BIN artisan migrate:status --no-interaction | tail -n 15"; exit 0; }

echo "▶ 1/4 Backup"
remote "CORE='$CORE' SITE='$DEPLOY_PATH' SHA='${SHA:0:7}' bash -s" <<'EOF'
set -euo pipefail
dir=~/backups/accounts; mkdir -p "$dir"; chmod 700 ~/backups "$dir"
stamp="$(date +%Y%m%d-%H%M%S)-$SHA"
env_get() { grep -E "^$1=" "$CORE/.env" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }
cnf=$(mktemp); trap 'rm -f "$cnf"' EXIT; chmod 600 "$cnf"
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' "$(env_get DB_HOST)" "$(env_get DB_PORT)" "$(env_get DB_USERNAME)" "$(env_get DB_PASSWORD)" > "$cnf"
mysqldump --defaults-extra-file="$cnf" --single-transaction --quick --routines --no-tablespaces "$(env_get DB_DATABASE)" | gzip > "$dir/$stamp.sql.gz"
[ "$(gzip -dc "$dir/$stamp.sql.gz" | head -c 100000 | grep -c 'CREATE TABLE')" -gt 0 ] || { echo "Database backup looks empty — stopping." >&2; exit 1; }
tar -czf "$dir/$stamp-files.tar.gz" -C "$SITE" --exclude=backend/core/vendor --exclude='backend/core/storage/framework' --exclude='backend/core/storage/logs' .
ls -1t "$dir" | tail -n +31 | sed "s|^|$dir/|" | xargs -r rm -f   # keep the 15 newest (sql + files)
ls -lh "$dir/$stamp".* "$dir/$stamp"-files.tar.gz 2>/dev/null | awk '{print "  " $5 "  " $9}'
EOF

echo "▶ 2/4 Backend → $CORE"
remote "cd $CORE && $PHP_BIN artisan down --retry=10 || true"
trap 'remote "cd $CORE && $PHP_BIN artisan up" || true; rm -f "$KEYFILE"' EXIT
push --delete \
  --exclude=/.env --exclude=/.env.* --exclude=/storage/ --exclude=/bootstrap/cache/ --exclude=/.htaccess \
  --exclude=/public/storage --exclude=/database/database.sqlite --exclude=/tests/ --exclude=/node_modules/ \
  --exclude=/.deploy-sha --exclude=/.phpunit.result.cache --exclude=.git \
  backend/ "$SSH_USER@$SSH_HOST:$CORE/"

echo "▶ 3/4 Migrate"
remote "cd $CORE && mkdir -p storage/framework/{sessions,views,cache/data} storage/logs bootstrap/cache \
  && $PHP_BIN artisan migrate --force --no-interaction && $PHP_BIN artisan optimize:clear && $PHP_BIN artisan up \
  && echo $SHA > .deploy-sha"

echo "▶ 4/4 Frontend → $DEPLOY_PATH"
# Old content-hashed bundles are left in place (harmless); index.html goes last so it never points at missing files.
push --exclude=/index.html frontend/dist/v-one/browser/ "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/"
push frontend/dist/v-one/browser/index.html "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/index.html"
echo "✔ Deployed ${SHA:0:7}"
