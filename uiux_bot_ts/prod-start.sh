#!/bin/bash
#
# Production Startup Script for UI/UX Bot
# This script performs pre-flight checks and starts the bot in production mode

set -e

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Logging function
log() {
  echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Pre-flight checks
preflight_checks() {
  log "${YELLOW}Running pre-flight checks...${NC}"
  
  # 1. Check if .env file exists
  if [ ! -f .env ]; then
    log "${RED}ERROR: .env file not found. Copy .env.example to .env and fill in the values.${NC}"
    exit 1
  fi
  
  # 2. Check if node_modules exists
  if [ ! -d node_modules ]; then
    log "${YELLOW}Installing dependencies...${NC}"
    npm ci --only=production
  fi
  
  # 3. Check if dist directory exists
  if [ ! -d dist ]; then
    log "${YELLOW}Building application...${NC}"
    npm run build
  fi
  
  # 4. Create required directories
  mkdir -p logs data images
  
  # 5. Run health check
  log "${YELLOW}Running health check...${NC}"
  if node dist/scripts/health-check.js; then
    log "${GREEN}Health check passed!${NC}"
  else
    log "${RED}ERROR: Health check failed!${NC}"
    exit 1
  fi
}

# Start the bot
start_bot() {
  log "${GREEN}Starting UI/UX Bot in production mode...${NC}"
  
  # Set NODE_ENV to production
  export NODE_ENV=production
  
  # Start the bot with proper error handling
  node dist/main.js
}

# Main script
main() {
  log "${GREEN}=== UI/UX Bot Production Startup ===${NC}"
  
  # Run pre-flight checks
  preflight_checks
  
  # Start the bot
  start_bot
}

# Run main function
main

# Exit with the status code from the bot
exit $? 