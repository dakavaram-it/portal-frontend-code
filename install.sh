#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
error() { printf "${RED}[✗]${NC} %s\n" "$1"; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"

printf "\n  Party Portal — Setup\n\n"

if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Install v18+ from https://nodejs.org"
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VERSION" -lt 18 ] && error "Node.js v18+ required (found v$NODE_VERSION)"
info "Node.js $(node -v)"

if ! command -v npm &>/dev/null; then error "npm not found"; fi
info "npm $(npm -v)"

PYTHON=""
if command -v python3 &>/dev/null; then PYTHON="python3"
elif command -v python &>/dev/null; then PYTHON="python"
fi
[ -z "$PYTHON" ] && error "Python 3.9+ not found — the backend cannot be installed"
PY_VERSION=$($PYTHON --version 2>&1 | awk '{print $2}')
PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 9 ]; }; then
    error "Python 3.9+ required (found $PY_VERSION)"
fi
info "Python $PY_VERSION"

printf "\n  Installing frontend dependencies...\n\n"
cd "$ROOT/Frontend"
npm install
info "Frontend dependencies installed"

printf "\n  Building frontend...\n\n"
npm run build
info "Frontend built"

printf "\n  Setting up backend...\n\n"
cd "$ROOT/Backend"
if [ ! -f ".venv/bin/activate" ]; then
    [ -d ".venv" ] && rm -rf .venv
    $PYTHON -m venv .venv
    info "Created Python virtual environment"
else
    info "Virtual environment already exists"
fi
.venv/bin/pip install -q -r requirements.txt
info "Backend dependencies installed"

printf "\n  Setting up PM2...\n\n"
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
    info "PM2 installed globally"
else
    info "PM2 $(pm2 -v) already installed"
fi

printf "\n"
if [ ! -f "$ROOT/.env" ]; then
    error "No .env in the project root — copy .env.example to .env, fill in the DB credentials, then re-run"
fi
info ".env file found"

printf "\n  Starting services with PM2...\n\n"
cd "$ROOT"
pm2 stop portal-frontend portal-backend 2>/dev/null || true
pm2 delete portal-frontend portal-backend 2>/dev/null || true
fuser -k 9001/tcp 2>/dev/null || true
fuser -k 8001/tcp 2>/dev/null || true
sleep 1
pm2 start ecosystem.config.cjs
pm2 save
info "PM2 services started"

printf "\n"
pm2 status

printf "\n${GREEN}  Setup complete!${NC}\n\n"
printf "    Frontend → http://localhost:9001\n"
printf "    Backend  → http://localhost:8001  (API docs at /docs)\n\n"
printf "  PM2 commands:\n"
printf "    pm2 status          # check running services\n"
printf "    pm2 logs            # tail all logs\n"
printf "    pm2 restart all     # restart services\n"
printf "    pm2 stop all        # stop services\n"
printf "    pm2 startup         # enable auto-start on boot\n"
printf "\n"
