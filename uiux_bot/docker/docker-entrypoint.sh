#!/bin/bash
set -e

# Create necessary directories if they don't exist
mkdir -p /app/data
mkdir -p /app/images

# Check if subscribers.json exists, create empty one if not
if [ ! -f /app/data/subscribers.json ]; then
    echo "[]" > /app/data/subscribers.json
    echo "Created empty subscribers.json file"
fi

# Check if health.json exists, create empty one if not
if [ ! -f /app/data/health.json ]; then
    echo "{\"status\": \"starting\", \"last_update\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}" > /app/data/health.json
    echo "Created health.json file"
fi

# Check if lessons.json exists, create empty one if not
if [ ! -f /app/data/lessons.json ]; then
    echo "{\"current_lesson\": 1, \"last_sent\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}" > /app/data/lessons.json
    echo "Created lessons.json file"
fi

# Set proper permissions
chmod -R 755 /app/data
chmod -R 755 /app/images

echo "Entrypoint setup complete"

# Execute the command passed to docker run
exec "$@" 