#!/usr/bin/env bash
# Uploads the /chatboat frontend and the backend code to Hostinger over FTP (used by .github/workflows/deploy-chatboat.yml).
#
#   MODE=changed  only files changed since the last deploy (deleted files are removed on the server);
#                 the frontend is rebuilt/uploaded only when frontend files changed
#   MODE=full     everything: the whole frontend build and backend app/, config/, routes/
#
# The deployed commit is stored in backend/core/.chatboat-deploy-sha (not reachable from the web).
# Without it — first deploy, or history rewritten — "changed" falls back to "full".
#
# Env: FTP_HOST FTP_USER FTP_PASSWORD [FTP_REMOTE_DIR] MODE GITHUB_SHA GITHUB_OUTPUT
# Run from the repository root. Call with "plan" to decide what to deploy, then "upload".
set -euo pipefail

MARKER=backend/core/.chatboat-deploy-sha
BACKEND_PATHS=(backend/app backend/config backend/routes)
FRONTEND_PATHS=(frontend deploy/templates/chatboat.htaccess)
OPTS="set ftp:ssl-allow true; set ssl:verify-certificate no; set net:max-retries 3; set net:timeout 30"
STATE=.deploy-state

ftp() { lftp -u "$FTP_USER","$FTP_PASSWORD" -e "$OPTS; $1; bye" "$FTP_HOST"; }

find_remote() {
  if [ -n "${FTP_REMOTE_DIR:-}" ]; then echo "$FTP_REMOTE_DIR"; return; fi
  # The FTP login may open in public_html itself or one level above it.
  for dir in . public_html domains/velouraone.in/public_html; do
    if ftp "cls -1 $dir/backend/core/artisan" >/dev/null 2>&1; then echo "$dir"; return; fi
  done
  echo "::error::Could not find backend/core/artisan over FTP. Set the FTP_REMOTE_DIR secret to the folder that contains backend/ and index.html." >&2
  exit 1
}

plan() {
  if [ -z "${FTP_HOST:-}" ] || [ -z "${FTP_USER:-}" ] || [ -z "${FTP_PASSWORD:-}" ]; then
    echo "::error::Add the FTP_HOST, FTP_USER and FTP_PASSWORD repository secrets first."; exit 1
  fi
  local remote mode last=""
  remote=$(find_remote)
  mode=${MODE:-changed}

  if [ "$mode" = changed ]; then
    if ftp "cd $remote; get $MARKER -o .last-sha" >/dev/null 2>&1; then
      last=$(tr -d '[:space:]' < .last-sha)
    fi
    if [ -z "$last" ] || ! git cat-file -e "$last^{commit}" 2>/dev/null; then
      echo "No usable deploy marker on the server — deploying everything."
      mode=full
    elif [ "$last" = "$GITHUB_SHA" ]; then
      echo "This commit is already deployed."
    fi
  fi

  local frontend=true
  : > .backend-upload; : > .backend-delete
  if [ "$mode" = changed ]; then
    git diff --no-renames --name-status "$last" "$GITHUB_SHA" -- "${BACKEND_PATHS[@]}" | while IFS=$'\t' read -r status path; do
      if [ "$status" = D ]; then echo "$path" >> .backend-delete; else echo "$path" >> .backend-upload; fi
    done
    git diff --quiet "$last" "$GITHUB_SHA" -- "${FRONTEND_PATHS[@]}" && frontend=false
    echo "Changes since ${last:0:7}:"
    echo "  backend uploads: $(wc -l < .backend-upload)   backend deletes: $(wc -l < .backend-delete)   frontend: $frontend"
    sed 's/^/    + /' .backend-upload; sed 's/^/    - /' .backend-delete
  fi

  printf 'REMOTE=%q\nMODE=%q\nFRONTEND=%q\n' "$remote" "$mode" "$frontend" > "$STATE"
  echo "frontend=$frontend" >> "$GITHUB_OUTPUT"
  echo "Mode: $mode · folder: $remote · frontend: $frontend"
}

upload() {
  # shellcheck disable=SC1090
  source "$STATE"
  local script=.lftp-script
  {
    echo "$OPTS"
    echo "cd \"$REMOTE\""
    if [ "$FRONTEND" = true ]; then
      echo "mkdir -p chatboat"               # some servers reject this when it exists — fine, fail-exit is not on yet
      echo "set cmd:fail-exit yes"
      if [ "$MODE" = full ]; then
        echo "mirror -R --delete --parallel=4 --verbose frontend/dist/chatboat/browser chatboat"
      else
        # Bundles have content-hashed names: only new/resized files go up, removed bundles are deleted.
        echo "mirror -R --delete --ignore-time --parallel=4 --verbose frontend/dist/chatboat/browser chatboat"
        echo "put -O chatboat frontend/dist/chatboat/browser/index.html"
        echo "put -O chatboat frontend/dist/chatboat/browser/.htaccess"
      fi
    fi
    echo "set cmd:fail-exit yes"
    if [ "$MODE" = full ]; then
      for p in "${BACKEND_PATHS[@]}"; do echo "mirror -R --parallel=4 --verbose $p backend/core/${p#backend/}"; done
    else
      while read -r f; do
        [ -n "$f" ] || continue
        dir="backend/core/$(dirname "${f#backend/}")"
        echo "set cmd:fail-exit no"; echo "mkdir -p $dir"; echo "set cmd:fail-exit yes"
        echo "put -O $dir $f"
      done < .backend-upload
      echo "set cmd:fail-exit no"
      while read -r f; do
        [ -n "$f" ] && echo "rm -f backend/core/${f#backend/}"
      done < .backend-delete
    fi
    echo "set cmd:fail-exit no"
    echo "rm -f backend/core/bootstrap/cache/config.php"
    echo "rm -f backend/core/bootstrap/cache/routes-v7.php"
    echo "set cmd:fail-exit yes"
    echo "put -O backend/core .chatboat-deploy-sha"
  } > "$script"

  echo "$GITHUB_SHA" > .chatboat-deploy-sha
  echo "---- FTP commands ----"; sed 's/^/  /' "$script"
  lftp -u "$FTP_USER","$FTP_PASSWORD" "$FTP_HOST" < "$script"
}

case "${1:-}" in
  plan) plan ;;
  upload) upload ;;
  *) echo "usage: $0 plan|upload" >&2; exit 2 ;;
esac
