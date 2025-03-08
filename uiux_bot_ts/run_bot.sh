#!/usr/bin/env bash

# UI/UX Lesson Bot - Single Command Runner
#
# This script allows running a single command with the bot context.
# Usage: ./run_bot.sh "command [args]"
#
# Example: ./run_bot.sh "import { getRandomTheme } from './dist/app/api/openai-client'; console.log(getRandomTheme());"

# Exit on error
set -e

# Check for argument
if [ -z "$1" ]; then
    echo "Usage: $0 'command [args]'"
    echo "Example: $0 'import { getRandomTheme } from \"./dist/app/api/openai-client\"; console.log(getRandomTheme());'"
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

# Run the command
echo "Running command: $1"
node -e "
require('dotenv').config();
require('module-alias/register');
$1
"

echo "Command execution completed." 