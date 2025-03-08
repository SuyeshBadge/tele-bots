#!/usr/bin/env node
/**
 * Development script for UI/UX Lesson Bot.
 * Runs the bot with hot reloading enabled.
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { getChildLogger } from './app/utils/logger';

// Configure logger
const logger = getChildLogger('dev');

/**
 * Ensure all required dependencies are installed
 */
async function ensureDependencies(): Promise<void> {
  try {
    // Check if nodemon is installed
    const requiredDeps = ['nodemon', 'ts-node', 'tsconfig-paths'];
    const missingDeps: string[] = [];
    
    for (const dep of requiredDeps) {
      try {
        require.resolve(dep);
      } catch (error) {
        missingDeps.push(dep);
      }
    }
    
    if (missingDeps.length > 0) {
      logger.info(`Installing required dependencies: ${missingDeps.join(', ')}...`);
      
      const installProcess = spawn('npm', ['install', '--save-dev', ...missingDeps], {
        stdio: 'inherit',
        shell: true,
      });
      
      // Wait for install to complete
      await new Promise<void>((resolve, reject) => {
        installProcess.on('exit', (code) => {
          if (code === 0) {
            logger.info('Dependencies installed successfully.');
            resolve();
          } else {
            reject(new Error(`Failed to install dependencies. Exit code: ${code}`));
          }
        });
        
        installProcess.on('error', (err) => {
          reject(new Error(`Failed to install dependencies: ${err.message}`));
        });
      });
    }
  } catch (error) {
    logger.error(`Error ensuring dependencies: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Handle exit signals to ensure clean shutdown
 */
function handleExit(): void {
  logger.info('Received shutdown signal. Exiting...');
  process.exit(0);
}

/**
 * Run the bot in development mode
 */
async function main(): Promise<void> {
  // Ensure dependencies
  await ensureDependencies();
  
  // Register signal handlers for graceful shutdown
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
  
  console.log('=== UI/UX Bot Development Mode ===');
  console.log('Starting application with hot reload...');
  console.log('Press Ctrl+C to stop\n');
  
  try {
    // Start nodemon
    const nodemonProcess = spawn('npx', ['nodemon'], {
      stdio: 'inherit',
      shell: true,
    });
    
    // Wait for nodemon to exit
    nodemonProcess.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`Nodemon exited with code ${code}`);
        process.exit(code || 1);
      }
    });
    
    nodemonProcess.on('error', (err) => {
      logger.error(`Nodemon error: ${err.message}`);
      process.exit(1);
    });
  } catch (error) {
    logger.error(`Error starting development mode: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run if this file is the entry point
if (require.main === module) {
  main().catch((error) => {
    logger.error(`Uncaught error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
} 