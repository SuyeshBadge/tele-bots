#!/usr/bin/env node
/**
 * Hot reload functionality for the UI/UX Lesson Bot.
 * This module uses nodemon to watch for code changes and automatically restart the application.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getChildLogger } from './app/utils/logger';

// Configure logger
const logger = getChildLogger('hot-reload');

// Current process
let currentProcess: ChildProcess | null = null;

// Last reload time for cooldown period
let lastReloadTime = Date.now();
const reloadCooldown = 1000; // 1 second cooldown

/**
 * Start a process with the given command and arguments
 */
function startProcess(command: string, args: string[]): ChildProcess {
  logger.info(`Starting process: ${command} ${args.join(' ')}`);
  
  const process = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
  });
  
  process.on('error', (err) => {
    logger.error(`Process error: ${err.message}`);
  });
  
  process.on('exit', (code, signal) => {
    if (code !== null) {
      logger.info(`Process exited with code: ${code}`);
    } else if (signal) {
      logger.info(`Process was killed with signal: ${signal}`);
    }
  });
  
  return process;
}

/**
 * Restart the application
 */
function restartApp(): void {
  const now = Date.now();
  
  // Check if we're outside the cooldown period
  if (now - lastReloadTime < reloadCooldown) {
    return;
  }
  
  lastReloadTime = now;
  
  // Kill the current process if it exists
  if (currentProcess) {
    logger.info('Stopping current process...');
    
    try {
      // Send SIGINT (Ctrl+C) which triggers the bot's clean shutdown handlers
      currentProcess.kill('SIGINT');
      
      // Wait for the process to terminate gracefully
      setTimeout(() => {
        // Force kill if still running after 5 seconds
        if (currentProcess) {
          try {
            currentProcess.kill('SIGKILL');
            logger.info('Process terminated forcefully after timeout');
          } catch (error) {
            logger.error(`Error during forced kill: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Start a new process
        currentProcess = startProcess('node', [path.join(process.cwd(), 'dist', 'main.js')]);
      }, 5000);
    } catch (error) {
      logger.error(`Error restarting process: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Start a new process
    currentProcess = startProcess('node', [path.join(process.cwd(), 'dist', 'main.js')]);
  }
}

/**
 * Start the hot reload system
 */
export function startHotReload(): void {
  logger.info('Starting hot reload system...');
  
  try {
    // Use nodemon programmatically if needed, but generally we'll use it from the command line
    // This function is here for manual testing or advanced use cases
    
    // Start the initial process
    currentProcess = startProcess('node', [path.join(process.cwd(), 'dist', 'main.js')]);
    
    // Setup clean shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT. Shutting down...');
      
      if (currentProcess) {
        currentProcess.kill('SIGINT');
      }
      
      // Exit after a short delay to allow clean shutdown
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    });
    
    logger.info('Hot reload system started. Press Ctrl+C to exit.');
  } catch (error) {
    logger.error(`Hot reload error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Auto-start if this file is the entry point
if (require.main === module) {
  startHotReload();
} 