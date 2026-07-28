#!/usr/bin/env bash
#
# deploy.sh — pull the latest main and reload the app under PM2.
#
# Safe to run repeatedly. Uses a lock so overlapping webhook deliveries
# can't run at the same time. Only reinstalls dependencies when the
# lockfile actually changed, so most deploys are near-instant.
#
# Config via environment (with sensible defaults):
#   REPO_DIR   absolute path to the git checkout on the Pi
#   BRANCH     branch the Pi tracks               (default: main)
#   APP_NAME   PM2 process name of the app        (default: nails-by-sally)
#
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
APP_NAME="${APP_NAME:-nails-by-sally}"

LOCK="/tmp/nails-deploy.lock"
LOG_DIR="$REPO_DIR/deploy/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/deploy.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# --- Serialize deploys -------------------------------------------------------
exec 9>"$LOCK"
if ! flock -n 9; then
  log "Another deploy is already running; skipping this one."
  exit 0
fi

cd "$REPO_DIR"

log "Deploy started (branch=$BRANCH, app=$APP_NAME, dir=$REPO_DIR)"

OLD_REV="$(git rev-parse HEAD)"

git fetch --prune origin "$BRANCH"
NEW_REV="$(git rev-parse "origin/$BRANCH")"

if [ "$OLD_REV" = "$NEW_REV" ]; then
  log "Already up to date at ${NEW_REV:0:8}; nothing to do."
  exit 0
fi

# Hard reset to exactly match origin. .env and node_modules are gitignored,
# so they are preserved across this reset.
git reset --hard "origin/$BRANCH"
git clean -df --exclude=node_modules --exclude=.env
log "Updated ${OLD_REV:0:8} -> ${NEW_REV:0:8}"

# --- Install deps only if the lockfile changed -------------------------------
if git diff --name-only "$OLD_REV" "$NEW_REV" | grep -qE '^package-lock\.json$|^package\.json$'; then
  log "Dependency manifest changed; running npm install..."
  npm install --no-audit --no-fund 2>&1 | tee -a "$LOG"
else
  log "No dependency changes; skipping npm install."
fi

# --- Reload the app (zero-downtime if in cluster mode) -----------------------
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env 2>&1 | tee -a "$LOG"
  log "Reloaded PM2 process '$APP_NAME'."
else
  log "PM2 process '$APP_NAME' not found; starting it..."
  pm2 start server.js --name "$APP_NAME" 2>&1 | tee -a "$LOG"
fi

pm2 save > /dev/null 2>&1 || true
log "Deploy finished successfully."
