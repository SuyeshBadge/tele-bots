#!/usr/bin/env bash

# Exit on error
set -e

echo "Starting UI/UX Lesson Bot..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python3 is required but not installed."
    exit 1
fi

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project directory
cd "$DIR"

# Check if the virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate the virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if the environment file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Using default configuration."
fi

# Clear any stale event loops
echo "Clearing any stale event loops..."
pkill -f "python3 main.py" || true
sleep 1

# Run the bot
echo "Launching the bot..."
python3 main.py

# Deactivate the virtual environment
deactivate 