#!/usr/bin/env bash

# Exit on error
set -e

echo "Starting UI/UX Lesson Bot (TypeScript)..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not installed."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is required but not installed."
    exit 1
fi

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project directory
cd "$DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if dist directory exists, if not build the project
if [ ! -d "dist" ]; then
    echo "Building the project..."
    npm run build
fi

# Check if the environment file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Created .env from .env.example. Please edit with your actual values."
    else
        echo "Error: .env.example file not found. Cannot create .env file."
        exit 1
    fi
fi

# Clear any stale processes
echo "Clearing any stale processes..."
pkill -f "node dist/main.js" || true
sleep 1

# Run the bot
echo "Launching the bot..."
node dist/main.js

echo "Bot has exited." 