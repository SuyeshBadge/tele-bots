#!/bin/bash
#
# Deploy UI/UX Bot to Fly.io
# This script handles deployment to Fly.io platform
#
# Requirements:
# - Fly CLI installed (https://fly.io/docs/hands-on/install-flyctl/)
# - Logged in to Fly.io (`fly auth login`)

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

# Check if Fly CLI is installed
check_flyctl() {
  log "${YELLOW}Checking if fly CLI is installed...${NC}"
  if ! command -v flyctl &> /dev/null && ! command -v fly &> /dev/null; then
    log "${RED}Fly CLI is not installed. Please install it first:${NC}"
    log "${YELLOW}https://fly.io/docs/hands-on/install-flyctl/${NC}"
    exit 1
  fi
  log "${GREEN}Fly CLI is installed!${NC}"

  # Choose the correct command name
  if command -v flyctl &> /dev/null; then
    FLY_CMD="flyctl"
  else
    FLY_CMD="fly"
  fi
}

# Check if user is logged in to Fly.io
check_login() {
  log "${YELLOW}Checking if you're logged in to Fly.io...${NC}"
  if ! $FLY_CMD auth whoami &> /dev/null; then
    log "${RED}You're not logged in to Fly.io. Please login first:${NC}"
    log "${YELLOW}fly auth login${NC}"
    exit 1
  fi
  log "${GREEN}You're logged in to Fly.io!${NC}"
}

# Check if app already exists
check_app() {
  log "${YELLOW}Checking if app already exists on Fly.io...${NC}"
  if $FLY_CMD apps list | grep -q "uiux-bot-ts"; then
    log "${GREEN}App already exists on Fly.io${NC}"
    APP_EXISTS=true
  else
    log "${YELLOW}App does not exist on Fly.io, will create it${NC}"
    APP_EXISTS=false
  fi
}

# Create volumes if they don't exist
create_volumes() {
  log "${YELLOW}Creating volumes if they don't exist...${NC}"
  
  # Create data volume
  if ! $FLY_CMD volumes list | grep -q "data"; then
    log "${YELLOW}Creating data volume...${NC}"
    $FLY_CMD volumes create data --size 1 --region sin
    log "${GREEN}Data volume created!${NC}"
  else
    log "${GREEN}Data volume already exists${NC}"
  fi
  
  # Create logs volume
  if ! $FLY_CMD volumes list | grep -q "logs"; then
    log "${YELLOW}Creating logs volume...${NC}"
    $FLY_CMD volumes create logs --size 1 --region sin
    log "${GREEN}Logs volume created!${NC}"
  else
    log "${GREEN}Logs volume already exists${NC}"
  fi
}

# Deploy the application
deploy_app() {
  log "${YELLOW}Building and deploying app to Fly.io...${NC}"
  
  if [ "$APP_EXISTS" = false ]; then
    # Launch new app
    $FLY_CMD launch --no-deploy --copy-config --name uiux-bot-ts --region sin
    log "${GREEN}App created on Fly.io!${NC}"
  fi
  
  # Set secrets from .env file
  log "${YELLOW}Setting secrets from .env file...${NC}"
  if [ -f .env ]; then
    # Parse .env file and set each variable as a secret
    while IFS= read -r line || [[ -n "$line" ]]; do
      # Skip comments and empty lines
      [[ "$line" =~ ^#.*$ ]] && continue
      [[ -z "$line" ]] && continue
      
      # Extract key and value
      key=$(echo "$line" | cut -d '=' -f 1)
      value=$(echo "$line" | cut -d '=' -f 2-)
      
      # Set secret
      $FLY_CMD secrets set "$key=$value" --app uiux-bot-ts
    done < .env
    log "${GREEN}Secrets set from .env file!${NC}"
  else
    log "${RED}No .env file found. Will continue but you'll need to set secrets manually${NC}"
  fi
  
  # Deploy the application
  log "${YELLOW}Deploying app...${NC}"
  $FLY_CMD deploy --app uiux-bot-ts
  log "${GREEN}App deployed successfully!${NC}"
}

# Main function
main() {
  log "${GREEN}=== Deploying UI/UX Bot to Fly.io ===${NC}"
  
  check_flyctl
  check_login
  check_app
  create_volumes
  deploy_app
  
  log "${GREEN}=== Deployment completed successfully! ===${NC}"
  log "${GREEN}Your bot is now running on Fly.io.${NC}"
  log "${YELLOW}To check status:${NC} $FLY_CMD status -a uiux-bot-ts"
  log "${YELLOW}To view logs:${NC} $FLY_CMD logs -a uiux-bot-ts"
}

# Run main function
main 