# Hot Reload Fix

## Issue Fixed

When the hot reload system detected changes and restarted the bot, it sometimes caused the following error:

```
Error while getting Updates: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running
```

This error occurred because the Telegram API doesn't allow multiple instances of the same bot to be polling for updates simultaneously. When hot reload started a new bot instance before the old one was fully shut down, both instances tried to poll for updates, causing a conflict.

## Fixes Applied

We made several improvements to ensure proper cleanup of Telegram API connections during hot reload:

### 1. Enhanced Process Termination in `hot_reload.py`

- Changed signal from SIGTERM to SIGINT to trigger the bot's built-in clean shutdown handlers
- Increased timeout for graceful shutdown from 5 to 10 seconds
- Added a two-stage termination process: SIGINT → SIGTERM → SIGKILL
- Added a 2-second delay after process termination to ensure all connections are closed

```python
# Send SIGINT (Ctrl+C) which triggers the bot's clean shutdown handlers
os.kill(current_process.pid, signal.SIGINT)

# Increased timeout for clean shutdown
current_process.wait(timeout=10)

# Added delay to ensure connections are fully closed
time.sleep(2)
```

### 2. Improved Bot Shutdown Handling in `bot.py`

- Added a shutdown flag to prevent multiple simultaneous shutdown attempts
- Added handling for RuntimeError during shutdown when the event loop is closed

```python
# Shutdown flag to prevent multiple shutdown attempts
self.is_shutting_down = False

# In shutdown method:
if self.is_shutting_down:
    return
    
self.is_shutting_down = True
```

### 3. Added Signal Handlers in `dev.py`

- Added proper signal handlers in the development script
- Ensured clean exit when Ctrl+C is pressed

```python
def handle_exit(signum, frame):
    """Handle exit signals to ensure clean shutdown"""
    print("\nReceived shutdown signal. Exiting...")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)
```

## How These Fixes Work

1. When a file change is detected, hot reload sends SIGINT to the running bot
2. This triggers the bot's clean shutdown process, which:
   - Saves subscriber data
   - Updates health status
   - Shuts down the scheduler
   - Stops the Telegram application properly
3. Hot reload waits for 10 seconds for the process to exit gracefully
4. If it doesn't exit, hot reload tries SIGTERM, then SIGKILL as a last resort
5. After the old process is terminated, hot reload waits 2 more seconds before starting a new one
6. This ensures all Telegram API connections are fully closed before the new bot instance starts

## Testing the Fix

To verify the fix is working properly:
1. Run the bot in development mode with `python3 dev.py`
2. Make changes to any Python file in the project
3. Observe the hot reload process - it should now smoothly restart without the conflict error

## Additional Error Prevention

To further prevent this issue from occurring:
1. Allow the bot to fully start up before making additional code changes
2. Avoid rapid consecutive changes to multiple files
3. If you do encounter the error, stop the bot with Ctrl+C and restart it manually 