#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Development script for UI/UX Lesson Bot.
Runs the bot with hot reloading enabled.
"""

import subprocess
import sys

def ensure_dependencies():
    """Ensure all required dependencies are installed"""
    try:
        import watchdog
    except ImportError:
        print("Installing required dependencies...")
        subprocess.run([sys.executable, "-m", "pip", "install", "watchdog"])

def main():
    """Run the bot in development mode"""
    # Ensure dependencies
    ensure_dependencies()
    
    # Import after ensuring dependencies
    from hot_reload import start_hot_reload
    
    print("=== UI/UX Bot Development Mode ===")
    print("Starting application with hot reload...")
    print("Press Ctrl+C to stop\n")
    
    # Start hot reload
    start_hot_reload()

if __name__ == "__main__":
    main() 