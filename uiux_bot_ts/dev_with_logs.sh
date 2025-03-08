#!/bin/bash

# UI/UX Lesson Bot Development Script with Enhanced Logging
# This script runs the bot in development mode with enhanced logging

echo "Starting UI/UX Lesson Bot with enhanced logging..."

# Ensure log directories exist
mkdir -p logs/api
mkdir -p logs/activities

# Set environment variables for better logging
export LOG_LEVEL=DEBUG
export NODE_ENV=development

# Run the bot in development mode
echo "Running in development mode with nodemon for hot reload"
npm run dev

# Keep this process running
echo "Press Ctrl+C to stop the bot" 