#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Development script for UI/UX Lesson Bot.
Runs the bot with hot reloading enabled.
"""

import subprocess
import sys
import signal
import os

def ensure_dependencies():
    """Ensure all required dependencies are installed"""
    try:
        import watchdog
    except ImportError:
        print("Installing required dependencies...")
        subprocess.run([sys.executable, "-m", "pip", "install", "watchdog"])

def handle_exit(signum, frame):
    """Handle exit signals to ensure clean shutdown"""
    # This handler will be propagated to child processes
    print("\nReceived shutdown signal. Exiting...")
    sys.exit(0)

def main():
    """Run the bot in development mode"""
    # Ensure dependencies
    ensure_dependencies()
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)
    
    # Import after ensuring dependencies
    from hot_reload import start_hot_reload
    
    print("=== UI/UX Bot Development Mode ===")
    print("Starting application with hot reload...")
    print("Press Ctrl+C to stop\n")
    
    # Start hot reload
    try:
        start_hot_reload()
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")

if __name__ == "__main__":
    main() 