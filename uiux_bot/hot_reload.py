#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Hot reload functionality for the UI/UX Lesson Bot.
This module watches for code changes and automatically restarts the application.
"""

import os
import sys
import time
import logging
import subprocess
import signal
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("hot_reload")

# Current process
current_process = None


class CodeChangeHandler(FileSystemEventHandler):
    """Handler for file system events to detect code changes"""
    
    def __init__(self, main_script):
        self.main_script = main_script
        self.last_reload_time = time.time()
        self.reload_cooldown = 1.0  # Seconds between reloads to prevent rapid restarts
    
    def on_modified(self, event):
        # Only respond to .py file changes
        if not event.is_directory and event.src_path.endswith('.py'):
            current_time = time.time()
            # Check if we're outside the cooldown period
            if current_time - self.last_reload_time > self.reload_cooldown:
                self.last_reload_time = current_time
                logger.info(f"Code change detected in {os.path.basename(event.src_path)}. Restarting...")
                self.restart_app()
    
    def restart_app(self):
        """Restart the application"""
        global current_process
        
        # Kill the current process if it exists
        if current_process:
            logger.info("Stopping current process...")
            
            # Send SIGINT (Ctrl+C) which triggers the bot's clean shutdown handlers
            os.kill(current_process.pid, signal.SIGINT)
            
            try:
                # Wait for the process to terminate gracefully with increased timeout
                # Telegram API needs more time to properly clean up connections
                logger.info("Waiting for clean shutdown...")
                current_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                # If it doesn't terminate after timeout, try SIGTERM
                logger.warning("Clean shutdown timed out, sending SIGTERM...")
                os.kill(current_process.pid, signal.SIGTERM)
                
                try:
                    # Wait again
                    current_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # Force kill if it still doesn't terminate
                    logger.warning("Process didn't terminate after SIGTERM, forcing kill...")
                    os.kill(current_process.pid, signal.SIGKILL)
            
            logger.info("Process stopped")
            
            # Add a delay to ensure Telegram API connections are fully closed
            # This helps prevent the "terminated by other getUpdates request" error
            time.sleep(2)
        
        # Start the application
        logger.info("Starting application...")
        current_process = subprocess.Popen([sys.executable, self.main_script])
        logger.info(f"Application started with PID: {current_process.pid}")


def start_hot_reload(main_script='main.py', watch_dirs=None):
    """
    Start hot reload functionality
    
    Args:
        main_script (str): Path to the main script to run
        watch_dirs (list): List of directories to watch for changes
    """
    if watch_dirs is None:
        # Default directories to watch
        watch_dirs = ['.', 'app']
    
    # Absolute paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    main_script_path = os.path.join(script_dir, main_script)
    
    # Verify main script exists
    if not os.path.exists(main_script_path):
        logger.error(f"Main script not found: {main_script_path}")
        sys.exit(1)
    
    # Initialize event handler and observer
    event_handler = CodeChangeHandler(main_script_path)
    observer = Observer()
    
    # Start watching directories
    for dir_path in watch_dirs:
        abs_dir_path = os.path.join(script_dir, dir_path)
        if os.path.exists(abs_dir_path):
            observer.schedule(event_handler, abs_dir_path, recursive=True)
            logger.info(f"Watching directory: {abs_dir_path}")
        else:
            logger.warning(f"Directory not found: {abs_dir_path}")
    
    # Start the observer
    observer.start()
    
    # Start the application initially
    event_handler.restart_app()
    
    try:
        # Keep the script running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        # Handle keyboard interrupt (Ctrl+C)
        logger.info("Received keyboard interrupt. Stopping...")
        if current_process:
            os.kill(current_process.pid, signal.SIGTERM)
        observer.stop()
    
    # Wait for the observer thread to finish
    observer.join()
    
    logger.info("Hot reload stopped")


if __name__ == "__main__":
    # Parse command line arguments
    import argparse
    
    parser = argparse.ArgumentParser(description="Hot reload for UI/UX Lesson Bot")
    parser.add_argument("--script", default="main.py", help="Main script to run")
    parser.add_argument("--dirs", nargs="+", default=None, help="Directories to watch")
    
    args = parser.parse_args()
    
    start_hot_reload(args.script, args.dirs) 