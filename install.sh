#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== MyPartyDashboard Portal - Install Script ===${NC}"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js (v18 or higher) from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js v18+ is recommended. You have $(node -v)${NC}"
fi

echo -e "Node.js version: $(node -v)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

echo -e "npm version: $(npm -v)"
echo ""

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing globally...${NC}"
    npm install -g pm2
fi

echo -e "PM2 version: $(pm2 -v)"
echo ""

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build for production
echo -e "${GREEN}Building for production...${NC}"
npm run build

# Stop and clean up existing PM2 process
echo -e "${GREEN}Stopping existing PM2 process...${NC}"
pm2 stop portal-frontend 2>/dev/null || true
pm2 delete portal-frontend 2>/dev/null || true

# Free port 9001 in case of orphaned process
echo -e "${GREEN}Freeing port 9001...${NC}"
fuser -k 9001/tcp 2>/dev/null || true
sleep 1

# Start with PM2
echo -e "${GREEN}Starting app with PM2 on port 9001...${NC}"
pm2 start ecosystem.config.cjs

# Save PM2 process list for auto-restart on reboot
pm2 save

echo ""
echo -e "${GREEN}=== Deployment complete! ===${NC}"
echo ""
echo "App running on port 9001"
echo ""
echo "PM2 commands:"
echo "  pm2 status                    - Check app status"
echo "  pm2 logs portal-frontend      - View logs"
echo "  pm2 restart portal-frontend   - Restart app"
echo "  pm2 stop portal-frontend      - Stop app"
echo "  pm2 startup                   - Enable auto-start on boot"