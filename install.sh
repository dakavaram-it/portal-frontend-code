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

printf "\n  Installing frontend dependencies...\n\n"
cd "$ROOT/Frontend"
npm install
info "Frontend dependencies installed"

printf "\n  Building frontend...\n\n"
npm run build
info "Frontend built"

printf "\n  Setting up PM2...\n\n"
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
    info "PM2 installed globally"
else
    info "PM2 $(pm2 -v) already installed"
fi

printf "\n  Starting services with PM2...\n\n"
cd "$ROOT"
pm2 stop portal-frontend 2>/dev/null || true
pm2 delete portal-frontend 2>/dev/null || true
fuser -k 9001/tcp 2>/dev/null || true
sleep 1
pm2 start ecosystem.config.cjs
pm2 save
info "PM2 services started"

printf "\n"
pm2 status

printf "\n${GREEN}  Setup complete!${NC}\n\n"
printf "    Frontend → http://localhost:9001\n"
printf "    Backend  → separate repo; vite.config.js proxies /leapapi to it\n\n"
printf "  PM2 commands:\n"
printf "    pm2 status          # check running services\n"
printf "    pm2 logs            # tail all logs\n"
printf "    pm2 restart all     # restart services\n"
printf "    pm2 stop all        # stop services\n"
printf "    pm2 startup         # enable auto-start on boot\n"
printf "\n"
